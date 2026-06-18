/** 项目知识网络：对话预填话术（Hermes v2.92 / schema v2.91） */

export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请对项目知识网络进行增量更新（按板块调整，未点名的板块均保持不变）。

【本次拟修订的板块】
（请填写要更新的板块，例如：项目时间轴 / #timeline-milestones；关键风险 / #risks-mitigation；投资回报 / #valuation-returns；监管合规 / #regulatory-compliance；待确认问题 / #diligence-gaps）

说明：中文板块名与 #英文锚点 等价，无需只写英文。当前标准为 v2.91 共 13 个 core slot。

请先读取现有 KB-CONFIG（schema-version: 2.91），保持 display-order 不变（除非另有重排请求）。可结合最新资料包与本对话附件。请在**同一条回复末尾**附完整更新后的 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_REORDER_PROMPT = `请调整项目知识网络的展示顺序（轻量重排，不重写内容）。

【期望顺序】
（请用中文或锚点描述，例如：把项目时间轴移到法律结构后面；把市场对标放到业务模式后；重排章节顺序）

说明：可用中文板块名，不必写英文 anchor。13 个 core slot 须各出现一次。

执行要求：
1. 必须先 GET 当前版 HTML。
2. 仅更新 <!-- KB-CONFIG -->（display-order、config-version、display-order-history）、nav 按钮顺序与各 section <h2> 编号。
3. **禁止**重写任何内容面板。
4. 同一条回复末尾附完整 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT =
  "请全量重做项目知识网络：legacy v2.8 / 11-slot KB 须重建为 v2.91 13-slot schema（Hermes v2.92）。依 assets/kb-template.html 从零生成，写入完整 KB-CONFIG（schema-version: 2.91），不沿用旧版 HTML。请在**本条回复末尾**附完整 ```html 整页。";

export const KNOWLEDGE_NETWORK_INITIAL_PROMPT = `请基于当前项目资料包，生成本项目的知识网络单页 HTML（首次发布，Hermes v2.92 · schema v2.91）。

交付说明：
1. 按 project-intake 识别 project-type，在 <body> 开头写入 <!-- KB-CONFIG -->（schema-version: 2.91、display-order、project-type、rendering-mode、multi-asset、config-version、display-order-history）。
2. 渲染 13 个 core slot + Appendix A–D（source-index、glossary、data-dictionary、version-ledger）。
3. 正文前部：3–5 行执行摘要。
4. 同一条回复末尾：附完整 \`\`\`html 整页（须含 <!DOCTYPE html>），供平台预览与入库。`;

export type KnowledgeNetworkChatEntryState = {
  draftMessage?: string;
};
