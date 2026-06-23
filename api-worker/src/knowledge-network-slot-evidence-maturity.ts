import { isGapMarkedRow, isRecord } from "./knowledge-network-coverage-target";
import { isMeaningfulCell, pickRowCell } from "./knowledge-network-content-row-quality";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import type {
  BusinessOperationsPayload,
  CompsBenchmarkPayload,
  DecisionFrameworkPayload,
  DiligenceGapsPayload,
  IndustryMarketPayload,
  LegalOwnershipPayload,
  RegulatoryCompliancePayload,
  ResourceNetworkPayload,
  RisksMitigationPayload,
  SnapshotPayload,
  TargetOverviewPayload,
  TimelineMilestonesPayload,
  ValuationReturnsPayload,
} from "./knowledge-network-structured-patch-types";

const GAP_CELL_RE = /^(缺口|待确认|未提供|待验证|gap|—|tbd|待定)$/i;
const QUANT_RE =
  /\d+(?:\.\d+)?\s*(?:%|万|亿|m|b|k)?|\$|¥|￥|million|billion|moic|dpi|irr|npv/i;
const DATE_RE = /\d{4}[-/年]\d{1,2}|Q[1-4]\s*\d{4}|\d{1,2}月\s*\d{4}/i;
const PRICE_RANGE_RE = /价格|估值|区间|indicative|price\s*range|报价|投资额/i;
const OWNERSHIP_TBD_RE = /tbd|待定|未定|待核实|权属|未明确|不清/i;
const SELLER_RETURN_RE = /高回报|high\s*return|丰厚回报|可观回报/i;
const SOURCE_RE =
  /(?:source-)?[AU]-\d+|公开|第三方|审计|政府|监管|合同|尽调|批复|执照|年报/i;
const PRIMARY_REG_RE =
  /政府|监管|登记|批复|执照|court|registry|regulator|primary|官方|主管部门/i;
const DELIVERABLE_RE = /交付|deliverable|产出|产能|吨|volume|产量/i;
const UNIT_PRICE_RE = /单价|unit\s*price|asp|arpu|客单价/i;
const METRIC_RE = /毛利|margin|周转|utilization|产能|销量|revenue|ebitda|现金流/i;
const NAMED_COMP_RE = /公司|corp|inc|ltd|集团|有限|交易|并购|收购|deal/i;

export type SlotEvidenceMaturity = {
  score: number;
  capApplied?: string;
};

export type FactorAResult = {
  /** 0–100 · mean of 13 core slot evidence-maturity scores */
  score: number;
  slotScores: Record<CanonicalKbSlot, number>;
  capsApplied: string[];
  note: string;
};

function clamp(n: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function capScore(score: number, cap: number): number {
  return Math.min(score, cap);
}

function payloadBlob(payload: unknown): string {
  try {
    return JSON.stringify(payload ?? "");
  } catch {
    return "";
  }
}

function hasQuantified(text: string): boolean {
  return QUANT_RE.test(text);
}

function isEmptyPayload(payload: unknown): boolean {
  if (payload == null || !isRecord(payload)) return true;
  const keys = Object.keys(payload);
  if (keys.length === 0) return true;
  const blob = payloadBlob(payload).replace(/\s/g, "");
  return blob.length < 12 || blob === "{}";
}

function stubBase(payload: unknown): number {
  return isEmptyPayload(payload) ? 0 : 12;
}

function nonGapRowCount(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) => isRecord(r) && !isGapMarkedRow(r)).length;
}

function rowsHaveSourcedData(rows: unknown): boolean {
  if (!Array.isArray(rows)) return false;
  return rows.some((r) => {
    if (!isRecord(r) || isGapMarkedRow(r)) return false;
    const evidence = pickRowCell(r, [
      "evidence",
      "证据",
      "证据/来源",
      "basis",
      "source",
      "cite",
      "currentEvidence",
      "现有证据",
    ]);
    if (SOURCE_RE.test(evidence)) return true;
    return isMeaningfulCell(evidence) && !GAP_CELL_RE.test(evidence);
  });
}

function hasNamedCounterparty(p: ResourceNetworkPayload): boolean {
  const parties = nonGapRowCount(p.parties);
  if (parties > 0) {
    const named = (p.parties ?? []).some((r) => {
      const name = pickRowCell(r as Record<string, unknown>, [
        "party",
        "主体",
        "名称",
        "公司",
        "name",
        "counterparty",
      ]);
      return isMeaningfulCell(name) && !GAP_CELL_RE.test(name);
    });
    if (named) return true;
  }
  const edges = (p.relationshipEdges ?? []).filter(
    (e) =>
      isMeaningfulCell(e.from) &&
      isMeaningfulCell(e.to) &&
      !GAP_CELL_RE.test(e.from) &&
      !GAP_CELL_RE.test(e.to),
  );
  return edges.length > 0;
}

export function valuationHasQuantifiedReturns(data: StructuredKbData): boolean {
  const p = data.slots["valuation-returns"] as ValuationReturnsPayload | undefined;
  if (!p) return false;
  const blob = payloadBlob(p);
  const hasInvestment =
    /投资|invest|出资|ticket|commitment|投资额|对价/i.test(blob) && hasQuantified(blob);
  const hasReturn =
    /irr|moic|回报|收益率|npv|dpi/i.test(blob) &&
    hasQuantified(blob) &&
    !/待建模|无法量化|gap/i.test(blob);
  return hasInvestment || hasReturn;
}

function scoreSnapshot(p: SnapshotPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  if (isMeaningfulCell(p!.stage)) score += 4;
  if (isMeaningfulCell(p!.oneLineJudgment)) score += 4;
  if (nonGapRowCount(p!.keyFacts) > 0) score += 8;
  const blob = payloadBlob(p);
  const hasPrice = PRICE_RANGE_RE.test(blob) && hasQuantified(blob);
  if (!hasPrice) {
    return {
      score: capScore(score, 40),
      capApplied: "snapshot: 无 indicative price/range → cap 40%",
    };
  }
  return { score: clamp(score) };
}

function scoreTargetOverview(p: TargetOverviewPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  const blob = payloadBlob(p);
  const hasNumbersOrDeliverables =
    hasQuantified(blob) || DELIVERABLE_RE.test(blob) || nonGapRowCount(p!.assetSummary) >= 2;
  if (!hasNumbersOrDeliverables) {
    return {
      score: capScore(score, 30),
      capApplied: "target-overview: 无数字/交付物 → cap 30%",
    };
  }
  if (rowsHaveSourcedData(p!.keyClaims)) score += 10;
  return { score: clamp(score) };
}

function scoreResourceNetwork(p: ResourceNetworkPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  if (!hasNamedCounterparty(p!)) {
    return {
      score: capScore(score, 20),
      capApplied: "resource-network: 无命名对手方/关系强度 → cap 20%",
    };
  }
  score += 10;
  return { score: clamp(score) };
}

function scoreIndustryMarket(p: IndustryMarketPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  const sourced =
    rowsHaveSourcedData(p!.marketSize) ||
    rowsHaveSourcedData(p!.marketDrivers) ||
    rowsHaveSourcedData(p!.comparableSignals);
  if (!sourced) {
    return {
      score: capScore(score, 20),
      capApplied: "industry-market: 纯观点无 sourced data → cap 20%",
    };
  }
  score += 12;
  return { score: clamp(score) };
}

function scoreBusinessOperations(p: BusinessOperationsPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  const blob = payloadBlob(p);
  const hasHardOps =
    (UNIT_PRICE_RE.test(blob) && hasQuantified(blob)) ||
    nonGapRowCount(p!.customerBuyer) > 0 ||
    (METRIC_RE.test(blob) && hasQuantified(blob));
  if (!hasHardOps) {
    return {
      score: capScore(score, 30),
      capApplied: "business-operations: 无单价/客户证据/运营指标 → cap 30%",
    };
  }
  score += 10;
  return { score: clamp(score) };
}

function scoreLegalOwnership(p: LegalOwnershipPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  const blob = payloadBlob(p);
  const entitiesEmpty = nonGapRowCount(p!.entities) === 0;
  const ownershipTbd =
    entitiesEmpty ||
    OWNERSHIP_TBD_RE.test(blob) ||
    (p!.unresolvedLegalIssues?.length ?? 0) >= 3;
  if (ownershipTbd) {
    return {
      score: capScore(score, 20),
      capApplied: "legal-ownership: 权属未定 → cap 20%",
    };
  }
  score += 12;
  return { score: clamp(score) };
}

function scoreRegulatoryCompliance(
  p: RegulatoryCompliancePayload | undefined,
): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  const blob = payloadBlob(p);
  const hasPrimary =
    rowsHaveSourcedData(p!.jurisdictionRows) ||
    rowsHaveSourcedData(p!.licenseRequirements) ||
    PRIMARY_REG_RE.test(blob);
  if (!hasPrimary) {
    return {
      score: capScore(score, 30),
      capApplied: "regulatory-compliance: 无 primary-source status → cap 30%",
    };
  }
  score += 10;
  return { score: clamp(score) };
}

function scoreCompsBenchmark(p: CompsBenchmarkPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  const namedComps = (p!.compsRows ?? []).filter((r) => {
    if (!isRecord(r) || isGapMarkedRow(r)) return false;
    const blob = payloadBlob(r);
    return NAMED_COMP_RE.test(blob) && isMeaningfulCell(pickRowCell(r, Object.keys(r)));
  });
  const namedTx = nonGapRowCount(p!.transactionCases);
  if (namedComps.length === 0 && namedTx === 0) {
    return {
      score: 0,
      capApplied: "comps-benchmark: 无可比案例/交易 → 0%",
    };
  }
  return { score: clamp(stubBase(p) + 15 + namedComps.length * 5) };
}

function scoreValuationReturns(p: ValuationReturnsPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  const blob = payloadBlob(p);
  const hasInvestment =
    /投资|invest|出资|ticket|commitment|投资额|对价/i.test(blob) && hasQuantified(blob);
  const hasReturn =
    /irr|moic|回报|收益率|npv|dpi/i.test(blob) &&
    hasQuantified(blob) &&
    !/待建模|无法量化/i.test(blob);
  if (!hasInvestment && !hasReturn) {
    const sellerOnly = SELLER_RETURN_RE.test(blob) && !hasQuantified(blob);
    return {
      score: sellerOnly ? 0 : 5,
      capApplied: "valuation-returns: 无投资额+无量化回报 → ≤5%",
    };
  }
  let score = stubBase(p) + 18;
  if (hasInvestment && hasReturn) score += 12;
  return { score: clamp(score) };
}

function scoreDiligenceGaps(p: DiligenceGapsPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p) || !p!.questionGroups?.length) return { score: 0 };
  let score = stubBase(p);
  const questions = p!.questionGroups.flatMap((g) => g.questions ?? []);
  if (questions.length === 0) return { score: 0 };
  const concrete = questions.filter((q) => {
    const hasOwner = isMeaningfulCell(q.owner);
    const hasEvidence = isMeaningfulCell(q.requiredEvidence);
    const hasUrgency = isMeaningfulCell(q.priority) || isMeaningfulCell(q.whyItMatters);
    return hasOwner && (hasEvidence || hasUrgency);
  });
  if (concrete.length < Math.min(3, questions.length)) {
    return {
      score: capScore(score, 15),
      capApplied: "diligence-gaps: 泛化尽调清单 → cap 15%",
    };
  }
  score += 8;
  return { score: clamp(score) };
}

function scoreRisksMitigation(p: RisksMitigationPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p) || !p!.riskRows?.length) return { score: 0 };
  let score = stubBase(p);
  const rows = p!.riskRows;
  const concrete = rows.filter((r) => {
    const hasImpact = isMeaningfulCell(r.impact);
    const hasMitigation = isMeaningfulCell(r.mitigation);
    const hasEvidence = (r.evidenceSourceIds?.length ?? 0) > 0;
    const hasOwner = isMeaningfulCell(r.cause) || isMeaningfulCell(r.trigger);
    return hasImpact && hasMitigation && (hasEvidence || hasOwner);
  });
  if (concrete.length < Math.min(2, rows.length)) {
    return {
      score: capScore(score, 15),
      capApplied: "risks-mitigation: 泛化风险列表 → cap 15%",
    };
  }
  score += 10;
  return { score: clamp(score) };
}

function scoreTimelineMilestones(p: TimelineMilestonesPayload | undefined): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  const items = [...(p!.occurred ?? []), ...(p!.inProgress ?? []), ...(p!.future ?? [])];
  const dated = items.filter(
    (t) => isMeaningfulCell(t.title) && (DATE_RE.test(t.date ?? "") || DATE_RE.test(t.detail)),
  );
  if (dated.length === 0) {
    return {
      score: capScore(stubBase(p), 25),
      capApplied: "timeline-milestones: 无 dated 项目节点 → cap 25%",
    };
  }
  return { score: clamp(stubBase(p) + 10 + dated.length * 4) };
}

function scoreDecisionFramework(
  p: DecisionFrameworkPayload | undefined,
  data: StructuredKbData,
): SlotEvidenceMaturity {
  if (isEmptyPayload(p)) return { score: 0 };
  let score = stubBase(p);
  if (!valuationHasQuantifiedReturns(data)) {
    return {
      score: capScore(score, 20),
      capApplied: "decision-framework: 无 quantified valuation-returns → cap 20%",
    };
  }
  if (nonGapRowCount(p!.decisionTable) > 0) score += 8;
  return { score: clamp(score) };
}

export function scoreSlotEvidenceMaturity(
  slot: CanonicalKbSlot,
  data: StructuredKbData,
): SlotEvidenceMaturity {
  const slots = data.slots;
  switch (slot) {
    case "snapshot":
      return scoreSnapshot(slots.snapshot);
    case "target-overview":
      return scoreTargetOverview(slots["target-overview"]);
    case "industry-market":
      return scoreIndustryMarket(slots["industry-market"]);
    case "business-operations":
      return scoreBusinessOperations(slots["business-operations"]);
    case "resource-network":
      return scoreResourceNetwork(slots["resource-network"]);
    case "legal-ownership":
      return scoreLegalOwnership(slots["legal-ownership"]);
    case "regulatory-compliance":
      return scoreRegulatoryCompliance(slots["regulatory-compliance"]);
    case "comps-benchmark":
      return scoreCompsBenchmark(slots["comps-benchmark"]);
    case "valuation-returns":
      return scoreValuationReturns(slots["valuation-returns"]);
    case "diligence-gaps":
      return scoreDiligenceGaps(slots["diligence-gaps"]);
    case "risks-mitigation":
      return scoreRisksMitigation(slots["risks-mitigation"]);
    case "timeline-milestones":
      return scoreTimelineMilestones(slots["timeline-milestones"]);
    case "decision-framework":
      return scoreDecisionFramework(slots["decision-framework"], data);
    default:
      return { score: 0 };
  }
}

/**
 * Factor A · Evidence Maturity（v2.93 maturity-scoring.md）
 * 13 个 core slot 的 conservative evidence-maturity 均值，分母固定 13。
 * 衡量硬证据成熟度，不是页面完整度、行数或引用率。
 */
export function computeSlotEvidenceMaturity(data: StructuredKbData): FactorAResult {
  const slotScores = {} as Record<CanonicalKbSlot, number>;
  const capsApplied: string[] = [];

  for (const slot of CANONICAL_KB_SLOTS) {
    const { score, capApplied } = scoreSlotEvidenceMaturity(slot, data);
    slotScores[slot] = score;
    if (capApplied) capsApplied.push(capApplied);
  }

  const sum = CANONICAL_KB_SLOTS.reduce((acc, s) => acc + slotScores[s], 0);
  const factorA = Math.round(sum / CANONICAL_KB_SLOTS.length);

  const lowSlots = CANONICAL_KB_SLOTS.filter((s) => slotScores[s] <= 15).length;
  const capNote =
    capsApplied.length > 0
      ? `；${capsApplied.length} 项 hard-evidence cap 生效`
      : "";
  const note = `Evidence Maturity ${factorA}/100（13 core slots 均值，分母固定 13；${lowSlots} 个 slot ≤15%${capNote}）`;

  return { score: factorA, slotScores, capsApplied, note };
}
