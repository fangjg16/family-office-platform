/** 项目知识网络：对话预填话术（与 Worker detectKnowledgeNetworkUpdateMode / 交付意图正则对齐） */

/** 进入对话后请用户在【】内写明要改/删的 section，再发送 */
export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请对项目知识网络进行增量更新（按板块调整，未列明的 section 均保持不变）。

【本次拟修订或下架的 section】
（请在此填写，例如：仅更新 #timeline 第 8.1 节；或隐藏「风险矩阵」整节）

可结合最新资料包与本对话附件。请在**同一条回复末尾**附完整更新后的 \`\`\`html 整页。`;

export const KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT =
  "请全量重做项目知识网络：依 kb-template 从零生成，不沿用旧版 HTML。请在**本条回复末尾**附完整 ```html 整页。";

export const KNOWLEDGE_NETWORK_INITIAL_PROMPT = `请基于当前项目资料包，生成本项目的知识网络单页 HTML（首次发布，遵循 kb-template）。

交付说明：
1. 正文前部：3–5 行执行摘要（结构、覆盖范围与要点）。
2. 同一条回复末尾：附完整 \`\`\`html 整页（须含 <!DOCTYPE html>），供平台预览与入库。
3. 请一次性完成上述交付，勿仅说明「已保存至文件」，亦无需我另行补发 HTML。`;

export type KnowledgeNetworkChatEntryState = {
  draftMessage?: string;
};
