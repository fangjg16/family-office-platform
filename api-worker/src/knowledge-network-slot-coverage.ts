import {
  countRichRowsForSpec,
  countValidRows,
  countValidRowsForColumns,
  isMeaningfulCell,
  pickRowCell,
} from "./knowledge-network-content-row-quality";
import {
  buildCoverageLayers,
  countGapCallouts,
  splitFactAndGapRows,
  toSlotCoverageLayers,
} from "./knowledge-network-coverage-target";
import type { SlotCoverageLayers } from "./knowledge-network-gap-first-quality";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import { evaluateRisksMitigationHardIssues } from "./knowledge-network-risks-gap-first";
import { ROW_SPECS } from "./knowledge-network-row-columns";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function textLen(v: unknown): number {
  if (typeof v !== "string") return 0;
  return v.trim().length;
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

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function richFactGapSplit(rows: unknown, specKey: keyof typeof ROW_SPECS) {
  const columns = ROW_SPECS[specKey].columns;
  const valid = splitFactAndGapRows(rows, specKey);
  const richFacts = valid.factRows.filter((r) =>
    countRichRowsForSpec([r], ROW_SPECS[specKey]) > 0,
  );
  return {
    factCount: richFacts.length || valid.factRows.length,
    gapCount: valid.gapRows.length,
    columns,
  };
}

function mergeLayers(
  slot: CanonicalKbSlot,
  parts: ReturnType<typeof buildCoverageLayers>[],
  softIssues: SlotQualityIssue[] = [],
  options?: { menuCompliant?: boolean },
): SlotCoverageLayers {
  if (!parts.length) {
    const menuCompliant = options?.menuCompliant ?? false;
    return {
      factCoverage: menuCompliant ? 40 : 0,
      gapCoverage: menuCompliant ? 50 : 0,
      gapFirstMode: menuCompliant,
      pass: menuCompliant,
      score: menuCompliant ? 45 : 0,
      issues: softIssues,
    };
  }
  const factCoverage = Math.round(parts.reduce((s, p) => s + p.factCoverage, 0) / parts.length);
  const gapCoverage = Math.round(parts.reduce((s, p) => s + p.gapCoverage, 0) / parts.length);
  const gapFirstMode = parts.some((p) => p.gapFirstMode);
  const issues = [...softIssues, ...parts.flatMap((p) => p.issues)];
  const coveragePass = parts.every((p) => p.pass);
  const pass = options?.menuCompliant ? true : softIssues.length === 0 && coveragePass;
  let score = Math.round(parts.reduce((s, p) => s + p.score, 0) / parts.length);
  if (gapFirstMode) score = Math.min(score, 80);
  return { factCoverage, gapCoverage, gapFirstMode, pass, score, issues };
}

function payloadFieldPresent(payload: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((k) => payload[k] !== undefined && payload[k] !== null);
}

function countBusinessOpsPrimaryComponents(payload: Record<string, unknown>): string[] {
  const found: string[] = [];
  const journey = payload.journeyMap ?? payload.journey;
  if (isRecord(journey)) {
    const stages = Array.isArray(journey.stages)
      ? journey.stages.filter((s) => isMeaningfulCell(s))
      : [];
    if (stages.length >= 1) found.push("journeyMap");
  }
  const revenue = richFactGapSplit(payload.revenueTree, "revenueTree");
  if (revenue.factCount + revenue.gapCount >= 1) found.push("revenueTree");
  if (narrativeParagraphs(payload, "flywheel") >= 1) found.push("flywheel");
  if (hasCanvasContent(payload)) found.push("canvas");
  if (countValidRows(payload.processFlow) >= 1) found.push("processFlow");
  const opGaps = Math.max(
    countValidRows(payload.operationalGaps),
    countValidRows(payload.assumptionMap),
    countValidRows(payload.assumptions),
  );
  if (opGaps >= 1) found.push("operationalGaps");
  return found;
}

function hasCanvasContent(payload: Record<string, unknown>): boolean {
  for (const key of ["canvas", "bmc"]) {
    const c = payload[key];
    if (!isRecord(c)) continue;
    if (
      Object.values(c).some(
        (v) =>
          isMeaningfulCell(v) ||
          (Array.isArray(v) && v.some((x) => isMeaningfulCell(x) || isRecord(x))),
      )
    ) {
      return true;
    }
  }
  return false;
}

function countIndustryMarketPrimaryComponents(payload: Record<string, unknown>): string[] {
  const found: string[] = [];
  const drivers = richFactGapSplit(payload.marketDrivers ?? payload.marketSize, "marketDrivers");
  if (drivers.factCount + drivers.gapCount >= 1) found.push("marketDrivers");
  const chain = richFactGapSplit(payload.valueChain, "valueChain");
  if (chain.factCount + chain.gapCount >= 1) found.push("valueChain");
  if (countValidRowsForColumns(payload.policyContext, ROW_SPECS.policyContext.columns) >= 1) {
    found.push("policyContext");
  }
  if (countValidRows(payload.comparableSignals) >= 1) found.push("comparableSignals");
  return found;
}

export function evaluateSnapshotLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "snapshot";
  const structural: SlotQualityIssue[] = [];
  if (textLen(payload.stage) === 0) {
    structural.push({ slot, code: "stage", message: "缺少 stage/阶段" });
  }
  if (textLen(payload.status) === 0) {
    structural.push({ slot, code: "status", message: "缺少 status/状态" });
  }
  if (textLen(payload.oneLineJudgment) < 20 && narrativeParagraphs(payload, "overview") < 1) {
    structural.push({ slot, code: "judgment", message: "缺少 oneLineJudgment 或 overview 叙述" });
  }

  const { factCount, gapCount } = richFactGapSplit(payload.keyFacts, "keyFacts");
  const keyFacts = buildCoverageLayers({
    slot,
    target: 6,
    factCount,
    gapCount: gapCount + countGapCallouts(payload, "gaps"),
    minGapForGapFirst: 1,
  });
  if (countGapCallouts(payload, "gaps") < 1 && gapCount < 1) {
    keyFacts.issues.push({ slot, code: "gaps", message: "须列出资料缺口 callout 或 gap row" });
    keyFacts.pass = false;
  }
  return mergeLayers(slot, [keyFacts], structural);
}

export function evaluateTargetOverviewLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "target-overview";
  const asset = richFactGapSplit(payload.assetSummary, "assetSummary");
  const assetLayer = buildCoverageLayers({
    slot,
    target: 3,
    factCount: asset.factCount,
    gapCount: asset.gapCount + countGapCallouts(payload, "gaps"),
    minGapForGapFirst: 1,
  });
  const claims = richFactGapSplit(payload.keyClaims, "keyClaims");
  const claimsLayer = buildCoverageLayers({
    slot,
    target: 2,
    factCount: claims.factCount,
    gapCount: claims.gapCount,
    factSufficient: claims.factCount >= 2 || narrativeParagraphs(payload, "businessSummary") >= 2,
  });
  if (claims.factCount < 2 && narrativeParagraphs(payload, "businessSummary") < 2) {
    claimsLayer.issues.push({
      slot,
      code: "claims",
      message: "keyClaims coverage target 2 或 businessSummary 段落",
    });
    claimsLayer.pass = false;
  }
  return mergeLayers(slot, [assetLayer, claimsLayer]);
}

export function evaluateIndustryMarketLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "industry-market";
  const softIssues: SlotQualityIssue[] = [];
  const primaries = countIndustryMarketPrimaryComponents(payload);
  const gapCallouts = countGapCallouts(payload, "gaps");
  const menuCompliant = primaries.length >= 1 || gapCallouts >= 1;

  const parts: ReturnType<typeof buildCoverageLayers>[] = [];
  if (payloadFieldPresent(payload, "marketDrivers", "marketSize")) {
    const drivers = richFactGapSplit(payload.marketDrivers ?? payload.marketSize, "marketDrivers");
    parts.push(
      buildCoverageLayers({
        slot,
        target: 3,
        factCount: drivers.factCount,
        gapCount: drivers.gapCount + countGapCallouts(payload, "gaps"),
        minGapForGapFirst: 1,
      }),
    );
  }
  if (payloadFieldPresent(payload, "valueChain")) {
    const chain = richFactGapSplit(payload.valueChain, "valueChain");
    parts.push(
      buildCoverageLayers({
        slot,
        target: 2,
        factCount: chain.factCount,
        gapCount: chain.gapCount,
      }),
    );
  }
  if (payloadFieldPresent(payload, "policyContext", "comparableSignals")) {
    const policyFacts = countValidRowsForColumns(
      payload.policyContext,
      ROW_SPECS.policyContext.columns,
    );
    const signalFacts = countValidRows(payload.comparableSignals);
    const policyLayer = buildCoverageLayers({
      slot,
      target: 1,
      factCount: Math.max(policyFacts, signalFacts),
      gapCount: 0,
      factSufficient: policyFacts >= 1 || signalFacts >= 1,
    });
    if (policyFacts < 1 && signalFacts < 1) {
      policyLayer.issues.push({
        slot,
        code: "policy_soft",
        message: "soft：policyContext / comparableSignals 可选；缺时可写 gaps",
      });
    }
    parts.push(policyLayer);
  }
  if (!menuCompliant) {
    softIssues.push({
      slot,
      code: "market_primary_soft",
      message:
        "soft：建议选 1–2 个主组件（marketDrivers / valueChain / policyContext）或 gaps callout",
    });
  }
  return mergeLayers(slot, parts, softIssues, { menuCompliant });
}

export function evaluateBusinessOperationsLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "business-operations";
  const softIssues: SlotQualityIssue[] = [];
  const primaries = countBusinessOpsPrimaryComponents(payload);
  const gapCallouts = countGapCallouts(payload, "gaps");
  const factPrimaries = primaries.filter((p) => p !== "operationalGaps");
  const gapFirstMode =
    primaries.includes("operationalGaps") && factPrimaries.length === 0
      ? true
      : gapCallouts >= 1 && factPrimaries.length === 0;
  const menuCompliant = primaries.length >= 1 || gapCallouts >= 1;

  const parts: ReturnType<typeof buildCoverageLayers>[] = [];
  if (payloadFieldPresent(payload, "revenueTree")) {
    const revenue = richFactGapSplit(payload.revenueTree, "revenueTree");
    parts.push(
      buildCoverageLayers({
        slot,
        target: 2,
        factCount: revenue.factCount,
        gapCount: revenue.gapCount,
        factSufficient: revenue.factCount >= 1 || narrativeParagraphs(payload, "flywheel") >= 1,
      }),
    );
  }
  if (payloadFieldPresent(payload, "customerBuyer", "customers")) {
    const customer = splitFactAndGapRows(payload.customerBuyer ?? payload.customers, "customerBuyer");
    parts.push(
      buildCoverageLayers({
        slot,
        target: 2,
        factCount: customer.factRows.length,
        gapCount: customer.gapRows.length,
      }),
    );
  }
  if (
    payloadFieldPresent(payload, "pricing", "operatingBottlenecks", "supplyChain", "unitEconomics")
  ) {
    const pricing = countValidRowsForColumns(payload.pricing, ROW_SPECS.pricing.columns);
    const bottlenecks = countValidRowsForColumns(
      payload.operatingBottlenecks,
      ROW_SPECS.operatingBottlenecks.columns,
    );
    const supply = countValidRowsForColumns(payload.supplyChain, ROW_SPECS.supplyChain.columns);
    const opsLayer = buildCoverageLayers({
      slot,
      target: 1,
      factCount: Math.max(pricing, bottlenecks, supply),
      gapCount: countGapCallouts(payload, "gaps", "operationalGaps"),
      factSufficient: pricing >= 1 || bottlenecks >= 1 || supply >= 1,
    });
    if (pricing < 1 && bottlenecks < 1 && supply < 1) {
      opsLayer.issues.push({
        slot,
        code: "ops_soft",
        message: "soft：pricing / operatingBottlenecks / supplyChain 可选；缺时可写 operationalGaps",
      });
    }
    parts.push(opsLayer);
  }
  if (!menuCompliant) {
    softIssues.push({
      slot,
      code: "biz_primary_soft",
      message:
        "soft：建议选 1–2 个主组件（journeyMap / revenueTree / flywheel / canvas / processFlow）或 operationalGaps / gaps",
    });
  }
  const merged = mergeLayers(slot, parts, softIssues, { menuCompliant });
  return { ...merged, gapFirstMode: merged.gapFirstMode || gapFirstMode };
}

export function evaluateDiligenceGapsLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "diligence-gaps";
  const groups = payload.questionGroups;
  let factCount = 0;
  let gapCount = 0;
  if (Array.isArray(groups)) {
    for (const g of groups) {
      if (!isRecord(g)) continue;
      const qs = g.questions;
      if (!Array.isArray(qs)) continue;
      for (const q of qs) {
        if (!isRecord(q)) continue;
        const text = pickRowCell(q, ["question", "claim", "item", "问题/主张"]);
        if (!isMeaningfulCell(text)) continue;
        if (/缺口|待确认|gap/i.test(text)) gapCount += 1;
        else factCount += 1;
      }
    }
  }
  return toSlotCoverageLayers(
    buildCoverageLayers({
      slot,
      target: 8,
      factCount,
      gapCount: gapCount + countGapCallouts(payload, "gaps"),
      minGapForGapFirst: 4,
    }),
  );
}

export function evaluateRisksMitigationLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "risks-mitigation";
  const hardIssues = evaluateRisksMitigationHardIssues(payload);
  if (hardIssues.some((i) => i.code === "risk_rows_missing" || i.code === "payload_missing")) {
    return {
      factCoverage: 0,
      gapCoverage: 0,
      gapFirstMode: false,
      pass: false,
      score: 0,
      issues: hardIssues,
    };
  }
  const fabricated = hardIssues.filter((i) => i.code === "fabricated_risk");
  if (fabricated.length) {
    return {
      factCoverage: 0,
      gapCoverage: 0,
      gapFirstMode: false,
      pass: false,
      score: 0,
      issues: fabricated,
    };
  }

  const riskFactCount = countValidRows(payload.riskRows);
  const riskLayer = buildCoverageLayers({
    slot,
    target: 4,
    factCount: riskFactCount,
    gapCount: countGapCallouts(payload, "gaps"),
    minGapForGapFirst: 2,
  });
  const stopFacts = countValidRowsForColumns(payload.stopConditions, ROW_SPECS.stopConditions.columns);
  const stopLayer = buildCoverageLayers({
    slot,
    target: 1,
    factCount: stopFacts,
    gapCount: countGapCallouts(payload, "gaps") >= 2 ? 1 : 0,
    factSufficient: stopFacts >= 1 || countGapCallouts(payload, "gaps") >= 2,
  });
  if (stopFacts < 1 && countGapCallouts(payload, "gaps") < 2) {
    stopLayer.issues.push({
      slot,
      code: "stop_soft",
      message: "soft：stopConditions 可选；缺时可写 gaps callout",
    });
  }
  const menuCompliant = riskFactCount >= 1 || countGapCallouts(payload, "gaps") >= 1;
  return mergeLayers(slot, [riskLayer, stopLayer], [], { menuCompliant });
}

export function evaluateTimelineMilestonesLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "timeline-milestones";
  const past = arrLen(payload.occurred ?? payload.past);
  const inProgress = arrLen(payload.inProgress);
  const future = arrLen(payload.future);
  const gapCount = countGapCallouts(payload, "gaps");
  const nodeCount = past + inProgress + future;

  const nodeLayer = buildCoverageLayers({
    slot,
    target: 2,
    factCount: nodeCount,
    gapCount,
    minGapForGapFirst: 1,
    factSufficient: nodeCount >= 1 || gapCount >= 1,
  });

  if (nodeCount < 1 && gapCount < 1) {
    nodeLayer.issues.push({
      slot,
      code: "timeline_soft",
      message: "无项目节点（soft warning）；可仅写 gaps callout，不阻止发布",
    });
  }

  // 时间轴缺节点为 soft：结构仍 pass，由 publish gate softWarnings 提示
  nodeLayer.pass = nodeLayer.pass || (gapCount >= 1 && nodeLayer.issues.every((i) => i.code === "timeline_soft"));

  return toSlotCoverageLayers(nodeLayer);
}

export function evaluateDecisionFrameworkLayers(payload: Record<string, unknown>): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "decision-framework";
  const structural: SlotQualityIssue[] = [];
  if (textLen(payload.recommendation) < 15) {
    structural.push({ slot, code: "recommendation", message: "缺少 recommendation" });
  }
  const decision = splitFactAndGapRows(payload.decisionTable, "decisionTable");
  const decisionLayer = buildCoverageLayers({
    slot,
    target: 2,
    factCount: decision.factRows.length,
    gapCount: decision.gapRows.length,
  });
  const actions = splitFactAndGapRows(payload.nextActions, "nextActions");
  const actionsLayer = buildCoverageLayers({
    slot,
    target: 2,
    factCount: actions.factRows.length,
    gapCount: actions.gapRows.length,
  });
  const goNoGo = countValidRowsForColumns(payload.goNoGoConditions, ROW_SPECS.goNoGoConditions.columns);
  const triggers = countValidRowsForColumns(payload.triggers, ROW_SPECS.triggers.columns);
  const condLayer = buildCoverageLayers({
    slot,
    target: 1,
    factCount: Math.max(goNoGo, triggers),
    gapCount: 0,
    factSufficient: goNoGo >= 1 || triggers >= 1,
  });
  if (goNoGo < 1 && triggers < 1) {
    condLayer.issues.push({ slot, code: "conditions", message: "缺少有效 go/no-go 或触发条件行" });
    condLayer.pass = false;
  }
  return mergeLayers(slot, [decisionLayer, actionsLayer, condLayer], structural);
}

export function buildSlotCoverageRepairHint(slot: CanonicalKbSlot, _layers: SlotCoverageLayers): string {
  return (
    `${slot} · coverage target repair（fact rows + valid gap rows，非 hard factual minimum）。` +
    `补 gap rows：requiredEvidence / decisionImpact / nextAction；勿为提高 Factor A / maturity 编造事实。`
  );
}
