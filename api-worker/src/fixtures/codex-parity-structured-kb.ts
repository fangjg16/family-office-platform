import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";

/** Codex v2.93 parity 对比用 structured fixture（含 Codex legacy keys + gap-first 语义） */
export function buildCodexParityFixture(): StructuredKbData {
  return {
    type: "structured-kb-data",
    schemaVersion: "2.91",
    mode: "full",
    summary: "Codex parity fixture — gap-first KB with legacy key aliases",
    meta: {
      title: "中亚易货贸易 · Parity Fixture",
      autoSummary: "结构化 fixture：事实不足处用 gap rows / missing callout 覆盖，不编造 IRR/许可。",
      date: "2026-06-03",
      stage: "Early",
      status: "内部讨论",
      version: "1",
    },
    config: {
      projectType: "trade",
      renderingMode: "chinese-only",
      displayOrder: [
        "snapshot",
        "target-overview",
        "industry-market",
        "business-operations",
        "legal-ownership",
        "regulatory-compliance",
        "resource-network",
        "comps-benchmark",
        "valuation-returns",
        "diligence-gaps",
        "risks-mitigation",
        "timeline-milestones",
        "decision-framework",
      ],
    },
    sources: [
      { id: "U-1", type: "用户上传", title: "项目 BP", author: "卖方", excerpt: "商业计划摘要" },
      { id: "A-1", type: "公开", title: "海关统计", author: "政府", excerpt: "贸易量数据" },
    ],
    terms: [{ term: "易货", definition: "以货易货，非现金结算" }],
    dataDictionary: [{ field: "IRR", definition: "内部收益率", caveat: "缺投资额时不得估算" }],
    maturity: { factorA: "0%", factorB: "0%", combined: "0%", tier: "Lead" },
    slots: {
      snapshot: {
        facts: [
          { label: "项目类型", value: "跨境易货", source: "U-1" },
          { label: "阶段", value: "Early", source: "U-1" },
          { label: "指示性价格", value: "缺口", source: "待确认" },
        ],
        oneLineJudgment: "资料偏单来源，硬证据不足但结构可发布。",
        gaps: [{ text: "缺 indicative price range", confidence: "gap" }],
      },
      "target-overview": {
        rows: [
          { asset: "易货平台", definition: "撮合跨境易货", investability: "待验证", gap: "缺交付物清单" },
          { asset: "仓储能力", definition: "—", investability: "缺口", gap: "未核实" },
        ],
      },
      "industry-market": {
        drivers: [
          { topic: "中亚贸易量", finding: "公开数据有限", implication: "需独立数据源", source: "A-1" },
        ],
      },
      "business-operations": {
        journey: {
          stages: ["获客", "撮合", "交割", "结算"],
          lanes: [{ label: "平台", nodes: ["线索", "匹配", "合同", "对账"] }],
        },
        customers: [{ customer: "缺口", need: "待确认", channel: "—", status: "gap" }],
        economics: [{ pricing: "缺口", kpi: "待验证" }],
        assumptions: [{ assumption: "履约成本", why: "影响毛利", test: "索取合同样本" }],
      },
      "legal-ownership": {
        entities: [{ entity: "标的 SPV", role: "待确认", gap: "权属未定" }],
        missing: [
          { issue: "股东结构未披露", whyItMatters: "影响控制权", requiredEvidence: "股东名册", owner: "法务", decisionImpact: "无法定价", riskLevel: "高" },
          { issue: "IP 归属不清", whyItMatters: "影响资产边界", requiredEvidence: "IP 登记", owner: "法务", decisionImpact: "推迟 IC", riskLevel: "高" },
          { issue: "合同模板未提供", whyItMatters: "影响交易结构", requiredEvidence: "主协议", owner: "法务", decisionImpact: "条件推进", riskLevel: "中" },
          { issue: "关联交易未核实", whyItMatters: "利益冲突", requiredEvidence: "关联方清单", owner: "法务", decisionImpact: "加强尽调", riskLevel: "中" },
        ],
      },
      "regulatory-compliance": {
        rows: [
          { rule: "跨境贸易许可", applicability: "哈萨克斯坦", status: "待确认", nextStep: "律师意见" },
        ],
        regulatoryGaps: [
          { jurisdiction: "KZ", requirement: "进出口许可", currentEvidence: "未提供", gap: "待确认", nextAction: "监管查询", riskLevel: "高" },
          { jurisdiction: "CN", requirement: "外汇合规", currentEvidence: "未提供", gap: "待确认", nextAction: "合规顾问", riskLevel: "高" },
          { jurisdiction: "KZ", requirement: "税务登记", currentEvidence: "未提供", gap: "待确认", nextAction: "当地顾问", riskLevel: "中" },
          { jurisdiction: "CN", requirement: "数据跨境", currentEvidence: "未提供", gap: "待确认", nextAction: "隐私评估", riskLevel: "中" },
        ],
      },
      "resource-network": {
        actors: [{ party: "缺口", role: "渠道", strength: "未验证", risk: "高" }],
        resourceGaps: [
          { party: "本地运营商", role: "履约", evidence: "未提供", dependency: "交割", gap: "无合同", nextAction: "索取 MOU" },
          { party: "海关代理", role: "清关", evidence: "未提供", dependency: "合规", gap: "无授权", nextAction: "尽调" },
          { party: "物流商", role: "运输", evidence: "未提供", dependency: "时效", gap: "无报价", nextAction: "招标" },
        ],
      },
      "comps-benchmark": {
        comps: [],
        comparableGaps: [
          { 缺口: "无可比交易", 原因: "区域稀缺", 所需资料: "同类 deal", 对估值启示: "无法锚定", nextAction: "卖方提供" },
          { 缺口: "缺运营对标", 原因: "商业模式差异", 所需资料: "平台 GMV", 对估值启示: "仅定性", nextAction: "行业访谈" },
          { 缺口: "缺倍数区间", 原因: "无利润数据", 所需资料: "审计报表", 对估值启示: "推迟估值", nextAction: "财务 DD" },
        ],
        transactionCasesNote: "卖方未提供可比交易案例。",
      },
      "valuation-returns": {
        valuationBox: { label: "投资额", value: "待确认", note: "缺 term sheet" },
        scenarios: [
          { label: "Base", value: "待建模", detail: "缺现金流输入" },
          { label: "Downside", value: "无法量化", detail: "gap" },
          { label: "Upside", value: "待建模", detail: "—" },
        ],
        capitalUses: [],
        cashflowGaps: [
          { 缺口: "投资额", 原因: "无 term sheet", 所需资料: "投资协议", 下一步: "索取", 对回报影响: "无法算 IRR" },
          { 缺口: "股权比例", 原因: "未披露", 所需资料: "cap table", 下一步: "法务", 对回报影响: "无法算 MOIC" },
        ],
        sensitivities: [{ variable: "汇率", impact: "双向", range: "±10%", monitoring: "合同条款" }],
      },
      "diligence-gaps": {
        groups: [
          {
            name: "P1 · 交易硬证据",
            items: [
              { question: "投资额与股权比例？", evidenceStrength: "无", owner: "财务", urgency: "高", nextStep: "索取 term sheet" },
              { question: "许可状态？", evidenceStrength: "无", owner: "法务", urgency: "高", nextStep: "监管查询" },
              { question: "核心合同是否签署？", evidenceStrength: "无", owner: "法务", urgency: "高", nextStep: "合同清单" },
              { question: "历史交易是否可审计？", evidenceStrength: "低", owner: "财务", urgency: "中", nextStep: "审计报告" },
            ],
          },
        ],
      },
      "risks-mitigation": {
        rows: [
          { level: "高", risk: "许可未获批导致停工", cause: "监管", impact: "项目无法交割", mitigation: "缺口", evidenceSourceIds: ["U-1"] },
          { level: "中", risk: "汇率波动侵蚀毛利", cause: "宏观", impact: "回报下行", mitigation: "对冲待评估", evidenceSourceIds: ["A-1"] },
        ],
        redFlags: [{ condition: "许可明确被拒", action: "暂停", owner: "IC" }],
      },
      "timeline-milestones": {
        gaps: [{ text: "暂无已核实的项目级时间节点。", confidence: "gap" }],
      },
      "decision-framework": {
        recommendation: "条件式推进：先补齐法律/监管硬证据再进入估值。",
        options: [
          { option: "小规模试点", pros: "验证履约", cons: "仍缺许可", condition: "许可路径清晰" },
          { option: "暂停", pros: "控制风险", cons: "错失窗口", condition: "许可无法确认" },
        ],
        nextActions: [
          { action: "监管路径 memo", owner: "法务", timing: "2 周", deliverable: "许可清单" },
          { action: "财务模型骨架", owner: "财务", timing: "3 周", deliverable: "inputs 清单" },
        ],
      },
    },
  } as unknown as StructuredKbData;
}
