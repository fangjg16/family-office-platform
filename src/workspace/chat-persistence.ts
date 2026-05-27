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

/** 仅从云端 D1 加载；失败或不可用时返回 null */
export async function loadChatStateForUser(
  userId: string,
): Promise<RemoteChatState | null> {
  if (!(ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT)) {
    return null;
  }

  try {
    const remote = await fetchRemoteChatState(userId);
    if (!remote) return null;

    return {
      conversations: remote.conversations,
      messagesByConversation: sortMessagesByConversation(
        remote.messagesByConversation,
      ),
      syncedAt: remote.syncedAt,
    };
  } catch {
    return null;
  }
}

function mergeConversations(
  remote: PersistedConversation[],
  incoming: PersistedConversation[],
): PersistedConversation[] {
  const byId = new Map<string, PersistedConversation>();
  for (const c of remote) byId.set(c.id, c);
  for (const c of incoming) {
    const prev = byId.get(c.id);
    if (!prev || c.updatedAt.localeCompare(prev.updatedAt) >= 0) {
      byId.set(c.id, c);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function mergeMessagesByConversation(
  remote: Record<string, LiveChatMessage[]>,
  incoming: Record<string, LiveChatMessage[]>,
): Record<string, LiveChatMessage[]> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(incoming)]);
  const merged: Record<string, LiveChatMessage[]> = {};
  for (const key of keys) {
    const byId = new Map<string, LiveChatMessage>();
    for (const m of remote[key] ?? []) byId.set(m.id, m);
    for (const m of incoming[key] ?? []) byId.set(m.id, m);
    const list = Array.from(byId.values());
    if (list.length > 0) merged[key] = list;
  }
  return sortMessagesByConversation(merged);
}

/**
 * 保存到云端：先 GET 远端基线再与当前页状态合并后 PUT。
 * 若无法读取远端基线则跳过 PUT，避免全量替换误删其它会话。
 */
export async function persistChatStateForUser(
  userId: string,
  state: RemoteChatState,
): Promise<void> {
  const incoming = {
    conversations: state.conversations,
    messagesByConversation: sortMessagesByConversation(
      state.messagesByConversation,
    ),
  };

  if (!(ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT)) {
    return;
  }

  let remoteBaselineLoaded = false;
  let toSave = incoming;

  try {
    const remote = await fetchRemoteChatState(userId);
    if (remote) {
      remoteBaselineLoaded = true;
      toSave = {
        conversations: mergeConversations(
          remote.conversations,
          incoming.conversations,
        ),
        messagesByConversation: mergeMessagesByConversation(
          remote.messagesByConversation,
          incoming.messagesByConversation,
        ),
      };
    }
  } catch {
    /* 读取失败时不写入云端 */
  }

  if (remoteBaselineLoaded) {
    await saveRemoteChatState(userId, toSave);
  }
}
