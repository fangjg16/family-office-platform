import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  countValidRows,
  countValidRowsForColumns,
  findEmptyRowIssuesInPayload,
  isMeaningfulCell,
  isValidTableRow,
  type EmptyRowIssue,
} from "./knowledge-network-content-row-quality";
import { ROW_COLUMNS } from "./knowledge-network-row-columns";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

export type SlotQualityIssue = {
  slot: CanonicalKbSlot;
  code: string;
  message: string;
};

export type FullKbQualityResult = {
  ok: boolean;
  /** 原始 slot 平均分（内容质量加权） */
  coverageScore: number;
  /** 写入 KB-CONFIG 的 coverage；100 仅当全部 slot 达 rich contract 且无空 row */
  publishCoverage: number;
  richContractMet: boolean;
  slotScores: Record<CanonicalKbSlot, number>;
  issues: SlotQualityIssue[];
  repairHints: string[];
  emptyRowIssues: EmptyRowIssue[];
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

function validRowsForColumns(
  payload: Record<string, unknown>,
  field: string,
  columns: readonly (readonly string[])[],
): number {
  return countValidRowsForColumns(payload[field], columns);
}

function rowsWithAnalysis(payload: Record<string, unknown>, key: string, analysisKeys: string[]): number {
  const arr = payload[key];
  if (!Array.isArray(arr)) return 0;
  return arr.filter((r) => {
    if (!isRecord(r) || !isValidTableRow(r)) return false;
    return analysisKeys.some((k) => isMeaningfulCell(r[k]));
  }).length;
}

function evaluateSlot(slot: CanonicalKbSlot, payload: unknown): { score: number; issues: SlotQualityIssue[] } {
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
      need(textLen(p.stage) > 0, 8, "stage", "缺少 stage/阶段");
      need(textLen(p.status) > 0, 8, "status", "缺少 status/状态");
      need(validRows(p, "keyFacts") >= 6, 20, "keyFacts", "keyFacts 至少 6 条有效行");
      need(
        textLen(p.oneLineJudgment) >= 20 || narrativeParagraphs(p, "overview") >= 1,
        12,
        "judgment",
        "缺少 oneLineJudgment 或 overview 叙述",
      );
      need(meaningfulGaps(p, "gaps") >= 1, 12, "gaps", "须列出资料缺口 callout");
      break;
    }
    case "target-overview": {
      need(validRows(p, "assetSummary") >= 3, 25, "assetSummary", "assetSummary 至少 3 条有效行");
      need(
        validRowsForColumns(p, "keyClaims", ROW_COLUMNS.keyClaims) >= 2 ||
          narrativeParagraphs(p, "businessSummary") >= 2,
        20,
        "claims",
        "缺少有效 keyClaims 或 businessSummary 段落",
      );
      need(
        meaningfulGaps(p, "gaps") >= 1 ||
          rowsWithAnalysis(p, "keyClaims", ["依据", "缺口", "evidence", "gap"]) >= 1,
        10,
        "gaps",
        "须列出证据/缺口",
      );
      break;
    }
    case "industry-market": {
      need(
        rowsWithAnalysis(p, "marketDrivers", ["投资含义", "implication", "analysis"]) >= 3 ||
          rowsWithAnalysis(p, "marketSize", ["投资含义", "implication", "analysis"]) >= 3,
        25,
        "drivers",
        "marketDrivers 至少 3 条含投资含义的有效行",
      );
      need(validRowsForColumns(p, "valueChain", ROW_COLUMNS.valueChain) >= 2, 15, "valueChain", "valueChain 至少 2 条有效行");
      need(
        validRows(p, "policyContext") >= 1 || validRows(p, "comparableSignals") >= 1,
        10,
        "policy",
        "缺少有效政策或可比信号行",
      );
      need(meaningfulGaps(p, "gaps") >= 1, 10, "gaps", "须列出行业资料缺口");
      break;
    }
    case "business-operations": {
      const journeyStages = isRecord(p.journeyMap) ? arrLen(p.journeyMap.stages) : 0;
      const journeyValid =
        journeyStages >= 2 &&
        (isRecord(p.journeyMap) &&
          (p.journeyMap.stages as unknown[]).filter((s) => isMeaningfulCell(s)).length >= 2);
      need(journeyValid, 20, "journey", "须含 journeyMap（≥2 有效 stages）");
      need(
        validRowsForColumns(p, "revenueTree", ROW_COLUMNS.revenueTree) >= 2 || narrativeParagraphs(p, "flywheel") >= 1,
        15,
        "revenue",
        "缺少有效 revenueTree 或 flywheel",
      );
      need(validRows(p, "customerBuyer") >= 2, 15, "customer", "customerBuyer 至少 2 条有效行");
      need(
        validRows(p, "pricing") >= 1 ||
          validRows(p, "operatingBottlenecks", "supplyChain") >= 1,
        10,
        "ops",
        "缺少有效定价/供应链/瓶颈行",
      );
      need(meaningfulGaps(p, "gaps") >= 1, 10, "gaps", "须列运营资料缺口");
      break;
    }
    case "legal-ownership": {
      need(validRows(p, "entities", "ownershipClaims") >= 2, 25, "entities", "entities 至少 2 条有效行");
      need(
        validRows(p, "contractRights", "licenseRights") >= 1 || arrLen(p.relationshipEdges) >= 1,
        15,
        "rights",
        "缺少有效合同/IP 行或关系边",
      );
      need(meaningfulGaps(p, "unresolvedLegalIssues", "gaps") >= 1, 10, "legal_gaps", "须列未决法律问题/缺口");
      break;
    }
    case "regulatory-compliance": {
      need(
        validRows(p, "jurisdictionRows", "complianceRisks") >= 2,
        25,
        "jurisdiction",
        "监管 rows 至少 2 条有效行",
      );
      need(
        validRows(p, "licenseRequirements", "approvalPath") >= 1,
        15,
        "license",
        "缺少有效许可/审批路径行",
      );
      need(meaningfulGaps(p, "gaps") >= 1, 10, "gaps", "须列合规缺口");
      break;
    }
    case "resource-network": {
      need(validRows(p, "parties", "resources") >= 3, 25, "parties", "parties 至少 3 条有效行");
      need(
        validRows(p, "capabilities", "dependencies") >= 1 || arrLen(p.relationshipEdges) >= 1,
        15,
        "capabilities",
        "缺少有效能力/依赖行",
      );
      need(meaningfulGaps(p, "missingResources", "gaps") >= 1, 10, "missing", "须列缺失资源");
      break;
    }
    case "comps-benchmark": {
      need(validRows(p, "compsRows") >= 2, 25, "comps", "compsRows 至少 2 条有效行");
      need(
        validRows(p, "transactionCases", "benchmarkMetrics") >= 1,
        15,
        "transactions",
        "缺少有效交易案例或指标行",
      );
      need(meaningfulGaps(p, "relevanceNotes", "gaps") >= 1, 10, "notes", "须说明可比适用性/缺口");
      break;
    }
    case "valuation-returns": {
      const scenarios = Array.isArray(p.scenarios) ? p.scenarios : [];
      const validScenarios = scenarios.filter(
        (s) =>
          isRecord(s) &&
          isMeaningfulCell(s.label) &&
          isMeaningfulCell(s.value ?? s.irr ?? s.multiple),
      ).length;
      need(validScenarios >= 3, 25, "scenarios", "scenarios 须含 base/upside/downside 共 ≥3 有效项");
      need(validRows(p, "sensitivityItems") >= 2, 15, "sensitivity", "sensitivityItems 至少 2 条有效行");
      need(
        validRows(p, "investmentCashflow", "returnDrivers", "downsideCases") >= 1,
        10,
        "cashflow",
        "缺少有效投资人现金流/下行情景行",
      );
      need(meaningfulGaps(p, "gaps") >= 1, 10, "gaps", "须列估值缺口");
      break;
    }
    case "diligence-gaps": {
      const groups = Array.isArray(p.questionGroups) ? p.questionGroups : [];
      const priorities = new Set(groups.map((g) => (isRecord(g) ? String(g.priority ?? "") : "")));
      need(groups.length >= 2, 20, "groups", "questionGroups 至少 2 组");
      need(priorities.has("P1") || priorities.has("最高"), 15, "p1", "须含 P1/最高优先级组");
      const qCount = groups.reduce((n, g) => {
        if (!isRecord(g)) return n;
        return n + countValidRows(g.questions);
      }, 0);
      need(qCount >= 5, 25, "questions", "尽调问题至少 5 条有效行");
      break;
    }
    case "risks-mitigation": {
      need(validRows(p, "riskRows") >= 5, 35, "risks", "riskRows 至少 5 条有效行");
      const withMitigation = (Array.isArray(p.riskRows) ? p.riskRows : []).filter(
        (r) => isRecord(r) && isValidTableRow(r) && isMeaningfulCell(r.mitigation),
      ).length;
      need(withMitigation >= 3, 15, "mitigation", "至少 3 条风险含有效缓释措施");
      break;
    }
    case "timeline-milestones": {
      const occurred = countValidRows(p.occurred);
      const inProgress = countValidRows(p.inProgress);
      const future = countValidRows(p.future);
      const total = occurred + inProgress + future;
      need(total >= 3, 25, "timeline_nodes", "timeline 至少 3 个有效节点");
      need(occurred >= 1, 10, "occurred", "须含已发生节点");
      need(future >= 1 || inProgress >= 1, 10, "forward", "须含推进中或未来节点");
      break;
    }
    case "decision-framework": {
      need(textLen(p.recommendation) >= 15, 20, "recommendation", "缺少 recommendation");
      need(validRows(p, "decisionTable") >= 2, 20, "decisionTable", "decisionTable 至少 2 条有效行");
      need(validRows(p, "nextActions") >= 2, 20, "nextActions", "nextActions 至少 2 条有效行");
      need(
        validRowsForColumns(p, "goNoGoConditions", ROW_COLUMNS.goNoGoConditions) >= 1 ||
          validRows(p, "triggers") >= 1,
        10,
        "conditions",
        "缺少有效 go/no-go 或触发条件行",
      );
      break;
    }
    default:
      break;
  }

  const normalized = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score: normalized, issues };
}

const RICH_SLOT_THRESHOLD = 85;

export function validateFullStructuredKbQuality(data: StructuredKbData): FullKbQualityResult {
  const slotScores = {} as Record<CanonicalKbSlot, number>;
  const issues: SlotQualityIssue[] = [];
  const repairHints: string[] = [];
  const emptyRowIssues: EmptyRowIssue[] = [];

  for (const slot of CANONICAL_KB_SLOTS) {
    const payload = data.slots[slot as keyof SlotPayloadBySlot];
    const ev = evaluateSlot(slot, payload);
    slotScores[slot] = ev.score;
    issues.push(...ev.issues);
    for (const issue of ev.issues) {
      repairHints.push(`${slot}: ${issue.message}`);
    }
    emptyRowIssues.push(...findEmptyRowIssuesInPayload(slot, payload));
  }

  for (const er of emptyRowIssues) {
    repairHints.push(`空/无效 row: ${er.path}（填充率 ${er.fillRatio}%）→ 补有效内容或转 gap，勿留空对象`);
  }

  const coverageScore = Math.round(
    CANONICAL_KB_SLOTS.reduce((sum, s) => sum + slotScores[s], 0) / CANONICAL_KB_SLOTS.length,
  );

  const richContractMet =
    emptyRowIssues.length === 0 &&
    CANONICAL_KB_SLOTS.every((s) => slotScores[s] >= RICH_SLOT_THRESHOLD);

  let publishCoverage = coverageScore;
  if (emptyRowIssues.length > 0) {
    publishCoverage = Math.min(publishCoverage, 92);
  }
  if (richContractMet && emptyRowIssues.length === 0) {
    publishCoverage = 100;
  } else {
    publishCoverage = Math.min(publishCoverage, 99);
  }

  const failingSlots = CANONICAL_KB_SLOTS.filter((s) => slotScores[s] < 55).length;
  const ok =
    coverageScore >= 62 &&
    failingSlots <= 3 &&
    emptyRowIssues.length === 0 &&
    richContractMet;

  return {
    ok,
    coverageScore,
    publishCoverage,
    richContractMet,
    slotScores,
    issues,
    repairHints,
    emptyRowIssues,
  };
}

export function buildStructuredKbRepairMessage(result: FullKbQualityResult): string {
  const emptyLines = result.emptyRowIssues.slice(0, 6).map((e) => `${e.path}（${e.fillRatio}% 填充）`);
  const qualityLines = result.repairHints.filter((h) => !h.startsWith("空/无效")).slice(0, 6);
  const parts = [
    `structured-kb-data 未达 Full KB Quality Contract 2.0（coverage ${result.coverageScore}/100，publish ${result.publishCoverage}/100）。`,
    "禁止输出空 row / 空字符串占位；不知道就写 gaps，不要填空对象。",
  ];
  if (emptyLines.length) {
    parts.push(`\n【空表格/无效 row】\n- ${emptyLines.join("\n- ")}`);
  }
  if (qualityLines.length) {
    parts.push(`\n【字段/深度不足】\n- ${qualityLines.join("\n- ")}`);
  }
  parts.push("\n请补有效内容或转 gap 后重新交付 JSON（勿写 HTML）。");
  return parts.join("");
}
