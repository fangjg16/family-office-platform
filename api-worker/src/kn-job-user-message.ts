import {
  assistantMessageIdForJob,
  userMessageIdForJob,
} from "./chat-sync";

export type KnUserMessageLookupRow = {
  id: string;
  role: string;
  content: string;
  sort_index: number;
  pending_job_id: string | null;
};

type KnUserMessageEnv = { DB: D1Database };

/** 纯函数：从会话消息行中解析与 agent job 对应的用户原文 */
export function pickKnUserMessageContent(
  rows: readonly KnUserMessageLookupRow[],
  jobId: string,
  conversationId: string | null,
): string {
  const trimmedJobId = jobId.trim();
  if (!trimmedJobId) return "";

  const userJobId = userMessageIdForJob(trimmedJobId);
  const assistantJobId = assistantMessageIdForJob(trimmedJobId);

  const scoped = rows;

  const byUserJobId = scoped.find((r) => r.id === userJobId && r.role === "user");
  if (byUserJobId?.content?.trim()) return byUserJobId.content.trim();

  const byPending = scoped.find(
    (r) => r.role === "user" && (r.pending_job_id ?? "").trim() === trimmedJobId,
  );
  if (byPending?.content?.trim()) return byPending.content.trim();

  const assistant = scoped.find((r) => r.id === assistantJobId);
  if (assistant) {
    const userBefore = scoped
      .filter((r) => r.role === "user" && r.sort_index < assistant.sort_index)
      .sort((a, b) => b.sort_index - a.sort_index)[0];
    if (userBefore?.content?.trim()) return userBefore.content.trim();
  }

  return "";
}

/** 从 D1 解析 KB 任务对应的用户提问（slot patch finalize 用） */
export async function resolveKnUserMessage(
  env: KnUserMessageEnv,
  row: { id: string; user_id: string; conversation_id: string | null },
): Promise<string> {
  const conversationId = (row.conversation_id ?? "").trim() || null;
  const binds: string[] = [row.user_id];
  let sql = `
    SELECT id, role, content, sort_index, pending_job_id
    FROM user_chat_messages
    WHERE user_id = ?`;
  if (conversationId) {
    sql += ` AND conversation_id = ?`;
    binds.push(conversationId);
  }
  sql += ` ORDER BY sort_index ASC`;

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all<KnUserMessageLookupRow>();

  return pickKnUserMessageContent(results ?? [], row.id, conversationId);
}
