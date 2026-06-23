/** 表列别名：中文 canonical + Hermes/Codex/PET v6 常用键 */
export type RowColumnSpec = {
  columns: readonly (readonly string[])[];
  /** 须非空的“分析/影响/缺口”列索引（0-based），用于 rich row 计分 */
  analysisColumnIndexes?: readonly number[];
};

function spec(
  columns: readonly (readonly string[])[],
  analysisColumnIndexes?: readonly number[],
): RowColumnSpec {
  return { columns, analysisColumnIndexes };
}

export const ROW_SPECS = {
  keyFacts: spec([
    ["项目项", "label", "key", "item", "field"],
    ["内容", "value", "content", "detail", "text"],
    ["证据/来源", "证据", "evidence", "source", "cite"],
  ]),
  assetSummary: spec([
    ["资产/权利/能力", "asset", "name", "title", "资产类型", "资产/业务项", "asset/业务项"],
    ["定义与范围", "scope", "definition", "description", "描述/标的", "定义/描述"],
    ["可投资性", "investability", "status", "规模/容量", "规模/地点"],
    ["关键证据/缺口", "evidence", "gap", "note", "关键证据/缺口", "状态/运营情况", "证据/来源"],
  ], [3]),
  keyClaims: spec([
    ["关键主张", "claim", "question", "item", "assertion", "核心主张"],
    ["依据", "evidence", "basis", "source", "support", "支持证据"],
    ["缺口", "gap", "missing", "open", "verificationNeeded", "confidence", "风险/不确定性"],
    ["来源", "cite", "reference"],
  ], [1, 2]),
  transactionSummary: spec([
    ["交易要素", "element", "item", "field"],
    ["内容", "value", "content", "detail"],
    ["证据/缺口", "evidence", "gap", "source"],
  ], [2]),
  marketDrivers: spec([
    ["主题", "topic", "theme", "driver", "name", "主题", "驱动因素"],
    ["事实/数据", "fact", "data", "detail", "value", "事实/数据", "gap", "信号/依据"],
    ["投资含义", "implication", "analysis", "meaning", "investment", "投资含义", "对项目的影响"],
    ["来源", "source", "evidence", "cite", "来源", "证据/来源"],
  ], [2]),
  valueChain: spec([
    ["价值链环节", "segment", "stage", "link", "环节", "name", "价值链环节"],
    ["描述", "description", "detail", "text", "参与者", "描述"],
    ["壁垒/机会", "barrier", "opportunity", "moat", "壁垒", "机会", "源天位置"],
  ], [2]),
  policyContext: spec([
    ["政策/监管", "policy", "regulation", "rule", "name", "政策", "政策/监管"],
    ["要点", "point", "detail", "summary", "要点", "目标"],
    ["影响", "impact", "effect", "implication", "影响"],
  ], [2]),
  revenueTree: spec([
    ["应用/产品场景", "scenario", "product", "application", "scene", "收入来源", "收入层级", "收入项"],
    ["价值主张", "value", "proposition", "claim", "驱动因素", "定价基础"],
    ["证据/缺口", "evidence", "gap", "source", "当前状态", "证据/来源", "验证状态"],
  ], [2]),
  customerBuyer: spec([
    ["客户/受众/付费方", "customer", "buyer", "audience", "payer", "客户/受众/付费方", "客户/付费方"],
    ["需求", "need", "demand", "requirement", "需求", "客户类型"],
    ["获客/渠道", "channel", "acquisition", "route", "获客/渠道"],
    ["验证状态", "status", "validation", "proof", "验证状态", "证据/来源", "证据/缺口"],
  ]),
  pricing: spec([
    ["收入来源", "revenue", "income", "stream", "产品"],
    ["定价/费率", "pricing", "rate", "price", "价格区间"],
    ["成本/履约", "cost", "fulfillment", "delivery", "对比基准"],
    ["单位经济/KPI", "kpi", "unit", "economics", "margin", "溢价逻辑"],
  ]),
  operatingBottlenecks: spec([
    ["瓶颈", "bottleneck", "issue", "risk", "瓶颈"],
    ["影响", "impact", "effect", "影响"],
    ["缓释", "mitigation", "action", "remedy", "缓解"],
  ], [1]),
  operationalGaps: spec([
    ["待验证假设", "assumption", "hypothesis", "假设"],
    ["为什么关键", "why", "importance", "whyItMatters", "原因"],
    ["验证方式", "test", "nextStep", "validation", "验证方式"],
  ]),
  supplyChain: spec([
    ["瓶颈", "bottleneck", "issue", "risk", "环节"],
    ["影响", "impact", "effect", "影响"],
    ["缓释", "mitigation", "action", "remedy", "缓解"],
  ], [1]),
  entities: spec([
    ["主体/权利", "entity", "subject", "name", "right", "主体/权利"],
    ["角色/归属", "role", "ownership", "归属", "角色/归属"],
    ["限制/负担", "restriction", "burden", "limit", "限制/负担"],
    ["证据/缺口", "evidence", "gap", "source", "证据/缺口"],
  ], [3]),
  contractRights: spec([
    ["合同权利", "right", "contract", "name", "合同类型", "合同权利"],
    ["范围", "scope", "range", "对手方", "范围"],
    ["限制", "limit", "restriction", "关键条款", "限制"],
    ["证据", "evidence", "source", "缺口", "证据"],
  ], [3]),
  jurisdictionRows: spec([
    ["监管/规则", "rule", "regulation", "jurisdiction", "监管/规则", "规则/要求"],
    ["适用原因", "reason", "applicability", "cause", "适用原因", "适用机关"],
    ["状态/许可", "status", "license", "state", "状态/许可", "当前状态"],
    ["红线/下一步", "next", "redline", "action", "红线/下一步", "依据/来源"],
  ], [3]),
  licenseRequirements: spec([
    ["许可要求", "requirement", "license", "name", "许可", "许可要求"],
    ["发证机关", "authority", "issuer", "owner", "responsible", "负责人"],
    ["状态", "status", "state", "状态"],
    ["缺口", "gap", "missing", "open", "证据/缺口"],
  ], [3]),
  legalGapRows: spec([
    ["issue", "问题", "issueTitle", "待确认事项", "缺口"],
    ["whyItMatters", "为何重要", "impact", "重要性"],
    ["requiredEvidence", "所需证据", "所需资料", "待补资料"],
    ["owner", "party", "责任方", "提供方", "ownerParty"],
    ["decisionImpact", "决策影响", "investmentImpact", "对投资的影响"],
    ["riskLevel", "风险级别", "risk", "风险"],
  ], [3]),
  regulatoryGapRows: spec([
    ["jurisdiction", "辖区", "监管辖区", "地区", "缺口领域"],
    ["requirement", "监管要求", "许可要求", "规则"],
    ["currentEvidence", "现有证据", "当前证据", "已有资料", "建议来源"],
    ["gap", "缺口", "缺失", "待确认", "需确认内容"],
    ["nextAction", "下一步", "验证路径", "nextStep"],
    ["riskLevel", "风险级别", "risk", "风险", "阻塞等级"],
  ], [3]),
  approvalPath: spec([
    ["jurisdiction", "辖区", "监管辖区", "审批路径", "path", "route", "name"],
    ["requirement", "监管要求", "许可要求", "规则", "步骤", "step", "stage"],
    ["currentEvidence", "现有证据", "当前证据", "已有资料", "时间", "time", "timeline", "date"],
    ["gap", "缺口", "缺失", "待确认"],
    ["nextAction", "下一步", "验证路径", "nextStep"],
    ["riskLevel", "风险级别", "risk", "风险"],
  ], [3]),
  parties: spec([
    ["主体/资源", "party", "resource", "name", "subject", "主体/资源"],
    ["关系与作用", "relation", "role", "function", "关系与作用"],
    ["强度/可验证性", "strength", "verifiability", "proof", "强度/可验证性"],
    ["依赖与风险", "dependency", "risk", "reliance", "依赖与风险"],
  ], [3]),
  capabilities: spec([
    ["能力", "capability", "skill", "name", "能力"],
    ["来源", "source", "origin", "来源"],
    ["缺口", "gap", "missing", "缺口"],
  ], [2]),
  compsRows: spec([
    ["可比对象", "comp", "name", "peer", "可比对象"],
    ["可比逻辑", "logic", "rationale", "basis", "可比逻辑"],
    ["指标/倍数", "metric", "multiple", "indicator", "指标/倍数"],
    ["可借鉴/差异", "difference", "lesson", "delta", "可借鉴/差异"],
  ], [3]),
  investmentCashflow: spec([
    ["资金用途", "use", "purpose", "item", "资金用途"],
    ["金额/比例", "amount", "ratio", "value", "金额/比例"],
    ["说明", "note", "detail", "description", "说明"],
  ]),
  sensitivityItems: spec([
    ["敏感变量", "variable", "factor", "driver", "敏感变量"],
    ["影响方向", "impact", "direction", "effect", "影响方向"],
    ["阈值/区间", "threshold", "range", "band", "阈值/区间"],
    ["观察方式", "monitoring", "observe", "watch", "观察方式"],
  ], [1]),
  goNoGoConditions: spec([
    ["条件", "thesis", "argument", "claim", "投资论点"],
    ["否则", "risk", "counter", "downside", "反证/风险"],
  ], [0, 1]),
  decisionTable: spec([
    ["选项", "option", "choice", "path", "选项"],
    ["好处", "benefit", "upside", "pro", "好处"],
    ["代价/风险", "risk", "cost", "downside", "代价/风险"],
    ["适用条件", "condition", "when", "applicability", "适用条件"],
  ], [2]),
  nextActions: spec([
    ["下一步", "action", "step", "task", "next", "下一步"],
    ["Owner", "owner", "responsible"],
    ["时间", "time", "date", "deadline", "时间"],
    ["交付物", "deliverable", "output", "artifact", "交付物"],
  ]),
  transactionCases: spec([
    ["交易案例", "case", "deal", "name", "交易案例"],
    ["条款", "terms", "detail", "条款"],
    ["启示", "lesson", "insight", "takeaway", "启示"],
  ], [2]),
  triggers: spec([
    ["触发器", "trigger", "name", "触发器"],
    ["条件", "condition", "criteria", "条件"],
    ["动作", "action", "response", "动作"],
  ]),
  stopConditions: spec([
    ["停推条件", "condition", "stop", "risk", "停推条件"],
    ["触发动作", "action", "response", "触发动作"],
    ["Owner", "owner", "responsible"],
  ]),
  diligenceQuestion: spec([
    ["question", "claim", "item", "问题/主张"],
    ["strength", "evidenceStrength", "证据强度"],
    ["owner", "Owner"],
    ["urgency", "priority", "blocker", "紧急程度/阻塞"],
    ["action", "request", "nextStep", "requiredEvidence", "需要资料/动作"],
  ]),
  relationshipEdges: spec([
    ["关系/合作", "relation", "edge", "relationship"],
    ["从", "from"],
    ["到", "to"],
    ["状态", "status", "证据/缺口", "evidence"],
    ["风险", "risk", "dependency"],
  ], [3]),
  resourceGaps: spec([
    ["party", "主体", "主体/资源"],
    ["role", "角色", "关系与作用"],
    ["evidence", "证据", "evidence", "confidence"],
    ["dependency", "依赖", "依赖与风险"],
    ["gap", "缺口", "gap", "text"],
    ["nextAction", "下一步", "nextAction"],
  ], [4]),
  capabilityGaps: spec([
    ["能力", "capability", "skill"],
    ["来源", "source", "origin"],
    ["gap", "缺口", "missing"],
    ["nextAction", "下一步", "nextAction"],
  ], [2]),
  relationshipGaps: spec([
    ["relation", "关系/合作", "edge"],
    ["from", "从"],
    ["to", "到"],
    ["gap", "缺口", "gap"],
    ["nextAction", "下一步", "nextAction"],
  ], [3]),
  comparableGaps: spec([
    ["缺口", "gap", "text"],
    ["原因", "reason", "confidence"],
    ["所需资料", "requiredEvidence", "所需资料"],
    ["对估值启示", "valuationImpact", "对估值启示"],
    ["nextAction", "下一步"],
  ], [3]),
  cashflowGaps: spec([
    ["缺口", "gap", "缺失项"],
    ["原因", "reason", "影响"],
    ["所需资料", "requiredInputs", "所需资料", "建议补证"],
    ["下一步", "nextAction", "下一步"],
    ["对回报影响", "returnImpact", "对回报影响", "优先级"],
  ], [3]),
  scenarios: spec([
    ["label", "情景", "scenario"],
    ["value", "valueLabel", "回报", "irr", "moic"],
    ["detail", "说明", "notes", "detail"],
  ]),
} as const satisfies Record<string, RowColumnSpec>;

/** @deprecated use ROW_SPECS */
export const ROW_COLUMNS = Object.fromEntries(
  Object.entries(ROW_SPECS).map(([k, v]) => [k, v.columns]),
) as Record<keyof typeof ROW_SPECS, (typeof ROW_SPECS)[keyof typeof ROW_SPECS]["columns"]>;

export type RowSpecKey = keyof typeof ROW_SPECS;

export const SLOT_TABLE_FIELDS: Partial<
  Record<
    import("./knowledge-network-slot-aliases").CanonicalKbSlot,
    { field: string; spec: RowSpecKey }[]
  >
> = {
  "target-overview": [
    { field: "keyClaims", spec: "keyClaims" },
    { field: "assetSummary", spec: "assetSummary" },
  ],
  "industry-market": [
    { field: "valueChain", spec: "valueChain" },
    { field: "policyContext", spec: "policyContext" },
    { field: "marketDrivers", spec: "marketDrivers" },
  ],
  "business-operations": [
    { field: "revenueTree", spec: "revenueTree" },
    { field: "customerBuyer", spec: "customerBuyer" },
    { field: "pricing", spec: "pricing" },
    { field: "operatingBottlenecks", spec: "operatingBottlenecks" },
    { field: "supplyChain", spec: "supplyChain" },
  ],
  "legal-ownership": [
    { field: "entities", spec: "entities" },
    { field: "contractRights", spec: "contractRights" },
    { field: "unresolvedLegalIssues", spec: "legalGapRows" },
  ],
  "regulatory-compliance": [
    { field: "jurisdictionRows", spec: "jurisdictionRows" },
    { field: "licenseRequirements", spec: "licenseRequirements" },
    { field: "regulatoryGaps", spec: "regulatoryGapRows" },
  ],
  "resource-network": [
    { field: "parties", spec: "parties" },
    { field: "capabilities", spec: "capabilities" },
    { field: "resourceGaps", spec: "resourceGaps" },
  ],
  "comps-benchmark": [
    { field: "compsRows", spec: "compsRows" },
    { field: "comparableGaps", spec: "comparableGaps" },
  ],
  "valuation-returns": [
    { field: "investmentCashflow", spec: "investmentCashflow" },
    { field: "cashflowGaps", spec: "cashflowGaps" },
  ],
  "decision-framework": [
    { field: "goNoGoConditions", spec: "goNoGoConditions" },
    { field: "decisionTable", spec: "decisionTable" },
    { field: "nextActions", spec: "nextActions" },
  ],
};
