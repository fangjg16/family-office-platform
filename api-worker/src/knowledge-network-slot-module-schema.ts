import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { RowSpecKey } from "./knowledge-network-row-columns";

/**
 * Slot Module Schema Registry
 *
 * 菜单，不是套餐。完整开发说明见同目录 `knowledge-network-slot-schema-dev.md`。
 *
 * 四类语义速查：
 * - allowed：可选用组件，缺失不 repair
 * - fallback：资料不足时的 gap 路径，正常输出
 * - coverageTarget：soft maturity（fact+gap 合计），不 repair
 * - hard repair：由 normalizer / 专项模块处理（unmapped、invalid type、幻觉等）
 */

export type ComponentKind =
  | "table"
  | "narrative"
  | "metricCards"
  | "gapCallouts"
  | "journey"
  | "flywheel"
  | "canvas"
  | "riskRows"
  | "questionGroups"
  | "timeline"
  | "relationshipEdges"
  | "scenarios";

/** allowed = 可选用主组件；fallback = 缺口/假设路径 */
export type ComponentRole = "allowed" | "fallback";

export type ComponentDef = {
  field: string;
  kind: ComponentKind;
  role: ComponentRole;
  /** 模型/Codex 可能输出的同义顶层字段名（normalize 用，非 prompt 发明新名） */
  aliases?: string[];
  rowSpec?: RowSpecKey;
  /** soft：该组件若出现，fact rows + gap rows 合计目标（非必须真实事实数） */
  coverageTarget?: number;
  dropEmptyRows?: boolean;
  gapCalloutLabel?: string;
  hardRepairOnUnmapped?: boolean;
  renderer?: string;
};

export type SlotModuleSchema = {
  slot: CanonicalKbSlot;
  /** Hermes 可选主组件 + fallback 路径；不要求全部出现 */
  allowedComponents: ComponentDef[];
  /** 人类可读：Hermes 通常从此集合选 1–2 个主视觉/结构组件（非强制） */
  primaryPickHint?: string;
};

const table = (
  field: string,
  rowSpec: RowSpecKey,
  opts: Partial<ComponentDef> = {},
): ComponentDef => ({
  field,
  kind: "table",
  role: "allowed",
  rowSpec,
  dropEmptyRows: true,
  hardRepairOnUnmapped: true,
  ...opts,
});

const fallback = (
  field: string,
  kind: ComponentKind,
  opts: Partial<ComponentDef> = {},
): ComponentDef => ({
  field,
  kind,
  role: "fallback",
  dropEmptyRows: kind === "table",
  hardRepairOnUnmapped: kind === "table",
  ...opts,
});

export const SLOT_MODULE_SCHEMAS: Record<CanonicalKbSlot, SlotModuleSchema> = {
  snapshot: {
    slot: "snapshot",
    primaryPickHint: "keyFacts 和/或 overview",
    allowedComponents: [
      table("keyFacts", "keyFacts", {
        aliases: ["facts", "items", "rows"],
        coverageTarget: 6,
        gapCalloutLabel: "关键事实",
        renderer: "renderTable",
      }),
      { field: "overview", kind: "narrative", role: "allowed", renderer: "renderNarratives" },
      {
        field: "maturityMetrics",
        kind: "metricCards",
        role: "allowed",
        renderer: "renderMetricCards",
      },
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "target-overview": {
    slot: "target-overview",
    primaryPickHint: "assetSummary 和/或 keyClaims",
    allowedComponents: [
      { field: "businessSummary", kind: "narrative", role: "allowed", renderer: "renderNarratives" },
      table("assetSummary", "assetSummary", {
        aliases: ["rows", "assets"],
        coverageTarget: 3,
        gapCalloutLabel: "资产构成",
      }),
      table("keyClaims", "keyClaims", {
        aliases: ["claims"],
        coverageTarget: 2,
        gapCalloutLabel: "关键主张",
      }),
      table("transactionSummary", "transactionSummary", { gapCalloutLabel: "交易要素" }),
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "industry-market": {
    slot: "industry-market",
    primaryPickHint: "marketDrivers / valueChain / policyContext 选 1–2",
    allowedComponents: [
      table("marketDrivers", "marketDrivers", {
        aliases: ["rows", "drivers", "findings"],
        coverageTarget: 3,
        gapCalloutLabel: "市场驱动",
      }),
      table("marketSize", "marketSize", { aliases: ["marketData", "datasets"] }),
      table("valueChain", "valueChain", { coverageTarget: 2, gapCalloutLabel: "价值链" }),
      table("policyContext", "policyContext", { coverageTarget: 1, gapCalloutLabel: "政策/监管" }),
      table("comparableSignals", "comparableSignals"),
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "business-operations": {
    slot: "business-operations",
    primaryPickHint:
      "journeyMap | revenueTree | flywheel | canvas | processFlow 选 1–2；不足写 operationalGaps",
    allowedComponents: [
      {
        field: "journeyMap",
        kind: "journey",
        role: "allowed",
        aliases: ["journey"],
        renderer: "renderJourneyMap",
      },
      {
        field: "processFlow",
        kind: "table",
        role: "allowed",
        dropEmptyRows: true,
        hardRepairOnUnmapped: false,
      },
      {
        field: "canvas",
        kind: "canvas",
        role: "allowed",
        aliases: ["bmc"],
        renderer: "renderBmc",
      },
      table("revenueTree", "revenueTree", {
        aliases: ["valueChain"],
        coverageTarget: 2,
        gapCalloutLabel: "收入结构",
      }),
      table("customerBuyer", "customerBuyer", {
        aliases: ["customers"],
        coverageTarget: 2,
        gapCalloutLabel: "客户/付费方",
      }),
      table("pricing", "pricing", { aliases: ["unitEconomics", "economics"] }),
      table("operatingBottlenecks", "operatingBottlenecks"),
      table("supplyChain", "supplyChain"),
      fallback("operationalGaps", "operationalGaps", {
        aliases: ["assumptions", "assumptionMap"],
        coverageTarget: 1,
      }),
      { field: "flywheel", kind: "flywheel", role: "allowed", renderer: "renderFlywheelBlock" },
      table("ecosystemMap", "ecosystemMap"),
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "legal-ownership": {
    slot: "legal-ownership",
    primaryPickHint: "entities 和/或 legalGapRows",
    allowedComponents: [
      table("entities", "entities", { aliases: ["rows"] }),
      table("contractRights", "contractRights"),
      table("legalGapRows", "legalGapRows"),
      fallback("unresolvedLegalIssues", "legalGapRows", { aliases: ["missing"] }),
      {
        field: "relationshipEdges",
        kind: "relationshipEdges",
        role: "allowed",
        aliases: ["relationships"],
      },
    ],
  },
  "regulatory-compliance": {
    slot: "regulatory-compliance",
    primaryPickHint: "jurisdictionRows 和/或 regulatoryGaps",
    allowedComponents: [
      table("jurisdictionRows", "jurisdictionRows", {
        aliases: ["rows", "requirements", "rules"],
        gapCalloutLabel: "监管辖区",
      }),
      table("licenseRequirements", "licenseRequirements", {
        aliases: ["licenses", "approvals"],
      }),
      fallback("regulatoryGaps", "regulatoryGapRows", {
        aliases: ["redFlags"],
        coverageTarget: 4,
        gapCalloutLabel: "监管缺口",
      }),
      table("complianceRisks", "jurisdictionRows", { hardRepairOnUnmapped: false }),
      table("approvalPath", "approvalPath"),
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "resource-network": {
    slot: "resource-network",
    allowedComponents: [
      table("parties", "parties", { aliases: ["rows", "actors"] }),
      table("capabilities", "capabilities", { aliases: ["resources"] }),
      fallback("resourceGaps", "resourceGaps"),
      fallback("capabilityGaps", "capabilityGaps"),
      fallback("relationshipGaps", "relationshipGaps"),
      {
        field: "relationshipEdges",
        kind: "relationshipEdges",
        role: "allowed",
        aliases: ["relationships"],
      },
    ],
  },
  "comps-benchmark": {
    slot: "comps-benchmark",
    allowedComponents: [
      table("compsRows", "compsRows", { aliases: ["rows", "comps", "cases"] }),
      fallback("comparableGaps", "comparableGaps"),
      table("benchmarkMetrics", "keyFacts", { hardRepairOnUnmapped: false }),
    ],
  },
  "valuation-returns": {
    slot: "valuation-returns",
    primaryPickHint: "scenarios 和/或 cashflowGaps；勿编造 IRR",
    allowedComponents: [
      table("investmentCashflow", "investmentCashflow", { aliases: ["capitalUses"] }),
      fallback("cashflowGaps", "cashflowGaps", { coverageTarget: 3 }),
      {
        field: "scenarios",
        kind: "scenarios",
        role: "allowed",
        aliases: ["scenarioRows"],
      },
      table("sensitivityItems", "sensitivityItems", { aliases: ["sensitivities"] }),
      table("returnDrivers", "returnDrivers", { aliases: ["assumptions"] }),
      table("benchmarkMetrics", "keyFacts", { hardRepairOnUnmapped: false }),
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "diligence-gaps": {
    slot: "diligence-gaps",
    primaryPickHint: "questionGroups（本 slot 唯一主组件）",
    allowedComponents: [
      {
        field: "questionGroups",
        kind: "questionGroups",
        role: "allowed",
        aliases: ["groups"],
        coverageTarget: 8,
        renderer: "renderQuestionGroups",
      },
    ],
  },
  "risks-mitigation": {
    slot: "risks-mitigation",
    primaryPickHint: "riskRows（可 gap-first）；stopConditions 可选",
    allowedComponents: [
      {
        field: "riskRows",
        kind: "riskRows",
        role: "allowed",
        aliases: ["rows", "risks"],
        coverageTarget: 4,
        renderer: "renderRiskMatrix",
      },
      table("stopConditions", "stopConditions", {
        aliases: ["redFlags"],
        coverageTarget: 1,
      }),
    ],
  },
  "timeline-milestones": {
    slot: "timeline-milestones",
    primaryPickHint: "occurred / inProgress / future 三段择有资料的填",
    allowedComponents: [
      { field: "occurred", kind: "timeline", role: "allowed", renderer: "renderTimelinePhase" },
      { field: "inProgress", kind: "timeline", role: "allowed", renderer: "renderTimelinePhase" },
      { field: "future", kind: "timeline", role: "allowed", renderer: "renderTimelinePhase" },
      fallback("gaps", "gapCallouts", { renderer: "renderGapCallouts" }),
    ],
  },
  "decision-framework": {
    slot: "decision-framework",
    primaryPickHint: "decisionTable / nextActions / goNoGoConditions 选有材料的",
    allowedComponents: [
      table("decisionTable", "decisionTable", {
        aliases: ["options", "tradeOffs"],
        coverageTarget: 2,
        gapCalloutLabel: "决策权衡",
      }),
      table("nextActions", "nextActions", {
        aliases: ["nextSteps"],
        coverageTarget: 2,
        gapCalloutLabel: "下一步行动",
      }),
      table("goNoGoConditions", "goNoGoConditions", {
        aliases: ["preconditions"],
        coverageTarget: 1,
        gapCalloutLabel: "Go/No-Go 条件",
      }),
    ],
  },
};

export function getSlotModuleSchema(slot: CanonicalKbSlot): SlotModuleSchema {
  return SLOT_MODULE_SCHEMAS[slot];
}

export function allowedComponentFields(slot: CanonicalKbSlot): string[] {
  return getSlotModuleSchema(slot).allowedComponents.map((c) => c.field);
}

export function getComponentsByRole(
  slot: CanonicalKbSlot,
  role: ComponentRole,
): ComponentDef[] {
  return getSlotModuleSchema(slot).allowedComponents.filter((c) => c.role === role);
}

export function isAllowedComponentField(slot: CanonicalKbSlot, field: string): boolean {
  const schema = getSlotModuleSchema(slot);
  return schema.allowedComponents.some(
    (c) => c.field === field || (c.aliases?.includes(field) ?? false),
  );
}

export function tableFieldsFromSchema(
  slot: CanonicalKbSlot,
): { field: string; spec: RowSpecKey }[] {
  return getSlotModuleSchema(slot).allowedComponents
    .filter((c): c is ComponentDef & { rowSpec: RowSpecKey } => c.kind === "table" && !!c.rowSpec)
    .map((c) => ({ field: c.field, spec: c.rowSpec }));
}

export const SCHEMA_COVERED_SLOTS = CANONICAL_KB_SLOTS.filter(
  (s) => SLOT_MODULE_SCHEMAS[s].allowedComponents.length > 0,
);
