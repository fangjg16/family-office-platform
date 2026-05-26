/** 网站对话模式：标准 RAG / 深度尽调 / 知识网络 HTML */

const DEEP_ANALYSIS_RE =
  /project[-\s]?intake|intake|入驻|五维|覆盖度|尽调清单|dd[-\s]?checklist|ic\s*memo|投资委员会|成熟度诊断|资料覆盖|结构化摘要|全面分析|完整分析|深度分析|系统化.*尽调/u;

const KNOWLEDGE_NETWORK_RE =
  /知识网络|知识底座|knowledge\s*base|knowledge\s*network|生成.*html|更新\s*kb|refresh\s*kb|项目知识网络|\[AI\].*知识网络/u;

export type ChatMode = "standard" | "deep" | "knowledge_network";

export function detectChatMode(message: string): ChatMode {
  const m = message.trim();
  if (KNOWLEDGE_NETWORK_RE.test(m)) return "knowledge_network";
  if (DEEP_ANALYSIS_RE.test(m)) return "deep";
  return "standard";
}

export function deepAnalysisSystemLines(): string[] {
  return [
    "【深度尽调模式】用户需要完整、结构化的投资分析，而非简短问答。",
    "你必须基于【资料摘录】中的全部相关内容作答；摘录不足时明确列出缺口（✅/⚠️/❌），不得编造未出现的数据。",
    "默认输出结构（可按用户要求调整）：",
    "1）项目摘要（标的、区位、业态、阶段、交易逻辑）；",
    "2）五维覆盖度：区位政策、功能设施、招商进度、建设状态、财务风险——每项标注 ✅/⚠️/❌ 并一句话依据；",
    "3）关键风险与待核实项；",
    "4）下一步建议（需补哪些材料）。",
    "禁止回答「无权限访问 API」「请去 Hermes 操作」——网站已注入项目资料包正文，直接分析即可。",
    "引用上传资料仍用 [ID:n]；推论须标明「推论」或「待核实」。",
  ];
}

export function knowledgeNetworkSystemLines(projectNameHint?: string): string[] {
  const name = projectNameHint?.trim() || "本项目";
  return [
    "【知识网络 HTML 模式】用户需要合域 v2 风格的单文件项目知识网络 HTML。",
    `输出文件名逻辑：[AI] ${name}_知识网络.html（在回复开头用一行说明文件名即可）。`,
    "你必须输出**完整可运行的单文件 HTML**，放在 markdown 代码块中，语言标记为 html，例如：",
    "```html",
    "<!DOCTYPE html>…完整文档…",
    "```",
    "HTML 必须遵守合域 Portable 主题（米色纸纹背景、酒红 #722f37 强调、Playfair + Inter/Noto 字体）：",
    "- 结构：.kb-shell > nav.kb-nav（左侧板块按钮）+ main.kb-content（.kb-panel 切换）；",
    "- 必须包含：masthead、.kb-summary（≤200字中文总览）、至少「一、项目快照」面板；有资料的其他板块（资产构成、商业模式、风险等）按摘录充实；",
    "- 必须内联完整 <style>（Portable 主题）与 panel-switcher 的 <script>（ vanilla JS，无依赖）；",
    "- 事实用 certainty tag：✅已核实 / 🟡对方陈述 / 🔵分析师推论 / ⚪待核实；",
    "- 缺乏资料的板块用 callout 标明「缺乏资料」，勿编造。",
    "禁止只给大纲或说「请到 Hermes 生成」——在网站对话中直接生成 HTML。",
    "若摘录不足以填满某板块，保留该板块骨架并标注待补充。",
    "回复中除 ```html 代码块外，可用简短中文说明本次更新了哪些板块。",
  ];
}

/** 从模型回复中提取知识网络 HTML（供前端预览/下载） */
export function extractKnowledgeNetworkHtml(answer: string): string | null {
  const fence = answer.match(/```html\s*([\s\S]*?)```/i);
  if (!fence) return null;
  const html = fence[1].trim();
  if (html.length < 200) return null;
  if (!/<html[\s>]/i.test(html) && !/kb-shell|项目知识网络/i.test(html)) return null;
  return html;
}
