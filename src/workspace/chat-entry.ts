import { loadChatStateForUser } from "@/workspace/chat-persistence";
import {
  conversationRoutePath,
  inferProjectIdFromConversationId,
  pickConversationIdForProject,
} from "@/workspace/chat-conversation-id";
import {
  getMergedProjects,
  getProjectById,
  sortProjectsForOverview,
} from "@/workspace/project-registry";
import { loadLastChatProjectId } from "@/workspace/session";

function pathForConversation(projectId: string, conversationId: string): string {
  return conversationRoutePath(projectId, conversationId);
}

function pickFirstProjectChatPath(): string | null {
  const sorted = sortProjectsForOverview(getMergedProjects());
  const first = sorted[0];
  return first ? conversationRoutePath(first.id, `${first.id}-main`) : null;
}

function resolveFromLastChatOrSeed(): string {
  const lastChat = loadLastChatProjectId();
  if (lastChat) {
    if (getProjectById(lastChat)) {
      return conversationRoutePath(lastChat, `${lastChat}-main`);
    }
    if (lastChat.startsWith("proj-")) {
      return conversationRoutePath(lastChat, `${lastChat}-main`);
    }
  }
  return pickFirstProjectChatPath() ?? "/app/projects";
}

function resolveFromChatState(
  convs: Awaited<ReturnType<typeof loadChatStateForUser>>,
): string | null {
  if (!convs) return null;

  const msgs = convs.messagesByConversation;
  const recentWithMessages = [...convs.conversations]
    .filter((c) => {
      const list = msgs[c.id];
      return Array.isArray(list) && list.length > 0;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (recentWithMessages[0]) {
    const c = recentWithMessages[0];
    if (getProjectById(c.projectId) || c.projectId.startsWith("proj-")) {
      return pathForConversation(c.projectId, c.id);
    }
  }

  let bestProjectId: string | null = null;
  let bestCount = 0;
  for (const [conversationId, list] of Object.entries(msgs)) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const pid = inferProjectIdFromConversationId(conversationId);
    if (!pid) continue;
    if (list.length > bestCount) {
      bestCount = list.length;
      bestProjectId = pid;
    }
  }
  if (bestProjectId) {
    const picked = pickConversationIdForProject(bestProjectId, msgs);
    return conversationRoutePath(bestProjectId, picked);
  }
  return null;
}

/** 同步兜底：上次打开的项目或列表中第一个云端项目 */
export function resolveChatEntryPath(_userId: string | null): string {
  return resolveFromLastChatOrSeed();
}

/** 顶部「对话中心」：优先云端最近会话，否则上次项目或项目总览 */
export async function resolveChatEntryPathAsync(
  userId: string | null,
): Promise<string> {
  if (userId) {
    const state = await loadChatStateForUser(userId);
    const fromCloud = resolveFromChatState(state);
    if (fromCloud) return fromCloud;
  }
  return resolveFromLastChatOrSeed();
}
