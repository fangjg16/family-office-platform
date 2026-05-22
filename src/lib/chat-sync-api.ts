import type { LiveChatMessage } from "@/workspace/chat-types";
import type { PersistedConversation } from "@/workspace/chat-persistence";
import { AI_CHAT_ENDPOINT, apiBaseFromChatEndpoint } from "@/lib/project-api";

export type RemoteChatState = {
  conversations: PersistedConversation[];
  messagesByConversation: Record<string, LiveChatMessage[]>;
  syncedAt?: string;
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
  state: RemoteChatState,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<boolean> {
  if (!chatEndpoint) return false;
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}/chat-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversations: state.conversations,
      messagesByConversation: state.messagesByConversation,
    }),
  });
  return res.ok;
}
