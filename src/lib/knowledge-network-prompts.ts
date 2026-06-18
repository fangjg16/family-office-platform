/** 项目知识网络：对话预填话术（人话；技术约束由 Worker instructions 注入） */

export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请对项目知识网络进行按板块更新：只改下面点名的板块，其余保持不变。

【本次要改的板块】
（请填写，例如：项目时间轴、关键风险、投资回报、监管合规、待确认问题）

可结合最新资料与本对话附件。完成后交付可预览的完整页面。`;

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
  "请全量重做项目知识网络：结合最新项目资料，从零重新生成整页，不沿用旧版内容。完成后交付可预览的完整页面。";

export const KNOWLEDGE_NETWORK_INITIAL_PROMPT =
  "请基于当前项目资料，首次生成项目知识网络整页，正文前附 3–5 行摘要。完成后交付可预览的完整页面。";

export type KnowledgeNetworkChatEntryState = {
  draftMessage?: string;
};
