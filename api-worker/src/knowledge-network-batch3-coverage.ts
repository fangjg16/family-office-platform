import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import {
  asRows,
  buildCoverageLayers,
  countStructuredRows,
  countValidSpecRows,
  hasFabricatedReturnMetrics,
  isStructuredCashflowGapRow,
  isStructuredComparableGapRow,
  isStructuredResourceGapRow,
  mergeCoverageLayers,
  splitFactAndGapRows,
  splitRelationshipEdges,
  toSlotCoverageLayers,
  type CoverageTargetLayers,
} from "./knowledge-network-coverage-target";
import type { SlotCoverageLayers } from "./knowledge-network-gap-first-quality";
import { isMeaningfulCell, pickRowCell } from "./knowledge-network-content-row-quality";
import { isGapMarkedRow } from "./knowledge-network-coverage-target";

const SLOT_RESOURCE = "resource-network" as CanonicalKbSlot;
const SLOT_COMPS = "comps-benchmark" as CanonicalKbSlot;
const SLOT_VALUATION = "valuation-returns" as CanonicalKbSlot;

const PARTY_TARGET = 4;
const CAP_TARGET = 4;
const EDGE_TARGET = 4;
const COMPS_TARGET = 4;
const CASHFLOW_TARGET = 3;

function detectFabricatedPartnerships(payload: Record<string, unknown>): SlotQualityIssue[] {
  const issues: SlotQualityIssue[] = [];
  for (const row of asRows(payload.relationshipEdges)) {
    const edge = pickRowCell(row, ["关系/合作", "edge", "relationship"]);
    const evidence = pickRowCell(row, ["证据/缺口", "evidence", "status"]);
    if (
      isMeaningfulCell(edge) &&
      !isGapMarkedEdge(row) &&
      (!isMeaningfulCell(evidence) || /^[-—–]$/.test(evidence))
    ) {
      issues.push({
        slot: SLOT_RESOURCE,
        code: "fabricated_partnership",
        message: `合作关系「${edge}」缺少证据标注，不得编造`,
      });
    }
  }
  return issues;
}

function isGapMarkedEdge(row: Record<string, unknown>): boolean {
  const evidence = pickRowCell(row, ["证据/缺口", "evidence", "status"]);
  return /缺口|待确认|未提供|待验证|gap/i.test(evidence);
}

function detectFabricatedComps(payload: Record<string, unknown>): SlotQualityIssue[] {
  const issues: SlotQualityIssue[] = [];
  for (const row of asRows(payload.compsRows)) {
    const comp = pickRowCell(row, ["可比对象", "comp", "name"]);
    const basis = pickRowCell(row, ["可比逻辑", "logic", "rationale", "basis", "可比依据"]);
    const evidence = pickRowCell(row, ["证据/缺口", "evidence", "status"]);
    if (
      isMeaningfulCell(comp) &&
      !/缺口|待确认|unavailable|待补充|^[-—–]$/i.test(comp) &&
      !isGapMarkedRow(row) &&
      (!isMeaningfulCell(basis) || /^[-—–]$/.test(basis)) &&
      !isMeaningfulCell(evidence)
    ) {
      issues.push({
        slot: SLOT_COMPS,
        code: "fabricated_comp",
        message: `可比案例「${comp}」缺少依据或证据，不得编造交易`,
      });
    }
  }
  return issues;
}

export function evaluateResourceNetworkLayers(
  payload: Record<string, unknown>,
): SlotCoverageLayers {
  const parties = splitFactAndGapRows(payload.parties ?? payload.resources, "parties");
  const capabilities = splitFactAndGapRows(payload.capabilities, "capabilities");
  const edges = splitRelationshipEdges(payload.relationshipEdges);
  const resourceGaps = countStructuredRows(payload.resourceGaps, isStructuredResourceGapRow);
  const missingParties = countStructuredRows(payload.missingParties, isStructuredResourceGapRow);

  const partyFact = parties.factRows.length;
  const partyGap = parties.gapRows.length + resourceGaps + missingParties;
  const capFact = capabilities.factRows.length;
  const capGap = capabilities.gapRows.length + countStructuredRows(payload.capabilityGaps, isStructuredResourceGapRow);
  const edgeFact = edges.factRows.length;
  const edgeGap =
    edges.gapRows.length + countStructuredRows(payload.relationshipGaps, isStructuredResourceGapRow);

  const fabricated = detectFabricatedPartnerships(payload);

  const party = buildCoverageLayers({
    slot: SLOT_RESOURCE,
    target: PARTY_TARGET,
    factCount: partyFact,
    gapCount: partyGap,
    extraIssues: fabricated,
  });
  const cap = buildCoverageLayers({
    slot: SLOT_RESOURCE,
    target: CAP_TARGET,
    factCount: capFact,
    gapCount: capGap,
  });
  const edge = buildCoverageLayers({
    slot: SLOT_RESOURCE,
    target: EDGE_TARGET,
    factCount: edgeFact,
    gapCount: edgeGap,
  });

  const minResourceGaps = 3;
  const gapRowsOk = resourceGaps >= minResourceGaps;
  const merged = mergeCoverageLayers(SLOT_RESOURCE, [party, cap, edge]);
  if (!gapRowsOk && merged.gapFirstMode) {
    merged.issues.push({
      slot: SLOT_RESOURCE,
      code: "resource_gaps",
      message: `resourceGaps coverage target ≥${minResourceGaps}（当前 ${resourceGaps}）`,
    });
    merged.pass = false;
  }
  return toSlotCoverageLayers(merged);
}

export function evaluateCompsBenchmarkLayers(
  payload: Record<string, unknown>,
): SlotCoverageLayers {
  const comps = splitFactAndGapRows(payload.compsRows, "compsRows");
  const comparableGaps = countStructuredRows(payload.comparableGaps, isStructuredComparableGapRow);
  const factCount = comps.factRows.length;
  const gapCount = comps.gapRows.length + comparableGaps;
  const fabricated = detectFabricatedComps(payload);

  const hasNote =
    isMeaningfulCell(payload.transactionCasesNote) ||
    isMeaningfulCell(payload.comparableSearchStrategy);
  const layers = buildCoverageLayers({
    slot: SLOT_COMPS,
    target: COMPS_TARGET,
    factCount,
    gapCount,
    extraIssues: fabricated,
  });

  if (factCount === 0 && gapCount >= COMPS_TARGET && !hasNote) {
    layers.issues.push({
      slot: SLOT_COMPS,
      code: "comparable_note",
      message: "无真实可比时需 transactionCasesNote / comparableSearchStrategy",
    });
    layers.pass = false;
  }
  return toSlotCoverageLayers(layers);
}

export function evaluateValuationReturnsLayers(
  payload: Record<string, unknown>,
): SlotCoverageLayers {
  const cashflow = splitFactAndGapRows(payload.investmentCashflow, "investmentCashflow");
  const cashflowGaps = countStructuredRows(payload.cashflowGaps, isStructuredCashflowGapRow);
  const factCount = cashflow.factRows.length;
  const gapCount = cashflow.gapRows.length + cashflowGaps;

  const extraIssues: SlotQualityIssue[] = [];
  if (hasFabricatedReturnMetrics(payload)) {
    extraIssues.push({
      slot: SLOT_VALUATION,
      code: "fabricated_irr",
      message: "缺投资额/估值/股权比例时不得写 IRR/MOIC",
    });
  }

  const scenarioCount = countValidSpecRows(payload.scenarios, "scenarios");
  const hasScenarioGap =
    scenarioCount > 0 ||
    asRows(payload.scenarios).some((s) =>
      /无法量化|待建模|gap|缺口/i.test(
        `${pickRowCell(s, ["value", "valueLabel"])} ${pickRowCell(s, ["detail", "说明"])}`,
      ),
    );

  const cashflowLayers = buildCoverageLayers({
    slot: SLOT_VALUATION,
    target: CASHFLOW_TARGET,
    factCount,
    gapCount,
    extraIssues,
    minGapForGapFirst: 2,
  });

  if (!hasScenarioGap && factCount === 0 && gapCount < CASHFLOW_TARGET) {
    cashflowLayers.issues.push({
      slot: SLOT_VALUATION,
      code: "valuation_scenarios_soft",
      message: "soft：建议 scenarios 或 cashflowGaps 说明无法量化原因；勿编造 IRR/MOIC",
    });
  }

  const menuCompliant = factCount + gapCount >= 1 || hasScenarioGap;
  if (menuCompliant && extraIssues.length === 0) {
    cashflowLayers.pass = true;
  }

  return toSlotCoverageLayers(cashflowLayers);
}

export function buildBatch3CoverageRepairHint(
  slot: "resource-network" | "comps-benchmark" | "valuation-returns",
  _layers: SlotCoverageLayers,
): string {
  if (slot === "resource-network") {
    return `${slot} · repair：补 resourceGaps / capabilityGaps / relationshipGaps（标注 gap，requiredEvidence，nextAction）；勿编造合作。`;
  }
  if (slot === "comps-benchmark") {
    return `${slot} · repair：补 comparableGaps + transactionCasesNote；勿编造交易。`;
  }
  return `${slot} · repair：补 cashflowGaps + gap-first scenarios（无法量化原因/所需输入/下一步）；勿写 IRR/MOIC。`;
}
