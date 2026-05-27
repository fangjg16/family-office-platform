import type { AgentJobRow } from "./agent-jobs";

type ChatSyncEnv = { DB: D1Database };

export type SyncConversation = {
  id: string;
  projectId: string;
  title: string;
  preview: string;
  updatedAt: string;
  files: string[];
  variant?: "demo" | "blank";
};

export type SyncChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string }[];
  time: string;
  sortIndex?: number;
  knowledgeNetworkHtml?: string | null;
  pendingJobId?: string | null;
};

export type DeletedMessageRef = {
  conversationId: string;
  messageId: string;
};

export type ChatStatePatchBody = {
  conversations?: SyncConversation[];
  messagesByConversation?: Record<string, SyncChatMessage[]>;
  /** 显式删除会话（会级联删除该会话下所有消息） */
  deletedConversationIds?: string[];
  /** 显式删除单条消息（删会话请用上项） */
  deletedMessageIds?: DeletedMessageRef[];
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

export function assistantMessageIdForJob(jobId: string): string {
  return `assistant-job-${jobId}`;
}

async function upsertConversation(
  env: ChatSyncEnv,
  userId: string,
  c: SyncConversation,
  now: string,
): Promise<void> {
  if (!c.id || !c.projectId) return;
  await env.DB.prepare(
    `INSERT INTO user_conversations (id, user_id, project_id, title, preview, updated_at, variant, files_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, id) DO UPDATE SET
       project_id = excluded.project_id,
       title = excluded.title,
       preview = excluded.preview,
       updated_at = excluded.updated_at,
       variant = excluded.variant,
       files_json = excluded.files_json`,
  )
    .bind(
      c.id,
      userId,
      c.projectId,
      c.title ?? "",
      c.preview ?? "",
      c.updatedAt ?? now,
      c.variant ?? null,
      JSON.stringify(c.files ?? []),
    )
    .run();
}

async function replaceConversationMessages(
  env: ChatSyncEnv,
  userId: string,
  conversationId: string,
  msgs: SyncChatMessage[],
  now: string,
): Promise<number> {
  await env.DB.prepare(
    `DELETE FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
  )
    .bind(userId, conversationId)
    .run();

  let idx = 0;
  let count = 0;
  for (const m of msgs) {
    if (!m.id) continue;
    const sortIndex =
      typeof m.sortIndex === "number" && Number.isFinite(m.sortIndex) ? m.sortIndex : idx;
    const knHtml =
      typeof m.knowledgeNetworkHtml === "string" ? m.knowledgeNetworkHtml : null;
    const pendingJobId =
      typeof m.pendingJobId === "string" && m.pendingJobId.trim()
        ? m.pendingJobId.trim()
        : null;
    await env.DB.prepare(
      `INSERT INTO user_chat_messages (id, user_id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html, pending_job_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        m.id,
        userId,
        conversationId,
        m.role === "assistant" ? "assistant" : "user",
        m.content ?? "",
        m.files?.length ? JSON.stringify(m.files) : null,
        m.time ?? now,
        sortIndex,
        knHtml,
        pendingJobId,
        now,
      )
      .run();
    idx = Math.max(idx, sortIndex + 1);
    count += 1;
  }
  return count;
}

async function upsertChatMessage(
  env: ChatSyncEnv,
  userId: string,
  conversationId: string,
  m: SyncChatMessage,
  now: string,
): Promise<void> {
  if (!m.id) return;
  const sortIndex =
    typeof m.sortIndex === "number" && Number.isFinite(m.sortIndex) ? m.sortIndex : 0;
  const knHtml =
    typeof m.knowledgeNetworkHtml === "string" ? m.knowledgeNetworkHtml : null;
  const pendingJobId =
    typeof m.pendingJobId === "string" && m.pendingJobId.trim() ? m.pendingJobId.trim() : null;
  await env.DB.prepare(
    `INSERT INTO user_chat_messages (id, user_id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html, pending_job_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, id) DO UPDATE SET
       conversation_id = excluded.conversation_id,
       role = excluded.role,
       content = excluded.content,
       files_json = excluded.files_json,
       time_label = excluded.time_label,
       sort_index = excluded.sort_index,
       knowledge_network_html = excluded.knowledge_network_html,
       pending_job_id = excluded.pending_job_id,
       updated_at = excluded.updated_at`,
  )
    .bind(
      m.id,
      userId,
      conversationId,
      m.role === "assistant" ? "assistant" : "user",
      m.content ?? "",
      m.files?.length ? JSON.stringify(m.files) : null,
      m.time ?? now,
      sortIndex,
      knHtml,
      pendingJobId,
      now,
    )
    .run();
}

/** 增量合并写入：仅 upsert / 按会话替换消息 / 显式删除，不再整用户 DELETE */
export async function applyChatStatePatch(
  env: ChatSyncEnv,
  userId: string,
  body: ChatStatePatchBody,
): Promise<{
  conversationCount: number;
  messageCount: number;
  deletedConversations: number;
  deletedMessages: number;
  syncedAt: string;
}> {
  const conversations = body.conversations ?? [];
  const messagesByConversation = body.messagesByConversation ?? {};
  const deletedConversationIds = (body.deletedConversationIds ?? []).filter(Boolean);
  const deletedMessageIds = body.deletedMessageIds ?? [];
  const now = nowIso();

  let deletedConversations = 0;
  for (const convId of deletedConversationIds) {
    await env.DB.prepare(
      `DELETE FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
    )
      .bind(userId, convId)
      .run();
    const r = await env.DB.prepare(
      `DELETE FROM user_conversations WHERE user_id = ? AND id = ?`,
    )
      .bind(userId, convId)
      .run();
    if (r.meta.changes > 0) deletedConversations += 1;
  }

  let deletedMessages = 0;
  for (const ref of deletedMessageIds) {
    if (!ref.conversationId || !ref.messageId) continue;
    const r = await env.DB.prepare(
      `DELETE FROM user_chat_messages WHERE user_id = ? AND conversation_id = ? AND id = ?`,
    )
      .bind(userId, ref.conversationId, ref.messageId)
      .run();
    deletedMessages += r.meta.changes;
  }

  for (const c of conversations) {
    await upsertConversation(env, userId, c, now);
  }

  let messageCount = 0;
  for (const [conversationId, msgs] of Object.entries(messagesByConversation)) {
    if (!conversationId || !Array.isArray(msgs)) continue;
    messageCount += await replaceConversationMessages(
      env,
      userId,
      conversationId,
      msgs,
      now,
    );
  }

  return {
    conversationCount: conversations.length,
    messageCount,
    deletedConversations,
    deletedMessages,
    syncedAt: now,
  };
}

/** Hermes 深度任务完成时写入聊天表（不依赖浏览器 PUT） */
export async function syncCompletedAgentJobToChat(
  env: ChatSyncEnv,
  job: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<void> {
  const conversationId = (job.conversation_id ?? "").trim();
  if (!conversationId) return;

  const userId = job.user_id;
  const now = nowIso();
  const messageId = assistantMessageIdForJob(job.id);
  const preview =
    result.answer.replace(/\s+/gu, " ").trim().slice(0, 120) || "深度分析已完成";

  const existingConv = await env.DB.prepare(
    `SELECT id FROM user_conversations WHERE user_id = ? AND id = ?`,
  )
    .bind(userId, conversationId)
    .first<{ id: string }>();

  if (!existingConv) {
    await env.DB.prepare(
      `INSERT INTO user_conversations (id, user_id, project_id, title, preview, updated_at, variant, files_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        conversationId,
        userId,
        job.project_id,
        job.project_id,
        preview,
        now,
        "blank",
        "[]",
      )
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE user_conversations SET preview = ?, updated_at = ? WHERE user_id = ? AND id = ?`,
    )
      .bind(preview, now, userId, conversationId)
      .run();
  }

  const maxRow = await env.DB.prepare(
    `SELECT MAX(sort_index) AS max_idx FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
  )
    .bind(userId, conversationId)
    .first<{ max_idx: number | null }>();
  const sortIndex = (maxRow?.max_idx ?? -1) + 1;

  await upsertChatMessage(
    env,
    userId,
    conversationId,
    {
      id: messageId,
      role: "assistant",
      content: result.answer,
      time: now,
      sortIndex,
      knowledgeNetworkHtml: result.knowledgeNetworkHtml,
      pendingJobId: null,
    },
    now,
  );
}

export type ActiveAgentJobSummary = {
  jobId: string;
  conversationId: string | null;
  projectId: string;
  status: string;
  assistantMessageId: string;
};

export async function listActiveAgentJobsForUser(
  env: ChatSyncEnv,
  userId: string,
): Promise<ActiveAgentJobSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, project_id, conversation_id, status
     FROM agent_jobs
     WHERE user_id = ? AND status IN ('pending', 'running')
     ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all<{
      id: string;
      project_id: string;
      conversation_id: string | null;
      status: string;
    }>();

  return (results ?? []).map((r) => ({
    jobId: r.id,
    projectId: r.project_id,
    conversationId: r.conversation_id,
    status: r.status,
    assistantMessageId: assistantMessageIdForJob(r.id),
  }));
}

export async function handleGetActiveAgentJobs(
  env: ChatSyncEnv,
  userId: string,
): Promise<Response> {
  const jobs = await listActiveAgentJobsForUser(env, userId);
  return json({ ok: true, userId, jobs });
}

export async function handleGetChatState(
  env: ChatSyncEnv,
  userId: string,
): Promise<Response> {
  const { results: convRows } = await env.DB.prepare(
    `SELECT id, project_id, title, preview, updated_at, variant, files_json
     FROM user_conversations WHERE user_id = ? ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<{
      id: string;
      project_id: string;
      title: string;
      preview: string;
      updated_at: string;
      variant: string | null;
      files_json: string;
    }>();

  const conversations = (convRows ?? []).map((r) => {
    let files: string[] = [];
    try {
      files = JSON.parse(r.files_json) as string[];
      if (!Array.isArray(files)) files = [];
    } catch {
      files = [];
    }
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      preview: r.preview,
      updatedAt: r.updated_at,
      files,
      variant: (r.variant === "blank" ? "blank" : r.variant === "demo" ? "demo" : undefined) as
        | "demo"
        | "blank"
        | undefined,
    };
  });

  const { results: msgRows } = await env.DB.prepare(
    `SELECT id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html, pending_job_id
     FROM user_chat_messages WHERE user_id = ? ORDER BY conversation_id, sort_index`,
  )
    .bind(userId)
    .all<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      files_json: string | null;
      time_label: string;
      sort_index: number;
      knowledge_network_html: string | null;
      pending_job_id: string | null;
    }>();

  const messagesByConversation: Record<string, SyncChatMessage[]> = {};
  for (const r of msgRows ?? []) {
    const list = messagesByConversation[r.conversation_id] ?? [];
    let files: { name: string }[] | undefined;
    if (r.files_json) {
      try {
        const parsed = JSON.parse(r.files_json) as { name: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) files = parsed;
      } catch {
        /* ignore */
      }
    }
    const pendingJobId =
      typeof r.pending_job_id === "string" && r.pending_job_id.trim()
        ? r.pending_job_id.trim()
        : undefined;
    list.push({
      id: r.id,
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
      files,
      time: r.time_label,
      sortIndex: r.sort_index,
      knowledgeNetworkHtml: r.knowledge_network_html,
      ...(pendingJobId ? { pendingJobId } : {}),
    });
    messagesByConversation[r.conversation_id] = list;
  }

  return json({
    ok: true,
    userId,
    conversations,
    messagesByConversation,
    syncedAt: nowIso(),
  });
}

export async function handlePutChatState(
  env: ChatSyncEnv,
  userId: string,
  body: ChatStatePatchBody,
): Promise<Response> {
  const result = await applyChatStatePatch(env, userId, body);
  return json({
    ok: true,
    userId,
    mode: "incremental",
    ...result,
  });
}
