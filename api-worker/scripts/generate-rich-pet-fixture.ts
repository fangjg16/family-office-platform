/**
 * 从 thin PET fixture 生成 rich fixture（满足 full quality contract）
 * npx tsx scripts/generate-rich-pet-fixture.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFullStructuredKbQuality } from "../src/knowledge-network-full-quality-contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const thinPath = join(here, "fixtures/full-structured-kb-data-pet.json");
const richPath = join(here, "fixtures/full-structured-kb-data-pet-rich.json");

const thin = JSON.parse(readFileSync(thinPath, "utf8")) as Record<string, unknown>;

const row = (cols: Record<string, string>) => cols;

thin.summary = "PET 源天生物 rich structured KB fixture（quality contract pass）";
thin.maturity = {
  factorA: "99%",
  factorB: "99%",
  combined: "99%",
  tier: "Hermes 自填应被 Worker 覆盖",
};

const s = thin.slots as Record<string, Record<string, unknown>>;

s.snapshot = {
  stage: "临床前/产业化过渡",
  status: "资料请求中",
  oneLineJudgment: "放射性 PET 药物赛道有长期需求，但产能、注册与单一 BP 来源使项目仍处 Early 观察阶段。",
  overview: [
    {
      heading: "项目概览",
      paragraphs: [
        "源天生物聚焦 PET 放射性药物，处于临床前向产业化过渡阶段。",
        "当前资料主要来自项目方 BP，关键 gating 为 GMP 产能与注册路径。",
        "在补齐第三方审计与监管顾问意见前，不宜进入 IC。",
      ],
    },
  ],
  keyFacts: [
    row({ 项目项: "项目名称", 内容: "PET 源天生物", "证据/来源": "BP" }),
    row({ 项目项: "主体", 内容: "源天生物（待核实股权结构）", "证据/来源": "BP" }),
    row({ 项目项: "成立/注册", 内容: "2018 年设立，注册地待核实", "证据/来源": "BP" }),
    row({ 项目项: "核心技术", 内容: "PET 放射性药物研发与 GMP 生产", "证据/来源": "BP" }),
    row({ 项目项: "产品定位", 内容: "肿瘤影像诊断用 PET 药物", "证据/来源": "BP" }),
    row({ 项目项: "融资状态", 内容: "寻求 A 轮，金额待核实", "证据/来源": "BP" }),
    row({ 项目项: "关键 gating", 内容: "GMP 产线与注册路径", "证据/来源": "内部讨论" }),
  ],
  gaps: [{ text: "产能、注册路径与财务模型均待第三方核实", confidence: "gap" }],
};

s["target-overview"] = {
  assetSummary: [
    row({ "资产/权利/能力": "放射性药物管线", 定义与范围: "诊断/治疗 PET 药物", 可投资性: "待验证", "关键证据/缺口": "注册与产能" }),
    row({ "资产/权利/能力": "GMP 生产合作", 定义与范围: "委托或自建产能", 可投资性: "依赖合同", "关键证据/缺口": "产线审计" }),
    row({ "资产/权利/能力": "医院渠道关系", 定义与范围: "核医学科覆盖", 可投资性: "早期意向", "关键证据/缺口": "订单/协议" }),
  ],
  keyClaims: [
    row({ 关键主张: "管线具备差异化靶点", 依据: "BP 描述", 缺口: "临床数据" }),
    row({ 关键主张: "产能可在 18 月内就绪", 依据: "项目方口径", 缺口: "第三方审计" }),
  ],
  gaps: [{ text: "可投资性取决于注册与产能验证", confidence: "gap" }],
};

s["industry-market"] = {
  marketDrivers: [
    row({ 主题: "PET 影像需求", "事实/数据": "肿瘤筛查增长", 投资含义: "需求侧支撑", 来源: "公开" }),
    row({ 主题: "精准医疗", "事实/数据": "靶向诊断渗透率提升", 投资含义: "赛道长期性", 来源: "公开" }),
    row({ 主题: "国产替代", "事实/数据": "进口依赖仍高", 投资含义: "政策与支付窗口", 来源: "公开" }),
  ],
  valueChain: [
    row({ 价值链环节: "核素供应", 描述: "上游原料", "壁垒/机会": "供应稳定性" }),
    row({ 价值链环节: "GMP 生产", 描述: "中游制造", "壁垒/机会": "产能与合规" }),
  ],
  policyContext: [row({ "政策/监管": "放射性药品注册", 要点: "NMPA 专项要求", 影响: "拉长上市周期" })],
  gaps: [{ text: "缺少第三方行业规模数据", confidence: "gap" }],
};

s["business-operations"] = {
  journeyMap: {
    stages: ["研发", "注册", "生产", "商业化"],
    lanes: [
      { label: "主路径", nodes: ["候选分子", "IND/临床", "GMP 量产", "医院准入"] },
      { label: "备选", nodes: ["合作引进", "快速注册", "委托生产", "经销商渠道"] },
    ],
  },
  revenueTree: [
    row({ "应用/产品场景": "肿瘤 PET 诊断", 价值主张: "高灵敏度影像", "证据/缺口": "临床数据" }),
    row({ "应用/产品场景": "治疗用放射性药物", 价值主张: "靶向治疗", "证据/缺口": "管线早期" }),
  ],
  flywheel: [{ paragraphs: ["医院覆盖 → 销量验证 → 产能利用率提升 → 成本下降 → 更强渠道谈判力。"] }],
  customerBuyer: [
    row({ "客户/受众/付费方": "三甲医院核医学科", 需求: "稳定供应", "获客/渠道": "直销/经销商", 验证状态: "意向" }),
    row({ "客户/受众/付费方": "医保/商保支付方", 需求: "可报销目录", "获客/渠道": "准入团队", 验证状态: "未启动" }),
  ],
  pricing: [row({ 收入来源: "医院销售", "定价/费率": "待收集", "成本/履约": "GMP+物流", "单位经济/KPI": "待建模" })],
};

s["legal-ownership"] = {
  entities: [
    row({ "主体/权利": "源天生物", "角色/归属": "运营主体", "限制/负担": "待核实", "证据/缺口": "工商档案" }),
    row({ "主体/权利": "生产合作方", "角色/归属": "OEM", "限制/负担": "合同待签", "证据/缺口": "协议" }),
  ],
  contractRights: [row({ 合同权利: "技术许可", 范围: "待核实", 限制: "排他性未知", 证据: "BP" })],
  unresolvedLegalIssues: [{ text: "股权结构与 IP 归属待法律尽调", confidence: "gap" }],
};

s["regulatory-compliance"] = {
  jurisdictionRows: [
    row({ "监管/规则": "放射性药品注册", 适用原因: "产品上市", "状态/许可": "评估中", "红线/下一步": "顾问预审" }),
    row({ "监管/规则": "GMP 生产许可", 适用原因: "商业化生产", "状态/许可": "待核实", "红线/下一步": "产线审计" }),
  ],
  licenseRequirements: [row({ 许可要求: "放射性药品生产许可证", 状态: "待申请", 负责人: "运营" })],
  approvalPath: [row({ 审批路径: "IND→临床→NDA", 步骤: "多阶段", 时间: "36+ 月" })],
  gaps: [{ text: "环保与辐射安全合规文件缺失", confidence: "gap" }],
};

s["resource-network"] = {
  parties: [
    row({ "主体/资源": "生产合作方", "关系与作用": "GMP 产能", "强度/可验证性": "待签", "依赖与风险": "产能瓶颈" }),
    row({ "主体/资源": "CRO/注册顾问", "关系与作用": "注册路径", "强度/可验证性": "意向", "依赖与风险": "时间表" }),
    row({ "主体/资源": "医院 KOL", "关系与作用": "临床与准入", "强度/可验证性": "早期", "依赖与风险": "关系深度" }),
  ],
  capabilities: [row({ 能力: "药物研发", 来源: "内部团队", 缺口: "临床运营" })],
  missingResources: [{ text: "缺少 CFO 级财务模型与第三方审计", confidence: "gap" }],
};

s["comps-benchmark"] = {
  compsRows: [
    row({ 可比对象: "国内 PET 药物 A", 可比逻辑: "同赛道", "指标/倍数": "PS 待收集", "可借鉴/差异": "产能差异" }),
    row({ 可比对象: "海外 radiopharma B", 可比逻辑: "商业化阶段", "指标/倍数": "EV/Sales", "可借鉴/差异": "监管路径" }),
  ],
  transactionCases: [row({ 交易案例: "2024 年并购案 X", 条款: "待收集", 启示: "溢价与产能挂钩" })],
  relevanceNotes: [{ text: "可比公司财务数据仍不完整", confidence: "gap" }],
};

s["valuation-returns"] = {
  scenarios: [
    { label: "Downside", value: "IRR 待测算", detail: "注册延迟 24 月" },
    { label: "Base", value: "IRR 待测算", detail: "按 BP 节奏商业化" },
    { label: "Upside", value: "IRR 待测算", detail: "多管线+产能提前" },
  ],
  sensitivityItems: [
    row({ 敏感变量: "注册周期", 影响方向: "负向", "阈值/区间": "+12 月", 观察方式: "监管沟通" }),
    row({ 敏感变量: "产能利用率", 影响方向: "正向", "阈值/区间": ">70%", 观察方式: "产线 KPI" }),
  ],
  investmentCashflow: [row({ 资金用途: "GMP 建设", "金额/比例": "待核实", 说明: "CapEx 主导" })],
  gaps: [{ text: "缺少 DCF 与可比估值交叉验证", confidence: "gap" }],
};

s["diligence-gaps"] = {
  questionGroups: [
    {
      priority: "P1",
      title: "产能与注册",
      questions: [
        { question: "GMP 产线是否已就绪？", whyItMatters: "影响时间表", owner: "运营", requiredEvidence: "审计报告" },
        { question: "注册路径是否经顾问确认？", whyItMatters: "影响估值", owner: "监管", requiredEvidence: "顾问 memo" },
        { question: "核心 IP 归属是否清晰？", whyItMatters: "交易结构", owner: "法务", requiredEvidence: "专利清单" },
      ],
    },
    {
      priority: "P2",
      title: "商业与财务",
      questions: [
        { question: "首单医院协议是否签署？", whyItMatters: "验证需求", owner: "BD" },
        { question: "A 轮估值假设依据？", whyItMatters: "定价", owner: "财务" },
      ],
    },
  ],
};

s["risks-mitigation"] = {
  riskRows: [
    { level: "高", risk: "注册路径不确定", cause: "监管变化", impact: "推迟收入", mitigation: "聘请监管顾问预审路径", evidenceSourceIds: ["U-1"] },
    { level: "高", risk: "产能瓶颈", cause: "产线未就绪", impact: "无法交付", mitigation: "锁定 OEM 并审计产线", evidenceSourceIds: ["U-1"] },
    { level: "中", risk: "单一客户依赖", cause: "渠道早期", impact: "收入波动", mitigation: "多元化 BD 拓展医院" },
    { level: "中", risk: "融资节奏", cause: "资本环境", impact: "研发中断", mitigation: "按里程碑分阶段融资" },
    { level: "低", risk: "人才流失", cause: "团队规模小", impact: "研发延迟", mitigation: "核心团队激励留任" },
  ],
};

s["timeline-milestones"] = {
  occurred: [
    { date: "2026-04-01", title: "收到 BP", detail: "项目方提供简版 BP。", phase: "occurred", evidenceSourceIds: ["U-1"] },
    { date: "2026-05-15", title: "内部初评", detail: "团队完成首轮阅读。", phase: "occurred" },
  ],
  inProgress: [{ title: "资料请求", detail: "发送 P1 尽调清单。", phase: "inProgress" }],
  future: [{ date: "T+30", title: "资料补齐会议", detail: "核对产能与注册。", phase: "future" }],
};

s["decision-framework"] = {
  recommendation: "建议继续资料请求，暂不进入 IC；若 30 天内补齐 P1 证据再评估。",
  decisionTable: [
    row({ 选项: "继续跟踪", 好处: "保留期权", "代价/风险": "研究成本", 适用条件: "P1 资料补齐" }),
    row({ 选项: "暂停", 好处: "节省资源", "代价/风险": "错失窗口", 适用条件: "gating 未解" }),
  ],
  nextActions: [
    row({ 下一步: "发送尽调清单", Owner: "投资团队", 时间: "T+3", 交付物: "问题清单" }),
    row({ 下一步: "安排专家访谈", Owner: "研究", 时间: "T+14", 交付物: "访谈纪要" }),
  ],
  goNoGoConditions: [row({ 投资论点: "注册路径可行", 证据: "顾问 memo", 前置条件: "P1 完成", "反证/风险": "监管否决" })],
};

thin.sources = [
  {
    id: "U-1",
    type: "用户上传",
    title: "源天生物 BP 2026年4月简版",
    author: "项目方",
    excerpt: "PET 药物管线摘要。",
    usedIn: ["snapshot", "timeline-milestones", "risks-mitigation"],
  },
];

const quality = validateFullStructuredKbQuality(thin as never);
if (!quality.ok) {
  console.error("Rich fixture still fails quality:", quality.coverageScore, quality.issues.slice(0, 5));
  process.exit(1);
}

writeFileSync(richPath, `${JSON.stringify(thin, null, 2)}\n`, "utf8");
console.log(`Wrote ${richPath} (coverage ${quality.coverageScore}/100)`);
