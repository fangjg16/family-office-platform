import type { LiveChatMessage } from "@/workspace/chat-types";
import {
  fetchRemoteChatState,
  saveRemoteChatState,
  type RemoteChatState,
} from "@/lib/chat-sync-api";
import { ENABLE_LIVE_CHAT, AI_CHAT_ENDPOINT } from "@/lib/project-api";

export type PersistedConversation = {
  id: string;
  projectId: string;
  title: string;
  preview: string;
  updatedAt: string;
  files: string[];
  variant?: "demo" | "blank";
};

function conversationsKey(userId: string) {
  return `fo-chat-conversations-${userId}`;
}

function liveMessagesKey(userId: string) {
  return `fo-chat-live-${userId}`;
}

export function loadPersistedConversations(
  userId: string,
): PersistedConversation[] | null {
  try {
    const raw = localStorage.getItem(conversationsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedConversation[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedConversations(
  userId: string,
  conversations: PersistedConversation[],
): void {
  try {
    localStorage.setItem(conversationsKey(userId), JSON.stringify(conversations));
  } catch {
    /* 容量满时忽略 */
  }
}

export function loadPersistedLiveMessages(
  userId: string,
): Record<string, LiveChatMessage[]> | null {
  try {
    const raw = localStorage.getItem(liveMessagesKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, LiveChatMessage[]>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedLiveMessages(
  userId: string,
  messages: Record<string, LiveChatMessage[]>,
): void {
  try {
    localStorage.setItem(liveMessagesKey(userId), JSON.stringify(messages));
  } catch {
    /* 容量满时忽略 */
  }
}

/** 优先云端，失败则用本机缓存 */
export async function loadChatStateForUser(
  userId: string,
): Promise<RemoteChatState | null> {
  if (ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT) {
    const remote = await fetchRemoteChatState(userId);
    if (
      remote &&
      (remote.conversations.length > 0 ||
        Object.keys(remote.messagesByConversation).length > 0)
    ) {
      savePersistedConversations(userId, remote.conversations);
      savePersistedLiveMessages(userId, remote.messagesByConversation);
      return remote;
    }
  }

  const localConvs = loadPersistedConversations(userId);
  const localMsgs = loadPersistedLiveMessages(userId);
  if (localConvs || localMsgs) {
    return {
      conversations: localConvs ?? [],
      messagesByConversation: localMsgs ?? {},
    };
  }
  return null;
}

/** 云端 + 本机双写（换电脑同步） */
export async function persistChatStateForUser(
  userId: string,
  state: RemoteChatState,
): Promise<void> {
  savePersistedConversations(userId, state.conversations);
  savePersistedLiveMessages(userId, state.messagesByConversation);
  if (ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT) {
    await saveRemoteChatState(userId, state);
  }
}
