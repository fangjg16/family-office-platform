import type { LiveChatMessage } from "@/workspace/chat-types";
import type { PersistedConversation } from "@/workspace/chat-persistence";
import { AI_CHAT_ENDPOINT, apiBaseFromChatEndpoint } from "@/lib/project-api";

export type DeletedMessageRef = {
  conversationId: string;
  messageId: string;
};

export type RemoteChatState = {
  conversations: PersistedConversation[];
  messagesByConversation: Record<string, LiveChatMessage[]>;
  syncedAt?: string;
  /** D1 projects 表仍存在的项目 id（侧栏过滤已删项目） */
  projectIds?: string[];
};

export type ChatStatePatch = RemoteChatState & {
  /** 显式删除会话（级联删该会话全部消息） */
  deletedConversationIds?: string[];
  /** 从 user_chat_messages 物理删除（删前写入审计表） */
  deletedMessageIds?: DeletedMessageRef[];
};

export type ActiveAgentJobSummary = {
  jobId: string;
  conversationId: string | null;
  projectId: string;
  status: string;
  assistantMessageId: string;
};

export async function fetchRemoteChatState(
  userId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<RemoteChatState | null> {
  if (!chatEndpoint) return null;
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}/chat-state`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    conversations?: PersistedConversation[];
    messagesByConversation?: Record<string, LiveChatMessage[]>;
    syncedAt?: string;
    projectIds?: string[];
  };
  return {
    conversations: data.conversations ?? [],
    messagesByConversation: data.messagesByConversation ?? {},
    syncedAt: data.syncedAt,
    projectIds: data.projectIds,
  };
}

export async function fetchActiveAgentJobs(
  userId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<ActiveAgentJobSummary[]> {
  if (!chatEndpoint) return [];
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const res = await fetch(
    `${base}/api/users/${encodeURIComponent(userId)}/active-agent-jobs`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { jobs?: ActiveAgentJobSummary[] };
  return data.jobs ?? [];
}

/** 刷新后恢复深度任务轮询：合并 D1 pending_job_id 与仍在运行的 agent_jobs */
export async function attachActiveAgentJobsToMessages(
  userId: string,
  messagesByConversation: Record<string, LiveChatMessage[]>,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<Record<string, LiveChatMessage[]>> {
  const jobs = await fetchActiveAgentJobs(userId, chatEndpoint);
  if (jobs.length === 0) return messagesByConversation;

  const out: Record<string, LiveChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(messagesByConversation)) {
    out[convId] = msgs.map((m) => ({ ...m }));
  }

  for (const job of jobs) {
    const convId = job.conversationId;
    if (!convId) continue;
    const list = out[convId];
    if (!list) continue;

    const idx = list.findIndex((m) => m.id === job.assistantMessageId);
    if (idx < 0) continue;

    list[idx] = {
      ...list[idx],
      pendingJobId: job.jobId,
      jobProgressLabel:
        list[idx].jobProgressLabel?.trim() || "深度分析进行中，刷新后已恢复等待…",
    };
  }

  return out;
}

export async function saveRemoteChatState(
  userId: string,
  patch: ChatStatePatch,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<boolean> {
  if (!chatEndpoint) return false;
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}/chat-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversations: patch.conversations,
      messagesByConversation: sanitizeMessagesForSync(patch.messagesByConversation),
      deletedConversationIds: patch.deletedConversationIds ?? [],
      deletedMessageIds: patch.deletedMessageIds ?? [],
    }),
  });
  return res.ok;
}

/** 持久化到 D1：保留 pendingJobId；jobProgressLabel 仅 UI 用不写入 */
function sanitizeMessagesForSync(
  messagesByConversation: Record<string, LiveChatMessage[]>,
): Record<string, LiveChatMessage[]> {
  const out: Record<string, LiveChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(messagesByConversation)) {
    out[convId] = (msgs ?? []).map(
      ({ jobProgressLabel: _j, isStreaming: _s, streamStatusLabel: _l, ...rest }) => rest,
    );
  }
  return out;
}
