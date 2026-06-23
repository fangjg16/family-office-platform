import {
  productizeKnJobSubmitContent,
} from "@/lib/agent-job-display";
import type { LiveChatMessage } from "@/workspace/chat-types";
import type { PersistedConversation } from "@/workspace/chat-persistence";
import { AI_CHAT_ENDPOINT, apiBaseFromChatEndpoint } from "@/lib/project-api";

const JOB_SUBMITTED_LABEL = "任务已提交，正在准备…";
const JOB_RESUMED_LABEL = "生成进行中，刷新后将继续等待…";

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

export function userMessageIdForJob(jobId: string): string {
  return `user-job-${jobId}`;
}

export function assistantMessageIdForJob(jobId: string): string {
  return `assistant-job-${jobId}`;
}

/** 异步任务返回后，将 ephemeral id 对齐为服务端 job id 体系 */
export function mergeAsyncAgentJobIntoConversation(
  messages: LiveChatMessage[],
  opts: {
    jobId: string;
    ephemeralUserMessageId?: string;
    ephemeralAssistantMessageId?: string;
    assistantContent: string;
    timeLabel?: string;
  },
): LiveChatMessage[] {
  const userJobId = userMessageIdForJob(opts.jobId);
  const assistantJobId = assistantMessageIdForJob(opts.jobId);
  const time = opts.timeLabel ?? new Date().toLocaleString("zh-CN");

  let next = messages.map((m) => {
    if (opts.ephemeralUserMessageId && m.id === opts.ephemeralUserMessageId) {
      return { ...m, id: userJobId };
    }
    if (opts.ephemeralAssistantMessageId && m.id === opts.ephemeralAssistantMessageId) {
      return {
        ...m,
        id: assistantJobId,
        role: "assistant" as const,
        content: productizeKnJobSubmitContent(opts.assistantContent),
        pendingJobId: opts.jobId,
        jobProgressLabel: m.jobProgressLabel ?? JOB_SUBMITTED_LABEL,
        isStreaming: false,
        streamStatusLabel: undefined,
      };
    }
    return m;
  });

  if (!next.some((m) => m.id === assistantJobId)) {
    next = [
      ...next,
      {
        id: assistantJobId,
        role: "assistant" as const,
        content: productizeKnJobSubmitContent(opts.assistantContent),
        time,
        pendingJobId: opts.jobId,
        jobProgressLabel: JOB_SUBMITTED_LABEL,
      },
    ];
  }

  return next;
}

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

export async function cancelAgentJobRemote(
  userId: string,
  jobId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<{ ok: boolean; error?: string; status?: string }> {
  if (!chatEndpoint) return { ok: false, error: "未配置 AI 接口" };
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const res = await fetch(
    `${base}/api/agent-jobs/${encodeURIComponent(jobId)}/cancel?userId=${encodeURIComponent(userId)}`,
    { method: "POST" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    status?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return { ok: true, status: data.status };
}

/** 刷新后恢复深度任务轮询；若 D1 缺 placeholder 则从 active job 补建 */
export async function attachActiveAgentJobsToMessages(
  userId: string,
  messagesByConversation: Record<string, LiveChatMessage[]>,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<Record<string, LiveChatMessage[]>> {
  const jobs = await fetchActiveAgentJobs(userId, chatEndpoint);
  const activeJobIds = new Set(jobs.map((j) => j.jobId));

  const out: Record<string, LiveChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(messagesByConversation)) {
    out[convId] = (msgs ?? []).map((m) => {
      if (m.role !== "assistant" || !m.pendingJobId) return { ...m };
      if (!activeJobIds.has(m.pendingJobId)) {
        return { ...m, pendingJobId: undefined, jobProgressLabel: undefined };
      }
      return { ...m };
    });
  }

  if (jobs.length === 0) return out;

  for (const job of jobs) {
    const convId = job.conversationId;
    if (!convId) continue;

    const list = [...(out[convId] ?? [])];
    let idx = list.findIndex(
      (m) => m.id === job.assistantMessageId || m.pendingJobId === job.jobId,
    );

    if (idx < 0) {
      const maxSort = list.reduce(
        (n, m) => Math.max(n, typeof m.sortIndex === "number" ? m.sortIndex : -1),
        -1,
      );
      list.push({
        id: job.assistantMessageId,
        role: "assistant",
        content: "正在生成，请稍候…",
        time: new Date().toLocaleString("zh-CN"),
        sortIndex: maxSort + 1,
        pendingJobId: job.jobId,
        jobProgressLabel: JOB_RESUMED_LABEL,
      });
      out[convId] = list;
      continue;
    }

    list[idx] = {
      ...list[idx],
      id: job.assistantMessageId,
      pendingJobId: job.jobId,
      jobProgressLabel:
        list[idx].jobProgressLabel?.trim() || JOB_RESUMED_LABEL,
      content: list[idx].content?.trim()
        ? productizeKnJobSubmitContent(list[idx].content!)
        : "正在生成，请稍候…",
    };
    out[convId] = list;
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
