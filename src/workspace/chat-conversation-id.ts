import type { LiveChatMessage } from "@/workspace/chat-types";

/** 从会话 id 推断项目 id（不依赖项目是否已载入内存） */
export function inferProjectIdFromConversationId(
  conversationId: string,
): string | null {
  const trimmed = conversationId.trim();
  if (!trimmed) return null;
  const mainMatch = /^(.+)-main$/u.exec(trimmed);
  if (mainMatch?.[1]) return mainMatch[1];
  const blankMatch = /^(.+)-blank-/u.exec(trimmed);
  if (blankMatch?.[1]) return blankMatch[1];
  if (/^proj-[a-f0-9]+$/u.test(trimmed)) return trimmed;
  const projPrefix = /^(proj-[a-f0-9]+)-/u.exec(trimmed);
  if (projPrefix?.[1]) return projPrefix[1];
  return null;
}

export function conversationBelongsToProject(
  conversationId: string,
  projectId: string,
): boolean {
  return (
    conversationId === projectId ||
    conversationId === `${projectId}-main` ||
    conversationId.startsWith(`${projectId}-`)
  );
}

/** URL 是否带 conversationId 段（`/chat/:projectId/:conversationId`） */
export function hasConversationIdInUrl(
  conversationIdFromUrl: string | undefined,
): boolean {
  return Boolean(conversationIdFromUrl?.trim());
}

/** 用户点击「新增对话」生成的空白线程 id */
export function isBlankConversationId(projectId: string, conversationId: string): boolean {
  return conversationId.startsWith(`${projectId}-blank-`);
}

/**
 * 解析当前应展示的会话 id：
 * - URL 已带 conversationId 且属于该项目 → 原样使用（含 `-main` 与 blank 线程）
 * - 仅 `/chat/:projectId` 裸路由 → 选该项目下有消息的会话
 */
export function resolveConversationIdFromUrl(
  projectId: string,
  conversationIdFromUrl: string | undefined,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): string {
  const urlId = conversationIdFromUrl?.trim();
  if (urlId && conversationBelongsToProject(urlId, projectId)) {
    return urlId;
  }
  return pickConversationIdForProject(projectId, messagesByConversation);
}

/** 裸项目路由：选该项目下消息最多（同量取最近）的会话 */
export function pickConversationIdForProject(
  projectId: string,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): string {
  const mainId = `${projectId}-main`;
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

/** 始终带 conversationId，避免 `-main` 裸路由被自动抢跳到其它线程 */
export function conversationRoutePath(
  projectId: string,
  conversationId: string,
): string {
  return `/app/chat/${projectId}/${conversationId}`;
}
