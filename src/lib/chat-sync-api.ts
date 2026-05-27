import type { LiveChatMessage } from "@/workspace/chat-types";
import type { PersistedConversation } from "@/workspace/chat-persistence";
import { AI_CHAT_ENDPOINT, apiBaseFromChatEndpoint } from "@/lib/project-api";

export type RemoteChatState = {
  conversations: PersistedConversation[];
  messagesByConversation: Record<string, LiveChatMessage[]>;
  syncedAt?: string;
};

export type DeletedMessageRef = {
  conversationId: string;
  messageId: string;
};

export type ChatStatePatch = RemoteChatState & {
  /** 显式删除会话（级联删该会话全部消息） */
  deletedConversationIds?: string[];
  /** 显式删除单条消息 */
  deletedMessageIds?: DeletedMessageRef[];
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
  };
  return {
    conversations: data.conversations ?? [],
    messagesByConversation: data.messagesByConversation ?? {},
    syncedAt: data.syncedAt,
  };
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

/** 持久化到 D1 时不写入轮询专用字段 */
function sanitizeMessagesForSync(
  messagesByConversation: Record<string, LiveChatMessage[]>,
): Record<string, LiveChatMessage[]> {
  const out: Record<string, LiveChatMessage[]> = {};
  for (const [convId, msgs] of Object.entries(messagesByConversation)) {
    out[convId] = (msgs ?? []).map(({ pendingJobId: _p, jobProgressLabel: _j, ...rest }) => rest);
  }
  return out;
}
