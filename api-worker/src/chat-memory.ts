/** 对话记忆：D1 存滚动摘要 + 最近若干轮完整原文（非「只保留 N 轮」） */

export type ChatMemoryEnv = { DB: D1Database };

export type HistoryTurn = { role: string; content: string };

/** 最近保留的完整对话轮数（user+assistant 算 2 条消息 ≈ 1 轮） */
export const RECENT_FULL_TURN_PAIRS = 6;

/** 超过该轮数时，把更早内容并入摘要 */
export const SUMMARIZE_AFTER_TURN_PAIRS = 10;

export async function getConversationMemorySummary(
  env: ChatMemoryEnv,
  userId: string,
  conversationId: string,
): Promise<string> {
  if (!conversationId) return "";
  try {
    const row = await env.DB.prepare(
      `SELECT memory_summary FROM user_conversations WHERE user_id = ? AND id = ?`,
    )
      .bind(userId, conversationId)
      .first<{ memory_summary: string | null }>();
    return (row?.memory_summary ?? "").trim();
  } catch {
    return "";
  }
}

export async function saveConversationMemorySummary(
  env: ChatMemoryEnv,
  userId: string,
  conversationId: string,
  summary: string,
): Promise<void> {
  if (!conversationId) return;
  const text = summary.trim();
  if (!text) return;
  try {
    await env.DB.prepare(
      `UPDATE user_conversations SET memory_summary = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
    )
      .bind(text, new Date().toISOString(), userId, conversationId)
      .run();
  } catch {
    /* 列未迁移时忽略 */
  }
}

function pairCount(messages: HistoryTurn[]): number {
  return Math.ceil(messages.length / 2);
}

/** 拆成：更早部分（用于摘要）+ 最近完整轮次 */
export function splitHistoryForMemory(
  history: HistoryTurn[],
  recentPairs = RECENT_FULL_TURN_PAIRS,
): { older: HistoryTurn[]; recent: HistoryTurn[] } {
  const maxRecentMessages = recentPairs * 2;
  if (history.length <= maxRecentMessages) {
    return { older: [], recent: history };
  }
  const splitAt = history.length - maxRecentMessages;
  return {
    older: history.slice(0, splitAt),
    recent: history.slice(splitAt),
  };
}

export function buildMemorySystemAddon(summary: string): string[] {
  const s = summary.trim();
  if (!s) return [];
  return [
    "",
    "【此前对话摘要（由平台维护，涵盖更早轮次；以下消息为最近原文）】",
    s,
  ];
}

export function buildLlmMessages(params: {
  systemParts: string[];
  memorySummary: string;
  recentHistory: HistoryTurn[];
  userMessage: string;
}): { role: string; content: string }[] {
  const systemContent = [
    ...params.systemParts,
    ...buildMemorySystemAddon(params.memorySummary),
  ].join("\n");

  return [
    { role: "system", content: systemContent },
    ...params.recentHistory
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: params.userMessage },
  ];
}

export async function refreshConversationMemorySummary(
  env: ChatMemoryEnv & { DASHSCOPE_API_KEY?: string; DASHSCOPE_BASE_URL?: string },
  userId: string,
  conversationId: string,
  fullHistory: HistoryTurn[],
  summarizeFn: (prompt: string) => Promise<string>,
): Promise<void> {
  if (!conversationId || fullHistory.length === 0) return;
  if (pairCount(fullHistory) < SUMMARIZE_AFTER_TURN_PAIRS) return;

  const { older, recent } = splitHistoryForMemory(fullHistory);
  if (older.length === 0) return;

  const existing = await getConversationMemorySummary(env, userId, conversationId);

  const olderText = older
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`)
    .join("\n\n");

  const recentText = recent
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`)
    .join("\n\n");

  const prompt = [
    "你是家办平台对话记忆整理器。请把「更早对话」压缩成结构化摘要，并与「已有摘要」合并，供后续问答使用。",
    "要求：保留项目名、数字、结论、待办、用户偏好；不要编造；中文；800 字以内。",
    "",
    existing ? `【已有摘要】\n${existing}\n` : "",
    `【更早对话原文】\n${olderText}`,
    "",
    "【最近对话（仅作对照，已单独保留原文，勿重复抄写）】",
    recentText.slice(0, 2000),
    "",
    "请输出合并后的【对话摘要】正文：",
  ].join("\n");

  try {
    const next = await summarizeFn(prompt);
    if (next.trim()) {
      await saveConversationMemorySummary(env, userId, conversationId, next);
    }
  } catch {
    /* 摘要失败不影响主对话 */
  }
}
