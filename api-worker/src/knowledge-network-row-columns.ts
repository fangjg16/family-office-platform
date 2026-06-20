/** 表列别名：中文 canonical + Hermes/Codex 常用英文键 */
export const ROW_COLUMNS = {
  keyFacts: [
    ["项目项", "label", "key", "item", "field"],
    ["内容", "value", "content", "detail", "text"],
    ["证据/来源", "证据", "evidence", "source", "cite"],
  ],
  assetSummary: [
    ["资产/权利/能力", "asset", "name", "title"],
    ["定义与范围", "scope", "definition", "description"],
    ["可投资性", "investability", "status"],
    ["关键证据/缺口", "evidence", "gap", "note"],
  ],
  keyClaims: [
    ["关键主张", "claim", "question", "item", "assertion"],
    ["依据", "evidence", "basis", "source", "support"],
    ["缺口", "gap", "missing", "open"],
  ],
  transactionSummary: [
    ["交易要素", "element", "item", "field"],
    ["内容", "value", "content", "detail"],
    ["证据/缺口", "evidence", "gap", "source"],
  ],
  marketDrivers: [
    ["主题", "topic", "theme", "driver", "name"],
    ["事实/数据", "fact", "data", "detail", "value"],
    ["投资含义", "implication", "analysis", "meaning", "investment"],
    ["来源", "source", "evidence", "cite"],
  ],
  valueChain: [
    ["价值链环节", "segment", "stage", "link", "环节", "name"],
    ["描述", "description", "detail", "text"],
    ["壁垒/机会", "barrier", "opportunity", "moat", "壁垒", "机会"],
  ],
  policyContext: [
    ["政策/监管", "policy", "regulation", "rule", "name"],
    ["要点", "point", "detail", "summary", "要点"],
    ["影响", "impact", "effect", "implication"],
  ],
  revenueTree: [
    ["应用/产品场景", "scenario", "product", "application", "scene"],
    ["价值主张", "value", "proposition", "claim"],
    ["证据/缺口", "evidence", "gap", "source"],
  ],
  customerBuyer: [
    ["客户/受众/付费方", "customer", "buyer", "audience", "payer"],
    ["需求", "need", "demand", "requirement"],
    ["获客/渠道", "channel", "acquisition", "route"],
    ["验证状态", "status", "validation", "proof"],
  ],
  pricing: [
    ["收入来源", "revenue", "income", "stream"],
    ["定价/费率", "pricing", "rate", "price"],
    ["成本/履约", "cost", "fulfillment", "delivery"],
    ["单位经济/KPI", "kpi", "unit", "economics", "margin"],
  ],
  operatingBottlenecks: [
    ["瓶颈", "bottleneck", "issue", "risk"],
    ["影响", "impact", "effect"],
    ["缓释", "mitigation", "action", "remedy"],
  ],
  entities: [
    ["主体/权利", "entity", "subject", "name", "right"],
    ["角色/归属", "role", "ownership", "归属"],
    ["限制/负担", "restriction", "burden", "limit"],
    ["证据/缺口", "evidence", "gap", "source"],
  ],
  contractRights: [
    ["合同权利", "right", "contract", "name"],
    ["范围", "scope", "range"],
    ["限制", "limit", "restriction"],
    ["证据", "evidence", "source"],
  ],
  jurisdictionRows: [
    ["监管/规则", "rule", "regulation", "jurisdiction"],
    ["适用原因", "reason", "applicability", "cause"],
    ["状态/许可", "status", "license", "state"],
    ["红线/下一步", "next", "redline", "action"],
  ],
  licenseRequirements: [
    ["许可要求", "requirement", "license", "name"],
    ["状态", "status", "state"],
    ["负责人", "owner", "responsible"],
  ],
  parties: [
    ["主体/资源", "party", "resource", "name", "subject"],
    ["关系与作用", "relation", "role", "function"],
    ["强度/可验证性", "strength", "verifiability", "proof"],
    ["依赖与风险", "dependency", "risk", "reliance"],
  ],
  capabilities: [
    ["能力", "capability", "skill", "name"],
    ["来源", "source", "origin"],
    ["缺口", "gap", "missing"],
  ],
  compsRows: [
    ["可比对象", "comp", "name", "peer"],
    ["可比逻辑", "logic", "rationale", "basis"],
    ["指标/倍数", "metric", "multiple", "indicator"],
    ["可借鉴/差异", "difference", "lesson", "delta"],
  ],
  investmentCashflow: [
    ["资金用途", "use", "purpose", "item"],
    ["金额/比例", "amount", "ratio", "value"],
    ["说明", "note", "detail", "description"],
  ],
  sensitivityItems: [
    ["敏感变量", "variable", "factor", "driver"],
    ["影响方向", "impact", "direction", "effect"],
    ["阈值/区间", "threshold", "range", "band"],
    ["观察方式", "monitoring", "observe", "watch"],
  ],
  goNoGoConditions: [
    ["投资论点", "thesis", "argument", "claim"],
    ["证据", "evidence", "basis", "support"],
    ["前置条件", "condition", "precondition", "requirement"],
    ["反证/风险", "risk", "counter", "downside"],
  ],
  decisionTable: [
    ["选项", "option", "choice", "path"],
    ["好处", "benefit", "upside", "pro"],
    ["代价/风险", "risk", "cost", "downside"],
    ["适用条件", "condition", "when", "applicability"],
  ],
  nextActions: [
    ["下一步", "action", "step", "task", "next"],
    ["Owner", "owner", "responsible"],
    ["时间", "time", "date", "deadline"],
    ["交付物", "deliverable", "output", "artifact"],
  ],
  transactionCases: [
    ["交易案例", "case", "deal", "name"],
    ["条款", "terms", "detail"],
    ["启示", "lesson", "insight", "takeaway"],
  ],
  approvalPath: [
    ["审批路径", "path", "route", "name"],
    ["步骤", "step", "stage"],
    ["时间", "time", "timeline", "date"],
  ],
  triggers: [
    ["触发器", "trigger", "name"],
    ["条件", "condition", "criteria"],
    ["动作", "action", "response"],
  ],
  stopConditions: [
    ["停推条件", "condition", "stop", "risk"],
    ["触发动作", "action", "response"],
    ["Owner", "owner", "responsible"],
  ],
  diligenceQuestion: [
    ["question", "claim", "item", "问题/主张"],
    ["strength", "evidenceStrength", "证据强度"],
    ["owner", "Owner"],
    ["urgency", "priority", "blocker", "紧急程度/阻塞"],
    ["action", "request", "nextStep", "requiredEvidence", "需要资料/动作"],
  ],
} as const;
