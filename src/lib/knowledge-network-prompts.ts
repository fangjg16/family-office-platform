/** 项目知识网络：对话预填话术（与 Worker detectKnowledgeNetworkUpdateMode 四类模式对齐：initial / incremental / full / reorder） */

/** 进入对话后请用户在【】内写明要改/删的 slot，再发送 */
export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请对项目知识网络进行增量更新（按 canonical slot 调整，未列明的 slot 均保持不变）。

【本次拟修订的 slot / 锚点】
（请在此填写，例如：仅更新 #timeline；或更新 #returns 投资人回报假设）

请先读取现有 KB-CONFIG，保持 display-order 不变（除非另有重排请求）。可结合最新资料包与本对话附件。请在**同一条回复末尾**附完整更新后的 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_REORDER_PROMPT = `请调整项目知识网络的展示顺序（轻量重排，不重写内容）。

【期望顺序】
（请在此填写，例如：把 #returns 移到 #comps 前面；或按 real-estate-dev 默认顺序重置）

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
