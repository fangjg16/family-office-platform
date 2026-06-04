/**
 * 网站对话 ↔ Hermes 16 skills 意图映射（内部用，用户不可见 skill 名）
 *
 * jfo-r2-materials：由 Worker 注入 package 全文摘录实现，不单独对用户暴露。
 * public-info-search：与 Tavily 联网配合（index 里强制触发外部检索）。
 */

export type SkillIntent =
  | "standard"
  | "project_intake"
  | "knowledge_network"
  | "ic_memo"
  | "dd_checklist"
  | "dd_claim_audit"
  | "document_reorganize"
  | "public_info_search"
  | "term_annotator"
  | "comp_analysis"
  | "background_check"
  | "risk_matrix"
  | "returns_analysis"
  | "sensitivity_analysis"
  | "value_creation_plan"
  | "gap_tracking"
  | "node_monitoring";

/** @deprecated 用 SkillIntent；保留别名供 API 字段兼容 */
export type ChatMode = SkillIntent;

type IntentRule = { intent: SkillIntent; re: RegExp };

/** 越靠前优先级越高（更具体的意图先匹配） */
const INTENT_RULES: IntentRule[] = [
  { intent: "knowledge_network", re: /知识网络|知识底座|knowledge\s*base|knowledge\s*network|生成.*html|生成\s*kb|更新\s*kb|项目知识网络|\[AI\].*知识网络|build project profile|organize what we know/u },
  { intent: "ic_memo", re: /投资委员会|ic\s*memo|ic备忘录|投资决策备忘录|立项备忘录|表决建议|条款清单|投委会|decision memo|prepare for ic|总结一下这个项目|write up the deal/u },
  { intent: "dd_checklist", re: /dd\s*checklist|尽调清单|diligence request|data room review|尽调跟踪|还要查什么|what do we still need to check|工作流清单/u },
  { intent: "dd_claim_audit", re: /声明审计|claim audit|verify claims|cross check|信息审计|矛盾|contradiction|审计.*声明|可信度|is this true|audit this/u },
  { intent: "risk_matrix", re: /风险矩阵|risk matrix|风险评估|what could go wrong|what are the risks|风险登记/u },
  { intent: "returns_analysis", re: /回报测算|returns analysis|what'?s the irr|投资回报|financial model|cash flow model|irr|npv|equity multiple/u },
  { intent: "sensitivity_analysis", re: /敏感性分析|sensitivity|what if|假设变动|tornado|stress test|情景/u },
  { intent: "comp_analysis", re: /可比交易|comp analysis|comparable|估值参照|对标|market positioning|what'?s this worth/u },
  { intent: "background_check", re: /背景调查|background check|对手调查|实控人|counterparty|who is this|check the seller|关联交易/u },
  { intent: "value_creation_plan", re: /增值方案|value creation|投后增值|value-add|how do we add value|what can we do with this asset/u },
  { intent: "gap_tracking", re: /信息缺口|gap tracking|what'?s missing|outstanding items|还缺什么|缺口清单|gap status/u },
  { intent: "node_monitoring", re: /节点监控|node monitoring|关键节点|decision nodes|what are we waiting for|外部事件|monitor/u },
  { intent: "document_reorganize", re: /整理文件|organize document|file index|文档索引|sort these files|有哪些文件|文件分类/u },
  { intent: "term_annotator", re: /术语表|glossary|专有名词|add footnote|什么是 da|explain lfp|footnote/u },
  { intent: "public_info_search", re: /查外部资料|公开信息|public info|搜一下|search for|background on|网上查|联网搜索|what can we find on/u },
  {
    intent: "project_intake",
    re: /project[-\s]?intake|intake|入驻|五维|覆盖度|尽调(?!清单)|成熟度诊断|资料覆盖|全面分析|完整分析|深度分析|分析.{0,6}项目|项目.{0,6}分析|怎么看.{0,8}项目|帮我看|看下这个项目|new project|look at this deal|投资价值|交易结构|瓶颈|硬实力/u,
  },
];

export function detectSkillIntent(message: string): SkillIntent {
  const m = message.trim();
  for (const { intent, re } of INTENT_RULES) {
    if (re.test(m)) return intent;
  }
  return "standard";
}

/** @deprecated */
export const detectChatMode = detectSkillIntent;

export function usesFullPackageCorpus(intent: SkillIntent): boolean {
  return intent !== "standard";
}

export function shouldForceExternalSearch(intent: SkillIntent): boolean {
  return intent === "public_info_search";
}

/** 非轻问任务走 Hermes Agent（真 skills），需配置 HERMES_BASE_URL + HERMES_API_KEY */
export function shouldRouteToHermes(intent: SkillIntent): boolean {
  return intent !== "standard";
}

export function websitePlatformIdentityLines(): string[] {
  return [
    "【平台身份】你是「联合家办平台」项目页里的唯一 AI 助手。用户不知道、也不需要知道 Hermes、skill、插件、合域、Opportunistic 等后台实现。",
    "【表达禁令】禁止提及 Hermes、投资智库、skill 名、JSON Schema、导出到某系统、带产品名的「标准模板」。",
    "【元叙述禁令】禁止用整段开场白解释工作方式（如「我们以机会型投资视角」「全文仅使用报告」）——直接写交付正文。",
    "【收尾禁令】禁止结尾推销「如需生成 Hermes xxx」；下一步用人话，如「需要尽调清单或 IC 备忘录，直接说即可」。",
    "本页可完成全部深度交付：入驻评估、尽调清单、风险矩阵、回报测算、知识网络 HTML、IC 备忘录等，均在对话内完成。",
    "对人话命名：项目入驻评估、尽调清单、风险矩阵、投资委员会备忘录、项目知识网络、公开资料检索（「查外部资料：…」）。",
  ];
}

function sharedCorpusLines(): string[] {
  return [
    "已注入本项目资料包摘录（含用户上传的尽调等材料）。基于摘录作答；不足处标「缺乏资料/待核实」，勿编造。",
    "引用上传资料用 [ID:n]；推论标「推论」或「待核实」。",
  ];
}

const SKILL_PROMPTS: Record<Exclude<SkillIntent, "standard">, string[]> = {
  project_intake: [
    "【项目入驻/成熟度评估】输出结构化项目分析：核心定位、资产与设施、招商建设、财务要点、主要风险（⚠️）、建议（✅）。",
    "若涉及五维：区位政策、功能设施、招商进度、建设状态、财务风险——每项 ✅/⚠️/❌ + 依据。",
  ],
  knowledge_network: [
    "【项目知识网络 HTML】在本条回复末尾附完整单文件 HTML（米色 Portable）于 ```html 代码块（含 <!DOCTYPE>）；前面可写简短摘要。禁止只写磁盘路径、禁止让用户再发一条消息补 HTML。",
  ],
  ic_memo: [
    "【投资委员会备忘录（草稿）】Markdown：投资概要、标的与交易、投资逻辑、主要风险与缓释、关键条款/交割条件、表决建议（通过/有条件/否决及条件）。",
  ],
  dd_checklist: [
    "【尽调清单】按行业与交易类型生成多工作流 checklist 表格，列：工作流 | 检查项 | 状态 | 优先级 | 备注。",
    "工作流至少含：财务、法律、税务、商业/运营、工程/建设、环境、人事、IT。结合【资料摘录】标注已覆盖项，其余标待索取。",
    "状态列仅用：✅已有、⚠️部分、❌缺失（或待索取）。不要写「dd-checklist skill」；标题用「尽调清单与待办」。",
    "输出格式：先一行标题 ## 尽调清单与待办，简短说明不超过 2 行，然后直接输出 Markdown 表格；不要长段元叙述（如「我们以机会型视角」）。",
  ],
  dd_claim_audit: [
    "【声明与数据审计】列出材料中的关键声明/数字，逐条：声明内容 | 来源 [ID:n] | 可信度（✅/🟡/🔵/⚪）| 交叉验证 | 矛盾或待核项。",
  ],
  document_reorganize: [
    "【项目文件索引】按类型整理已知文件：文件名 | 类型（尽调/财务/法律/…）| 日期 | 摘要一句 | 关联项。基于摘录与文件名推断。",
  ],
  public_info_search: [
    "【公开信息检索】本轮应结合【外部检索】与【资料摘录】：先列公开来源要点 [WEB:n]，再与内部材料对照（一致/差异/待核）。",
  ],
  term_annotator: [
    "【术语注释】列出文中专业术语表格：术语 | 英文/缩写 | 简要解释 | 首次出现上下文。若用户针对某词提问，重点解释该词。",
  ],
  comp_analysis: [
    "【可比与定位】表格：可比项目/交易 | 区位/业态 | 规模/价格或租金 | 差异点；并给出本项目差异化定位与估值参照区间（资料不足则标待核实）。",
  ],
  background_check: [
    "【背景调查框架】交易对手/主体：股权结构、实控人、诉讼/信用/声誉（摘录有的写 ✅，无则列待公开核查项）；勿捏造工商细节。",
  ],
  risk_matrix: [
    "【风险矩阵】表格：风险项 | 类别 | 可能性 | 影响 | 综合等级 | 依据 [ID:n] | 缓释/监控建议。覆盖建设、招商、财务、政策、运营等。",
  ],
  returns_analysis: [
    "【回报测算】基于摘录中的数字：基准/上行/下行情景表格（投资、NOI/租金、Cap Rate、IRR/回收期等）；缺参数则列假设与待补数据。",
  ],
  sensitivity_analysis: [
    "【敏感性分析】列出关键假设及变动对回报/估值的影响（表格或 tornado 文字描述）；标明哪些假设最敏感。",
  ],
  value_creation_plan: [
    "【投后增值方案】杠杆列表：举措 | 预期影响 | 难度/周期 | 依赖条件；分短期（0-12月）与中期。",
  ],
  gap_tracking: [
    "【信息缺口清单】表格：缺口描述 | 影响层级 | 紧急度 | 建议负责人 | 解决方式（索取/公开检索/现场）。",
  ],
  node_monitoring: [
    "【关键节点监控】表格：节点/事件 | 预计时间 | 影响程度 | 若正面/负面结果分别触发什么行动。含建设、招商、政策、融资等。",
  ],
};

export function skillIntentSystemLines(
  intent: SkillIntent,
  projectNameHint?: string,
): string[] {
  if (intent === "standard") return [];
  const name = projectNameHint?.trim() || "本项目";
  const lines = [...sharedCorpusLines(), ...SKILL_PROMPTS[intent]];
  if (intent === "knowledge_network") {
    lines.push(
      `逻辑文件名：[AI] ${name}_知识网络.html；**同一条回复**末尾必须有 \\\`\\\`\\\`html 整页代码块（平台预览与入库依赖此块，一次交付完毕）。`,
    );
  }
  return lines;
}

export function deepAnalysisSystemLines(): string[] {
  return skillIntentSystemLines("project_intake");
}

export function icMemoSystemLines(): string[] {
  return skillIntentSystemLines("ic_memo");
}

export function knowledgeNetworkSystemLines(projectNameHint?: string): string[] {
  return skillIntentSystemLines("knowledge_network", projectNameHint);
}

export function extractKnowledgeNetworkHtml(answer: string): string | null {
  const fence = answer.match(/```html\s*([\s\S]*?)```/i);
  if (!fence) return null;
  const html = fence[1].trim();
  if (html.length < 200) return null;
  if (!/<html[\s>]/i.test(html) && !/kb-shell|项目知识网络/i.test(html)) return null;
  return html;
}

/** 无 ```html 围栏时，从正文抽取整页 HTML（Hermes 常只贴裸 HTML） */
export function extractKnowledgeNetworkHtmlLoose(answer: string): string | null {
  const fenced = extractKnowledgeNetworkHtml(answer);
  if (fenced) return fenced;

  const doctype = answer.match(/(<!DOCTYPE[\s\S]*?<\/html\s*>)/i);
  if (doctype) {
    const html = doctype[1].trim();
    if (html.length >= 200) return html;
  }

  const htmlBlock = answer.match(/(<html[\s\S]*?<\/html\s*>)/i);
  if (htmlBlock) {
    const html = htmlBlock[1].trim();
    if (html.length >= 200 && (/kb-shell|panel-switcher|项目知识网络/i.test(html) || html.length > 800)) {
      return html;
    }
  }

  return null;
}

/** 供前端快捷芯片等人话文案（不含 skill 名） */
export const USER_QUICK_PROMPTS: { label: string; message: string }[] = [
  { label: "分析项目", message: "帮我全面分析下这个项目" },
  { label: "五维覆盖度", message: "根据尽调资料做五维覆盖度，用 ✅⚠️❌ 标注" },
  { label: "尽调清单", message: "生成尽调清单，标出已有和还缺的材料" },
  { label: "风险矩阵", message: "做一版风险矩阵，列主要风险和缓释建议" },
  { label: "IC 备忘录", message: "写一版投资委员会备忘录草稿" },
  { label: "知识网络", message: "生成项目知识网络" },
  { label: "查外部资料", message: "查外部资料：补充这个项目公开信息并与现有材料对照" },
];
