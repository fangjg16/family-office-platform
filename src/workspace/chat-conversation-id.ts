import type { LiveChatMessage } from "@/workspace/chat-types";

/** 从会话 id 推断项目 id（不依赖项目是否已载入内存） */
export function inferProjectIdFromConversationId(
  conversationId: string,
): string | null {
  const mainMatch = /^(.+)-main$/u.exec(conversationId);
  if (mainMatch?.[1]) return mainMatch[1];
  const blankMatch = /^(.+)-blank-/u.exec(conversationId);
  if (blankMatch?.[1]) return blankMatch[1];
  return null;
}

function conversationBelongsToProject(conversationId: string, projectId: string): boolean {
  return (
    conversationId === projectId ||
    conversationId === `${projectId}-main` ||
    conversationId.startsWith(`${projectId}-`)
  );
}

/**
 * URL 未带 conversationId 时，选中该项目下「有消息」的会话（避免刷新后落到空的 -main）
 */
export function pickConversationIdForProject(
  projectId: string,
  conversationIdFromUrl: string | undefined,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): string {
  const mainId = `${projectId}-main`;
  const urlId = conversationIdFromUrl?.trim();
  if (urlId) {
    const urlMsgs = messagesByConversation[urlId];
    if (Array.isArray(urlMsgs) && urlMsgs.length > 0) return urlId;
  }

  let bestId = mainId;
  let bestCount = messagesByConversation[mainId]?.length ?? 0;
  let bestLast = lastMessageSortKey(messagesByConversation[mainId]);

  for (const [convId, msgs] of Object.entries(messagesByConversation)) {
    if (!conversationBelongsToProject(convId, projectId)) continue;
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    const count = msgs.length;
    const last = lastMessageSortKey(msgs);
    if (count > bestCount || (count === bestCount && last > bestLast)) {
      bestCount = count;
      bestLast = last;
      bestId = convId;
    }
  }

  return bestId;
}

function lastMessageSortKey(msgs: LiveChatMessage[] | undefined): number {
  if (!msgs?.length) return 0;
  const last = msgs[msgs.length - 1];
  const idx = last.sortIndex ?? 0;
  const idTs = /^user-(\d+)$/u.exec(last.id) ?? /^assistant-(\d+)$/u.exec(last.id);
  const ts = idTs ? Number(idTs[1]) : 0;
  return idx * 1e15 + (Number.isFinite(ts) ? ts : 0);
}

export function conversationRoutePath(
  projectId: string,
  conversationId: string,
): string {
  if (conversationId === `${projectId}-main`) {
    return `/app/chat/${projectId}`;
  }
  return `/app/chat/${projectId}/${conversationId}`;
}
