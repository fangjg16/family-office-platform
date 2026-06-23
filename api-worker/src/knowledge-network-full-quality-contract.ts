import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  countRichRowsForSpec,
  countValidRows,
  countValidRowsForColumns,
  isMeaningfulCell,
  isValidTableRow,
  type EmptyRowIssue,
  type UnmappedRowIssue,
} from "./knowledge-network-content-row-quality";
import {
  findResidualEmptyRowsInNormalized,
  findResidualUnmappedInNormalized,
  normalizeSlotPayload,
} from "./knowledge-network-slot-normalizer";
import {
  buildBatch3CoverageRepairHint,
  evaluateCompsBenchmarkLayers,
  evaluateResourceNetworkLayers,
  evaluateValuationReturnsLayers,
} from "./knowledge-network-batch3-coverage";
import {
  buildGapFirstRepairHint,
  evaluateLegalOwnershipLayers,
  evaluateRegulatoryComplianceLayers,
  type SlotCoverageLayers,
} from "./knowledge-network-gap-first-quality";
import {
  buildSlotCoverageRepairHint,
  evaluateBusinessOperationsLayers,
  evaluateDecisionFrameworkLayers,
  evaluateDiligenceGapsLayers,
  evaluateIndustryMarketLayers,
  evaluateRisksMitigationLayers,
  evaluateSnapshotLayers,
  evaluateTargetOverviewLayers,
  evaluateTimelineMilestonesLayers,
} from "./knowledge-network-slot-coverage";
import { ROW_SPECS } from "./knowledge-network-row-columns";
import { evaluateHardPublishGate } from "./knowledge-network-publish-gate";
import { isHardSlotIssueCode } from "./knowledge-network-hard-issue-codes";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

export type SlotQualityIssue = {
  slot: CanonicalKbSlot;
  code: string;
  message: string;
};

export type FullKbQualityResult = {
  /** Hard publish gate：空 row / 无法映射 / 明显幻觉等 */
  ok: boolean;
  hardGateOk: boolean;
  softWarnings: string[];
  /** @deprecated 使用 structureCoverage；内部 debug，不映射 Factor A */
  coverageScore: number;
  /** 结构覆盖度（slot coverage target 平均），仅 KB-CONFIG debug */
  structureCoverage: number;
  /** @deprecated 不再写入封面；仅 debug */
  publishCoverage: number;
  richContractMet: boolean;
  gapFirstSlots: CanonicalKbSlot[];
  /** @deprecated publish 不再依赖此项 */
  gapFirstPublishOk: boolean;
  slotScores: Record<CanonicalKbSlot, number>;
  slotLayers: Partial<Record<CanonicalKbSlot, SlotCoverageLayers>>;
  issues: SlotQualityIssue[];
  repairHints: string[];
  emptyRowIssues: EmptyRowIssue[];
  unmappedRowIssues: UnmappedRowIssue[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function textLen(v: unknown): number {
  if (typeof v !== "string") return 0;
  return v.trim().length;
}

function meaningfulGaps(payload: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const gaps = payload[key];
    if (!Array.isArray(gaps)) continue;
    const n = gaps.filter(
      (g) => isRecord(g) && isMeaningfulCell(g.text ?? g.message ?? g.note),
    ).length;
    if (n > 0) return n;
  }
  return 0;
}

function narrativeParagraphs(payload: Record<string, unknown>, key: string): number {
  const blocks = payload[key];
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((n, b) => {
    if (!isRecord(b)) return n;
    const ps = b.paragraphs;
    return n + (Array.isArray(ps) ? ps.filter((p) => textLen(p) > 20).length : 0);
  }, 0);
}

function validRows(payload: Record<string, unknown>, ...keys: string[]): number {
  let max = 0;
  for (const key of keys) {
    max = Math.max(max, countValidRows(payload[key]));
  }
  return max;
}

function validRowsForSpec(payload: Record<string, unknown>, field: string, specKey: keyof typeof ROW_SPECS): number {
  return countValidRowsForColumns(payload[field], ROW_SPECS[specKey].columns);
}

function richRowsForSpec(payload: Record<string, unknown>, field: string, specKey: keyof typeof ROW_SPECS): number {
  return countRichRowsForSpec(payload[field], ROW_SPECS[specKey]);
}

function evaluateSlot(
  slot: CanonicalKbSlot,
  payload: unknown,
): { score: number; issues: SlotQualityIssue[]; layers?: SlotCoverageLayers } {
  const issues: SlotQualityIssue[] = [];
  if (!isRecord(payload)) {
    return {
      score: 0,
      issues: [{ slot, code: "payload_missing", message: "payload 须为对象" }],
    };
  }
  const p = payload;
  let score = 0;
  let maxScore = 0;
  const need = (cond: boolean, points: number, code: string, message: string) => {
    maxScore += points;
    if (cond) score += points;
    else issues.push({ slot, code, message });
  };

  switch (slot) {
    case "snapshot": {
      const layers = evaluateSnapshotLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "target-overview": {
      const layers = evaluateTargetOverviewLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "industry-market": {
      const layers = evaluateIndustryMarketLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "business-operations": {
      const layers = evaluateBusinessOperationsLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "legal-ownership": {
      const layers = evaluateLegalOwnershipLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "regulatory-compliance": {
      const layers = evaluateRegulatoryComplianceLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "resource-network": {
      const layers = evaluateResourceNetworkLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "comps-benchmark": {
      const layers = evaluateCompsBenchmarkLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "valuation-returns": {
      const layers = evaluateValuationReturnsLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "diligence-gaps": {
      const layers = evaluateDiligenceGapsLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "risks-mitigation": {
      const layers = evaluateRisksMitigationLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "timeline-milestones": {
      const layers = evaluateTimelineMilestonesLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    case "decision-framework": {
      const layers = evaluateDecisionFrameworkLayers(p);
      return { score: layers.score, issues: layers.issues, layers };
    }
    default:
      break;
  }

  const normalized = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score: normalized, issues };
}

/** 单 slot Quality Contract 评估（slot-batched 生成用） */
export function evaluateSlotQuality(
  slot: CanonicalKbSlot,
  payload: unknown,
): {
  score: number;
  /** coverage target 通过（fact + gap rows） */
  ok: boolean;
  /** 无幻觉/空 payload 等 hard issue */
  hardOk: boolean;
  issues: SlotQualityIssue[];
  factCoverage?: number;
  gapCoverage?: number;
  gapFirstMode?: boolean;
} {
  const ev = evaluateSlot(slot, payload);
  const hardOk = !ev.issues.some((i) => isHardSlotIssueCode(i.code));
  if (ev.layers) {
    return {
      score: ev.layers.score,
      ok: ev.layers.pass && hardOk,
      hardOk,
      issues: ev.issues,
      factCoverage: ev.layers.factCoverage,
      gapCoverage: ev.layers.gapCoverage,
      gapFirstMode: ev.layers.gapFirstMode,
    };
  }
  const ok = ev.score >= 55 && ev.issues.length <= 2 && hardOk;
  return { score: ev.score, ok, hardOk, issues: ev.issues };
}

const RICH_SLOT_THRESHOLD = 85;

export function validateFullStructuredKbQuality(data: StructuredKbData): FullKbQualityResult {
  const slotScores = {} as Record<CanonicalKbSlot, number>;
  const slotLayers: Partial<Record<CanonicalKbSlot, SlotCoverageLayers>> = {};
  const gapFirstSlots: CanonicalKbSlot[] = [];
  const issues: SlotQualityIssue[] = [];
  const repairHints: string[] = [];
  const emptyRowIssues: EmptyRowIssue[] = [];
  const unmappedRowIssues: UnmappedRowIssue[] = [];

  const normSoftWarnings: string[] = [];

  for (const slot of CANONICAL_KB_SLOTS) {
    const rawPayload = data.slots[slot as keyof SlotPayloadBySlot];
    const { payload, warnings: normWarnings } = normalizeSlotPayload(slot, rawPayload);
    for (const w of normWarnings) {
      if (w.code === "dropped_empty_row" || w.code === "component_gap_callout") {
        normSoftWarnings.push(`${slot}: ${w.message}`);
      }
    }
    const ev = evaluateSlot(slot, payload);
    slotScores[slot] = ev.score;
    if (ev.layers) {
      slotLayers[slot] = ev.layers;
      if (ev.layers.gapFirstMode) gapFirstSlots.push(slot);
      if (!ev.layers.pass) {
        if (slot === "legal-ownership" || slot === "regulatory-compliance") {
          repairHints.push(buildGapFirstRepairHint(slot, ev.layers));
        } else if (
          slot === "resource-network" ||
          slot === "comps-benchmark" ||
          slot === "valuation-returns"
        ) {
          repairHints.push(buildBatch3CoverageRepairHint(slot, ev.layers));
        } else {
          repairHints.push(buildSlotCoverageRepairHint(slot, ev.layers));
        }
      }
    }
    issues.push(...ev.issues);
    for (const issue of ev.issues) {
      repairHints.push(`${slot}: ${issue.message}`);
    }
    const residualEmpty = findResidualEmptyRowsInNormalized(slot, payload);
    for (const re of residualEmpty) {
      emptyRowIssues.push({ path: re.path, index: 0, fillRatio: 0 });
    }
    const residualUnmapped = findResidualUnmappedInNormalized(slot, payload);
    for (const ru of residualUnmapped) {
      const sampleKeys =
        ru.message.match(/keys: ([^)]+)/)?.[1]?.split(", ").filter(Boolean) ?? [];
      unmappedRowIssues.push({ path: ru.path, index: 0, sampleKeys });
      issues.push({ slot, code: "unmapped_row_keys", message: ru.message });
    }
  }

  for (const er of emptyRowIssues) {
    repairHints.push(`空/无效 row: ${er.path}（填充率 ${er.fillRatio}%）→ 转结构化 gap row 或删除空对象，勿留空 cell`);
  }
  for (const ur of unmappedRowIssues) {
    repairHints.push(
      `字段无法映射: ${ur.path}（keys: ${ur.sampleKeys.join(", ")}）→ 改用 canonical 列名或补 alias`,
    );
  }

  const coverageScore = Math.round(
    CANONICAL_KB_SLOTS.reduce((sum, s) => sum + slotScores[s], 0) / CANONICAL_KB_SLOTS.length,
  );

  const richContractMet =
    emptyRowIssues.length === 0 &&
    unmappedRowIssues.length === 0 &&
    CANONICAL_KB_SLOTS.every((s) => slotScores[s] >= RICH_SLOT_THRESHOLD);

  let publishCoverage = coverageScore;
  if (emptyRowIssues.length > 0 || unmappedRowIssues.length > 0) {
    publishCoverage = Math.min(publishCoverage, 92);
  }
  if (richContractMet) {
    publishCoverage = 100;
  } else {
    publishCoverage = Math.min(publishCoverage, 99);
  }

  const slotPass = (s: CanonicalKbSlot): boolean => {
    const layers = slotLayers[s];
    if (layers) return layers.pass;
    return slotScores[s] >= 55;
  };

  const allSlotsPass = CANONICAL_KB_SLOTS.every(slotPass);
  const gapFirstPublishOk =
    emptyRowIssues.length === 0 &&
    unmappedRowIssues.length === 0 &&
    allSlotsPass &&
    gapFirstSlots.length > 0;

  const failingSlots = CANONICAL_KB_SLOTS.filter((s) => !slotPass(s)).length;

  const partial: FullKbQualityResult = {
    ok: false,
    hardGateOk: false,
    softWarnings: [],
    coverageScore,
    structureCoverage: coverageScore,
    publishCoverage,
    richContractMet,
    gapFirstSlots,
    gapFirstPublishOk,
    slotScores,
    slotLayers,
    issues,
    repairHints,
    emptyRowIssues,
    unmappedRowIssues,
  };
  const { hardGateOk, softWarnings } = evaluateHardPublishGate(partial);

  return {
    ...partial,
    hardGateOk,
    softWarnings: [...normSoftWarnings, ...softWarnings],
    ok: hardGateOk,
  };
}

export function buildStructuredKbRepairMessage(result: FullKbQualityResult): string {
  const emptyLines = result.emptyRowIssues.slice(0, 6).map((e) => `${e.path}（${e.fillRatio}% 填充）`);
  const unmappedLines = result.unmappedRowIssues
    .slice(0, 6)
    .map((u) => `${u.path}（keys: ${u.sampleKeys.join(", ")}）`);
  const hardLines = result.issues
    .filter((i) => isHardSlotIssueCode(i.code))
    .slice(0, 6)
    .map((i) => `${i.slot}: ${i.message}`);
  const structuralLines = result.repairHints
    .filter((h) => !h.startsWith("空/无效") && !h.startsWith("字段无法映射"))
    .slice(0, 6);
  const parts = [
    "structured-kb-data 未通过 Worker **hard publish gate**（与 Factor A / maturity / qualityCoverage 无关）。",
    "目标：事实可追溯、缺口清楚、结构稳定；资料不足补 gap rows，禁止编造。",
    "禁止输出空 row；row 字段须可被 Worker 列别名映射。",
  ];
  if (hardLines.length) {
    parts.push(`\n【明显幻觉 / 禁止编造】\n- ${hardLines.join("\n- ")}`);
  }
  if (emptyLines.length) {
    parts.push(`\n【空表格/无效 row】\n- ${emptyLines.join("\n- ")}`);
  }
  if (unmappedLines.length) {
    parts.push(`\n【字段无法映射】\n- ${unmappedLines.join("\n- ")}`);
  }
  if (structuralLines.length) {
    parts.push(`\n【coverage target / 缺字段】\n- ${structuralLines.join("\n- ")}`);
  }
  parts.push("\n请修 envelope / 缺字段 / 空表 / 引用 / gap rows 后重新交付 structured-slot-batch JSON（勿为分数补假事实）。");
  return parts.join("");
}

/** 批次 slot 结构 repair（coverage target），不含分数目标 */
export function buildSlotBatchStructuralRepairMessage(
  slot: CanonicalKbSlot,
  issues: SlotQualityIssue[],
): string {
  const lines = issues.slice(0, 8).map((i) => `${i.code}: ${i.message}`);
  return (
    `${slot} · 结构 repair（coverage target = fact + gap rows，非 hard factual minimum）。` +
    `补 gap rows / requiredEvidence / decisionImpact / nextAction；勿为提高 Evidence Maturity 编造事实。` +
    (lines.length ? `\n- ${lines.join("\n- ")}` : "")
  );
}
