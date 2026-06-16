/** 项目知识网络：对话预填话术（与 Worker detectKnowledgeNetworkUpdateMode 四类模式对齐） */

export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请对项目知识网络进行增量更新（按板块调整，未点名的板块均保持不变）。

【本次拟修订的板块】
（请填写要更新的板块，例如：项目时间轴 / #timeline；关键风险 / #risks；投资回报 / #returns；待确认问题 / #open-questions）

说明：中文板块名与 #英文锚点 等价，无需只写英文。

请先读取现有 KB-CONFIG，保持 display-order 不变（除非另有重排请求）。可结合最新资料包与本对话附件。请在**同一条回复末尾**附完整更新后的 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_REORDER_PROMPT = `请调整项目知识网络的展示顺序（轻量重排，不重写内容）。

【期望顺序】
（请用中文或锚点描述，例如：把项目时间轴移到法律结构后面；把市场对标放到业务模式后；把决策框架提前到第二；或写「重排章节顺序」）

说明：可用中文板块名（项目时间轴、市场对标、决策框架等），不必写 #timeline。

执行要求：
1. 必须先 GET 当前版 HTML。
2. 仅更新 <!-- KB-CONFIG -->（display-order、config-version、display-order-history）、nav 按钮顺序与各 section <h2> 编号。
3. **禁止**重写任何内容面板。
4. 同一条回复末尾附完整 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT =
  "请全量重做项目知识网络：依 v2.8 assets/kb-template.html 从零生成，写入完整 KB-CONFIG，不沿用旧版 HTML。请在**本条回复末尾**附完整 ```html 整页。";

export const KNOWLEDGE_NETWORK_INITIAL_PROMPT = `请基于当前项目资料包，生成本项目的知识网络单页 HTML（首次发布，遵循 v2.8 assets/kb-template.html + KB-CONFIG）。

交付说明：
1. 按 project-intake 识别 project-type，在 <body> 开头写入 <!-- KB-CONFIG -->（含 display-order、project-type、rendering-mode、multi-asset、config-version、display-order-history）。
2. 正文前部：3–5 行执行摘要（结构、覆盖范围与要点）。
3. 同一条回复末尾：附完整 \`\`\`html 整页（须含 <!DOCTYPE html>），供平台预览与入库。
4. 请一次性完成上述交付，勿仅说明「已保存至文件」，亦无需我另行补发 HTML。`;

export type KnowledgeNetworkChatEntryState = {
  draftMessage?: string;
};
