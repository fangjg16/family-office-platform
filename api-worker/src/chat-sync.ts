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
};

type ChatStateBody = {
  conversations?: SyncConversation[];
  messagesByConversation?: Record<string, SyncChatMessage[]>;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
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
    `SELECT id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html
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
    list.push({
      id: r.id,
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
      files,
      time: r.time_label,
      sortIndex: r.sort_index,
      knowledgeNetworkHtml: r.knowledge_network_html,
    });
    messagesByConversation[r.conversation_id] = list;
  }

  return json({
    ok: true,
    userId,
    conversations,
    messagesByConversation,
    syncedAt: new Date().toISOString(),
  });
}

export async function handlePutChatState(
  env: ChatSyncEnv,
  userId: string,
  body: ChatStateBody,
): Promise<Response> {
  const conversations = body.conversations ?? [];
  const messagesByConversation = body.messagesByConversation ?? {};
  const now = new Date().toISOString();

  await env.DB.prepare(`DELETE FROM user_chat_messages WHERE user_id = ?`)
    .bind(userId)
    .run();
  await env.DB.prepare(`DELETE FROM user_conversations WHERE user_id = ?`)
    .bind(userId)
    .run();

  for (const c of conversations) {
    if (!c.id || !c.projectId) continue;
    await env.DB.prepare(
      `INSERT INTO user_conversations (id, user_id, project_id, title, preview, updated_at, variant, files_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

  for (const [conversationId, msgs] of Object.entries(messagesByConversation)) {
    let idx = 0;
    for (const m of msgs) {
      if (!m.id) continue;
      const sortIndex =
        typeof m.sortIndex === "number" && Number.isFinite(m.sortIndex)
          ? m.sortIndex
          : idx;
      const knHtml =
        typeof m.knowledgeNetworkHtml === "string" ? m.knowledgeNetworkHtml : null;
      await env.DB.prepare(
        `INSERT INTO user_chat_messages (id, user_id, conversation_id, role, content, files_json, time_label, sort_index, knowledge_network_html, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          m.id,
          userId,
          conversationId,
          m.role,
          m.content ?? "",
          m.files?.length ? JSON.stringify(m.files) : null,
          m.time ?? now,
          sortIndex,
          knHtml,
          now,
        )
        .run();
      idx = Math.max(idx, sortIndex + 1);
    }
  }

  return json({
    ok: true,
    userId,
    conversationCount: conversations.length,
    messageCount: Object.values(messagesByConversation).reduce(
      (n, arr) => n + arr.length,
      0,
    ),
    syncedAt: now,
  });
}
