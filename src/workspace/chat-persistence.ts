import type { LiveChatMessage } from "@/workspace/chat-types";
import {
  attachActiveAgentJobsToMessages,
  fetchRemoteChatState,
  saveRemoteChatState,
  type ChatStatePatch,
  type DeletedMessageRef,
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

export type ChatPersistOptions = {
  deletedConversationIds?: string[];
  deletedMessageIds?: DeletedMessageRef[];
  /** true：跳过 GET 合并，直接写入（删除操作等） */
  skipMerge?: boolean;
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

    const withJobs = await attachActiveAgentJobsToMessages(
      userId,
      remote.messagesByConversation,
    );

    return {
      conversations: remote.conversations,
      messagesByConversation: sortMessagesByConversation(withJobs),
      syncedAt: remote.syncedAt,
    };
  } catch {
    return null;
  }
}

function mergeConversations(
  remote: PersistedConversation[],
  incoming: PersistedConversation[],
  deletedConversationIds: string[] = [],
): PersistedConversation[] {
  const deleted = new Set(deletedConversationIds);
  const byId = new Map<string, PersistedConversation>();
  for (const c of remote) {
    if (!deleted.has(c.id)) byId.set(c.id, c);
  }
  for (const c of incoming) {
    if (deleted.has(c.id)) {
      byId.delete(c.id);
      continue;
    }
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
  deletedConversationIds: string[] = [],
): Record<string, LiveChatMessage[]> {
  const deleted = new Set(deletedConversationIds);
  const keys = new Set([...Object.keys(remote), ...Object.keys(incoming)]);
  const merged: Record<string, LiveChatMessage[]> = {};
  for (const key of keys) {
    if (deleted.has(key)) continue;
    const byId = new Map<string, LiveChatMessage>();
    for (const m of remote[key] ?? []) byId.set(m.id, m);
    for (const m of incoming[key] ?? []) byId.set(m.id, m);
    const list = Array.from(byId.values());
    if (list.length > 0) merged[key] = list;
  }
  return sortMessagesByConversation(merged);
}

/**
 * 增量保存到云端：upsert 会话、按会话替换消息列表、显式 deleted* 字段处理删除。
 * 默认仍先 GET 合并，避免多标签局部内存覆盖其它会话。
 */
export async function persistChatStateForUser(
  userId: string,
  state: RemoteChatState,
  options: ChatPersistOptions = {},
): Promise<boolean> {
  const incoming = {
    conversations: state.conversations,
    messagesByConversation: sortMessagesByConversation(
      state.messagesByConversation,
    ),
  };

  if (!(ENABLE_LIVE_CHAT && AI_CHAT_ENDPOINT)) {
    return false;
  }

  let patch: ChatStatePatch = {
    ...incoming,
    deletedConversationIds: options.deletedConversationIds ?? [],
    deletedMessageIds: options.deletedMessageIds ?? [],
  };

  const deletedConversationIds = options.deletedConversationIds ?? [];

  if (!options.skipMerge) {
    try {
      const remote = await fetchRemoteChatState(userId);
      if (remote) {
        patch = {
          conversations: mergeConversations(
            remote.conversations,
            incoming.conversations,
            deletedConversationIds,
          ),
          messagesByConversation: mergeMessagesByConversation(
            remote.messagesByConversation,
            incoming.messagesByConversation,
            deletedConversationIds,
          ),
          deletedConversationIds,
          deletedMessageIds: options.deletedMessageIds ?? [],
        };
      } else {
        return false;
      }
    } catch {
      return false;
    }
  } else if (deletedConversationIds.length > 0) {
    patch = {
      ...incoming,
      conversations: incoming.conversations.filter(
        (c) => !deletedConversationIds.includes(c.id),
      ),
      messagesByConversation: Object.fromEntries(
        Object.entries(incoming.messagesByConversation).filter(
          ([id]) => !deletedConversationIds.includes(id),
        ),
      ),
      deletedConversationIds,
      deletedMessageIds: options.deletedMessageIds ?? [],
    };
  }

  return saveRemoteChatState(userId, patch);
}
