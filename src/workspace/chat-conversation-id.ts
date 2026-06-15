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

/** URL 是否为「裸项目 / -main」别名（非显式子线程） */
export function isMainConversationAlias(
  projectId: string,
  conversationIdFromUrl: string | undefined,
): boolean {
  const urlId = conversationIdFromUrl?.trim();
  if (!urlId) return true;
  return urlId === projectId || urlId === `${projectId}-main`;
}

/** `/chat/:projectId/:conversationId` 且 conversationId 不是 -main 别名 */
export function isExplicitSubThreadRoute(
  projectId: string,
  conversationIdFromUrl: string | undefined,
): boolean {
  const urlId = conversationIdFromUrl?.trim();
  if (!urlId || !projectId) return false;
  return !isMainConversationAlias(projectId, urlId);
}

/** 用户点击「新增对话」生成的空白线程 id */
export function isBlankConversationId(projectId: string, conversationId: string): boolean {
  return conversationId.startsWith(`${projectId}-blank-`);
}

/**
 * URL 未带 conversationId，或落在空的 `-main` 时，自动选该项目下有消息的会话。
 * 用户显式打开的子线程（`/chat/:projectId/:conversationId`）一律尊重，不因本地暂无消息而抢跳。
 */
export function pickConversationIdForProject(
  projectId: string,
  conversationIdFromUrl: string | undefined,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): string {
  const mainId = `${projectId}-main`;
  const urlId = conversationIdFromUrl?.trim();

  if (urlId && conversationBelongsToProject(urlId, projectId)) {
    const isMainAlias = urlId === projectId || urlId === mainId;
    if (!isMainAlias) {
      return urlId;
    }
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
