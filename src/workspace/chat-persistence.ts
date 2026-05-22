import type { LiveChatMessage } from "@/workspace/chat-types";

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
