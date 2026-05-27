import type { LiveChatMessage } from "@/workspace/chat-types";
import {
  fetchRemoteChatState,
  saveRemoteChatState,
  type RemoteChatState,
} from "@/lib/chat-sync-api";
import { ENABLE_LIVE_CHAT, AI_CHAT_ENDPOINT } from "@/lib/project-api";
import { sortMessagesByConversation } from "@/workspace/chat-message-order";

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
      return {
        ...remote,
        messagesByConversation: sortMessagesByConversation(remote.messagesByConversation),
      };
    }
  }

  const localConvs = loadPersistedConversations(userId);
  const localMsgs = loadPersistedLiveMessages(userId);
  if (localConvs || localMsgs) {
    return {
      conversations: localConvs ?? [],
      messagesByConversation: sortMessagesByConversation(localMsgs ?? {}),
    };
  }
  return null;
}

function mergeConversations(
  remote: PersistedConversation[],
  local: PersistedConversation[],
): PersistedConversation[] {
  const byId = new Map<string, PersistedConversation>();
  for (const c of remote) byId.set(c.id, c);
  for (const c of local) {
    const prev = byId.get(c.id);
    if (!prev || c.updatedAt.localeCompare(prev.updatedAt) >= 0) {
      byId.set(c.id, c);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mergeMessagesByConversation(
  remote: Record<string, LiveChatMessage[]>,
  local: Record<string, LiveChatMessage[]>,
): Record<string, LiveChatMessage[]> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const merged: Record<string, LiveChatMessage[]> = {};
  for (const key of keys) {
    const byId = new Map<string, LiveChatMessage>();
    for (const m of remote[key] ?? []) byId.set(m.id, m);
    for (const m of local[key] ?? []) byId.set(m.id, m);
    const list = Array.from(byId.values());
    if (list.length > 0) merged[key] = list;
  }
  return sortMessagesByConversation(merged);
}

/** 云端 + 本机双写；保存前与远端合并，避免局部状态覆盖删光历史 */
export async function persistChatStateForUser(
  userId: string,
  state: RemoteChatState,
): Promise<void> {
  const localSorted = {
    conversations: state.conversations,
    messagesByConversation: sortMessagesByConversation(state.messagesByConversation),
  };

  let toSave = localSorted;
  if (ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT) {
    const remote = await fetchRemoteChatState(userId);
    if (remote) {
      toSave = {
        conversations: mergeConversations(remote.conversations, localSorted.conversations),
        messagesByConversation: mergeMessagesByConversation(
          remote.messagesByConversation,
          localSorted.messagesByConversation,
        ),
      };
    }
  }

  savePersistedConversations(userId, toSave.conversations);
  savePersistedLiveMessages(userId, toSave.messagesByConversation);
  if (ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT) {
    await saveRemoteChatState(userId, toSave);
  }
}
