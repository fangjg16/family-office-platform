import {
  countValidRowsForColumns,
  filterValidRowsForColumns,
  isGapMarkedRow,
  isMeaningfulCell,
  pickRowCell,
} from "./knowledge-network-content-row-quality";
import { normalizeGapCallouts } from "./knowledge-network-gap-callouts";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import { ROW_SPECS, type RowSpecKey } from "./knowledge-network-row-columns";

export type CoverageTargetLayers = {
  factCoverage: number;
  gapCoverage: number;
  /** fact + gap 合计占 target 的覆盖率 */
  totalCoverage: number;
  gapFirstMode: boolean;
  pass: boolean;
  score: number;
  issues: SlotQualityIssue[];
};

export function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord);
}

export { isGapMarkedRow } from "./knowledge-network-content-row-quality";

export function splitFactAndGapRows(
  rows: unknown,
  specKey: RowSpecKey,
): { factRows: Record<string, unknown>[]; gapRows: Record<string, unknown>[] } {
  const columns = ROW_SPECS[specKey].columns;
  const valid = filterValidRowsForColumns(rows as never, columns);
  const factRows: Record<string, unknown>[] = [];
  const gapRows: Record<string, unknown>[] = [];
  for (const row of valid) {
    const r = row as Record<string, unknown>;
    if (isGapMarkedRow(r)) gapRows.push(r);
    else factRows.push(r);
  }
  return { factRows, gapRows };
}

export function countGapCallouts(payload: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const gaps = normalizeGapCallouts(payload[key]);
    if (gaps.length > 0) return gaps.length;
  }
  return 0;
}

const FABRICATED_IRR_RE = /\b(IRR|MOIC|X+\s*return)\b/i;
const QUANTIFIED_RETURN_RE = /^\s*\d+(\.\d+)?\s*%?\s*$/;

/** 缺投资输入时禁止量化回报 */
export function hasFabricatedReturnMetrics(payload: Record<string, unknown>): boolean {
  const hasInputs =
    asRows(payload.investmentCashflow).some((r) => {
      const amt = pickRowCell(r, ["金额/比例", "amount", "ratio", "value"]);
      return isMeaningfulCell(amt) && !/^[-—–]|待确认|—/i.test(amt);
    }) ||
    isMeaningfulCell(payload.investmentAmount) ||
    isMeaningfulCell(payload.valuation) ||
    isMeaningfulCell(payload.equityStake);

  if (hasInputs) return false;

  for (const s of asRows(payload.scenarios)) {
    const val = pickRowCell(s, ["value", "valueLabel", "回报", "irr", "moic"]);
    const detail = pickRowCell(s, ["detail", "说明", "notes"]);
    const blob = `${val} ${detail}`;
    if (FABRICATED_IRR_RE.test(blob) && !/无法量化|待建模|gap|缺口|待确认/i.test(blob)) {
      if (QUANTIFIED_RETURN_RE.test(val)) return true;
      if (/\d+\s*%/.test(val) && !/±|bps|区间/i.test(val)) return true;
    }
  }
  return false;
}

export function buildCoverageLayers(params: {
  slot: import("./knowledge-network-slot-aliases").CanonicalKbSlot;
  target: number;
  factCount: number;
  gapCount: number;
  minGapForGapFirst?: number;
  minTotalCoveragePct?: number;
  scoreCapGapFirst?: number;
  extraIssues?: SlotQualityIssue[];
  factSufficient?: boolean;
}): CoverageTargetLayers {
  const {
    slot,
    target,
    factCount,
    gapCount,
    minGapForGapFirst = Math.max(3, Math.ceil(target * 0.75)),
    minTotalCoveragePct = 100,
    scoreCapGapFirst = 80,
    extraIssues = [],
    factSufficient,
  } = params;

  const coverageCount = factCount + gapCount;
  const factCoverage = clampPct((factCount / target) * 100);
  const gapCoverage = clampPct((gapCount / target) * 100);
  const totalCoverage = clampPct((coverageCount / target) * 100);

  const factOk = factSufficient ?? factCount >= Math.ceil(target * 0.5);
  const gapFirstMode = !factOk && gapCount >= minGapForGapFirst;

  const issues = [...extraIssues];
  if (coverageCount < target) {
    issues.push({
      slot,
      code: "coverage_target",
      message: `coverage target ${target} 未达（fact=${factCount} + gap=${gapCount} = ${coverageCount}）`,
    });
  }

  const pass =
    issues.length === 0 &&
    totalCoverage >= minTotalCoveragePct &&
    (factOk || (gapFirstMode && gapCoverage >= 75));

  let score: number;
  if (gapFirstMode) {
    score = clampPct(gapCoverage * 0.75 + factCoverage * 0.25);
    score = Math.min(score, scoreCapGapFirst);
  } else {
    score = clampPct(factCoverage * 0.7 + gapCoverage * 0.3);
  }

  return {
    factCoverage,
    gapCoverage,
    totalCoverage,
    gapFirstMode,
    pass,
    score,
    issues,
  };
}

/** 多维度 coverage target（Batch 3 等） */
export function mergeCoverageLayers(
  slot: import("./knowledge-network-slot-aliases").CanonicalKbSlot,
  parts: CoverageTargetLayers[],
  scoreCapGapFirst = 80,
): CoverageTargetLayers {
  if (!parts.length) {
    return {
      factCoverage: 0,
      gapCoverage: 0,
      totalCoverage: 0,
      gapFirstMode: false,
      pass: false,
      score: 0,
      issues: [{ slot, code: "empty", message: "无 coverage 维度" }],
    };
  }
  const factCoverage = clampPct(parts.reduce((s, p) => s + p.factCoverage, 0) / parts.length);
  const gapCoverage = clampPct(parts.reduce((s, p) => s + p.gapCoverage, 0) / parts.length);
  const totalCoverage = clampPct(parts.reduce((s, p) => s + p.totalCoverage, 0) / parts.length);
  const gapFirstMode = parts.some((p) => p.gapFirstMode);
  const issues = parts.flatMap((p) => p.issues);
  const pass = parts.every((p) => p.pass) && issues.length === 0;

  let score = clampPct(parts.reduce((s, p) => s + p.score, 0) / parts.length);
  if (gapFirstMode) score = Math.min(score, scoreCapGapFirst);

  return { factCoverage, gapCoverage, totalCoverage, gapFirstMode, pass, score, issues };
}

export function isStructuredResourceGapRow(row: Record<string, unknown>): boolean {
  return (
    isMeaningfulCell(pickRowCell(row, ["party", "主体", "party"])) &&
    isMeaningfulCell(pickRowCell(row, ["role", "角色", "role/capability"])) &&
    isMeaningfulCell(pickRowCell(row, ["gap", "缺口", "gap"])) &&
    isMeaningfulCell(pickRowCell(row, ["nextAction", "下一步", "nextAction"]))
  );
}

export function isStructuredComparableGapRow(row: Record<string, unknown>): boolean {
  return (
    isMeaningfulCell(pickRowCell(row, ["缺口", "gap", "缺口"])) &&
    isMeaningfulCell(pickRowCell(row, ["原因", "reason", "原因"])) &&
    isMeaningfulCell(pickRowCell(row, ["所需资料", "requiredEvidence", "所需资料"])) &&
    isMeaningfulCell(pickRowCell(row, ["对估值启示", "valuationImpact", "对估值启示"]))
  );
}

export function isStructuredCashflowGapRow(row: Record<string, unknown>): boolean {
  return (
    isMeaningfulCell(pickRowCell(row, ["缺口", "gap", "缺口"])) &&
    isMeaningfulCell(pickRowCell(row, ["原因", "reason", "原因"])) &&
    isMeaningfulCell(pickRowCell(row, ["所需资料", "requiredInputs", "所需资料"])) &&
    isMeaningfulCell(pickRowCell(row, ["下一步", "nextAction", "下一步"]))
  );
}

export function countStructuredRows(
  rows: unknown,
  predicate: (row: Record<string, unknown>) => boolean,
): number {
  return asRows(rows).filter(predicate).length;
}

export function countValidSpecRows(rows: unknown, specKey: RowSpecKey): number {
  return countValidRowsForColumns(rows, ROW_SPECS[specKey].columns);
}

/** 转为 gap-first-quality 共用的 SlotCoverageLayers */
export function toSlotCoverageLayers(l: CoverageTargetLayers): import("./knowledge-network-gap-first-quality").SlotCoverageLayers {
  return {
    factCoverage: l.factCoverage,
    gapCoverage: l.gapCoverage,
    gapFirstMode: l.gapFirstMode,
    pass: l.pass,
    score: l.score,
    issues: l.issues,
  };
}

export function splitRelationshipEdges(
  edges: unknown,
): { factRows: Record<string, unknown>[]; gapRows: Record<string, unknown>[] } {
  const factRows: Record<string, unknown>[] = [];
  const gapRows: Record<string, unknown>[] = [];
  for (const row of asRows(edges)) {
    const status = pickRowCell(row, ["status", "状态", "证据/缺口", "evidence"]);
    if (isGapMarkedRow(row) || /缺口|待确认|未提供|gap/i.test(status)) {
      gapRows.push(row);
    } else if (
      isMeaningfulCell(pickRowCell(row, ["relation", "关系/合作", "edge"])) ||
      isMeaningfulCell(row.from)
    ) {
      factRows.push(row);
    }
  }
  return { factRows, gapRows };
}

/** 单表 coverage target 评估 */
export function evaluateTableCoverageTarget(params: {
  slot: import("./knowledge-network-slot-aliases").CanonicalKbSlot;
  target: number;
  rows: unknown;
  specKey: RowSpecKey;
  extraGapCount?: number;
  minGapForGapFirst?: number;
  scoreCapGapFirst?: number;
  extraIssues?: SlotQualityIssue[];
  factSufficient?: boolean;
}): CoverageTargetLayers {
  const { factRows, gapRows } = splitFactAndGapRows(params.rows, params.specKey);
  return buildCoverageLayers({
    slot: params.slot,
    target: params.target,
    factCount: factRows.length,
    gapCount: gapRows.length + (params.extraGapCount ?? 0),
    minGapForGapFirst: params.minGapForGapFirst,
    scoreCapGapFirst: params.scoreCapGapFirst,
    extraIssues: params.extraIssues,
    factSufficient: params.factSufficient,
  });
}
