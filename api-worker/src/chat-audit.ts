/** 对话审计日志：append-only，与 user_chat_messages 分离 */

export type ChatAuditEnv = { DB: D1Database };

export type AuditEvent = "created" | "deleted";
export type AuditSource = "chat_sync" | "agent_job" | "conversation_delete";

export type ChatMessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  files_json: string | null;
  time_label: string;
  sort_index: number;
  knowledge_network_html: string | null;
};

function newAuditId(): string {
  return `audit-${Date.now()}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function hasAuditEvent(
  env: ChatAuditEnv,
  userId: string,
  messageId: string,
  event: AuditEvent,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM chat_message_audit_log
     WHERE user_id = ? AND message_id = ? AND event = ? LIMIT 1`,
  )
    .bind(userId, messageId, event)
    .first<{ ok: number }>();
  return Boolean(row?.ok);
}

export async function auditMessageCreated(
  env: ChatAuditEnv,
  params: {
    userId: string;
    conversationId: string;
    messageId: string;
    role: string;
    content: string;
    filesJson?: string | null;
    knowledgeNetworkHtml?: string | null;
    timeLabel: string;
    sortIndex: number;
    source: AuditSource;
  },
): Promise<boolean> {
  if (!params.messageId?.trim()) return false;
  if (await hasAuditEvent(env, params.userId, params.messageId, "created")) {
    return false;
  }
  await env.DB.prepare(
    `INSERT INTO chat_message_audit_log (
       id, user_id, conversation_id, message_id, event, role, content,
       files_json, knowledge_network_html, time_label, sort_index, source, created_at
     ) VALUES (?, ?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newAuditId(),
      params.userId,
      params.conversationId,
      params.messageId,
      params.role === "assistant" ? "assistant" : "user",
      params.content ?? "",
      params.filesJson ?? null,
      params.knowledgeNetworkHtml ?? null,
      params.timeLabel,
      params.sortIndex,
      params.source,
      nowIso(),
    )
    .run();
  return true;
}

export async function auditMessageDeleted(
  env: ChatAuditEnv,
  params: {
    userId: string;
    conversationId: string;
    messageId: string;
    role: string;
    content: string;
    filesJson?: string | null;
    knowledgeNetworkHtml?: string | null;
    timeLabel: string;
    sortIndex: number;
    source: AuditSource;
  },
): Promise<boolean> {
  if (!params.messageId?.trim()) return false;
  if (await hasAuditEvent(env, params.userId, params.messageId, "deleted")) {
    return false;
  }
  await env.DB.prepare(
    `INSERT INTO chat_message_audit_log (
       id, user_id, conversation_id, message_id, event, role, content,
       files_json, knowledge_network_html, time_label, sort_index, source, created_at
     ) VALUES (?, ?, ?, ?, 'deleted', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newAuditId(),
      params.userId,
      params.conversationId,
      params.messageId,
      params.role === "assistant" ? "assistant" : "user",
      params.content ?? "",
      params.filesJson ?? null,
      params.knowledgeNetworkHtml ?? null,
      params.timeLabel,
      params.sortIndex,
      params.source,
      nowIso(),
    )
    .run();
  return true;
}

export async function fetchChatMessageRow(
  env: ChatAuditEnv,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<ChatMessageRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html
     FROM user_chat_messages
     WHERE user_id = ? AND conversation_id = ? AND id = ?`,
  )
    .bind(userId, conversationId, messageId)
    .first<ChatMessageRow>();
  return row ?? null;
}

export async function auditDeletedFromChatRow(
  env: ChatAuditEnv,
  userId: string,
  row: ChatMessageRow,
  source: AuditSource,
): Promise<void> {
  await auditMessageDeleted(env, {
    userId,
    conversationId: row.conversation_id,
    messageId: row.id,
    role: row.role,
    content: row.content,
    filesJson: row.files_json,
    knowledgeNetworkHtml: row.knowledge_network_html,
    timeLabel: row.time_label,
    sortIndex: row.sort_index,
    source,
  });
}

export async function auditDeletedBeforeUserDelete(
  env: ChatAuditEnv,
  userId: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  const row = await fetchChatMessageRow(env, userId, conversationId, messageId);
  if (row) {
    await auditDeletedFromChatRow(env, userId, row, "chat_sync");
  }
}

export async function auditAllMessagesInConversationDeleted(
  env: ChatAuditEnv,
  userId: string,
  conversationId: string,
  source: AuditSource,
): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html
     FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
  )
    .bind(userId, conversationId)
    .all<ChatMessageRow>();

  for (const row of results ?? []) {
    await auditDeletedFromChatRow(env, userId, row, source);
  }
}

export async function listConversationMessageRows(
  env: ChatAuditEnv,
  userId: string,
  conversationId: string,
): Promise<ChatMessageRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html
     FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
  )
    .bind(userId, conversationId)
    .all<ChatMessageRow>();
  return results ?? [];
}

export type AuditLogListParams = {
  userId?: string;
  conversationId?: string;
  messageId?: string;
  event?: AuditEvent;
  limit?: number;
};

export type AuditLogEntry = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  event: AuditEvent;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
  knowledgeNetworkHtml?: string | null;
  timeLabel: string | null;
  sortIndex: number | null;
  source: string;
  createdAt: string;
};

export async function listChatAuditLog(
  env: ChatAuditEnv,
  params: AuditLogListParams,
): Promise<AuditLogEntry[]> {
  const limit = Math.min(Math.max(params.limit ?? 80, 1), 200);
  const clauses: string[] = [];
  const binds: (string | number)[] = [];

  if (params.userId?.trim()) {
    clauses.push("user_id = ?");
    binds.push(params.userId.trim());
  }
  if (params.conversationId?.trim()) {
    clauses.push("conversation_id = ?");
    binds.push(params.conversationId.trim());
  }
  if (params.messageId?.trim()) {
    clauses.push("message_id = ?");
    binds.push(params.messageId.trim());
  }
  if (params.event === "created" || params.event === "deleted") {
    clauses.push("event = ?");
    binds.push(params.event);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  binds.push(limit);

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, conversation_id, message_id, event, role, content,
            files_json, knowledge_network_html, time_label, sort_index, source, created_at
     FROM chat_message_audit_log ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(...binds)
    .all<{
      id: string;
      user_id: string;
      conversation_id: string;
      message_id: string;
      event: string;
      role: string;
      content: string;
      files_json: string | null;
      knowledge_network_html: string | null;
      time_label: string | null;
      sort_index: number | null;
      source: string;
      created_at: string;
    }>();

  return (results ?? []).map((r) => {
    let files: { name: string }[] | undefined;
    if (r.files_json) {
      try {
        const parsed = JSON.parse(r.files_json) as { name: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) files = parsed;
      } catch {
        /* ignore */
      }
    }
    return {
      id: r.id,
      userId: r.user_id,
      conversationId: r.conversation_id,
      messageId: r.message_id,
      event: r.event === "deleted" ? "deleted" : "created",
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
      files,
      knowledgeNetworkHtml: r.knowledge_network_html,
      timeLabel: r.time_label,
      sortIndex: r.sort_index,
      source: r.source,
      createdAt: r.created_at,
    };
  });
}
