/** 项目知识网络：对话预填话术（与 Worker detectKnowledgeNetworkUpdateMode 对齐） */

/** 进入对话后请用户在【】内写明要改/删的 section，再发送 */
export const KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT = `请按板块更新项目知识网络（增量模式，只改我点名的部分）。

【本次要修改或删除的 section】：
（请在此写明，例如：仅更新 #timeline 的 8.1；或隐藏「风险矩阵」整节；其余 section 保持不动）

可结合最新资料包与本对话附件。`;

export const KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT =
  "请全量重做项目知识网络（从零按 kb-template 生成，忽略旧版 HTML）。";

export const KNOWLEDGE_NETWORK_INITIAL_PROMPT =
  "请根据项目资料包生成本项目的知识网络 HTML（首次创建，完成后通过 API 回传）。";

export type KnowledgeNetworkChatEntryState = {
  draftMessage?: string;
};
