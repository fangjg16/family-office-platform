import {
  loadPersistedConversations,
  loadPersistedLiveMessages,
} from "@/workspace/chat-persistence";
import {
  getMergedProjects,
  getProjectById,
  sortProjectsForOverview,
} from "@/workspace/project-registry";
import { loadLastChatProjectId } from "@/workspace/session";

function inferProjectIdFromConversationId(conversationId: string): string | null {
  const mainMatch = /^(.+)-main$/u.exec(conversationId);
  if (mainMatch?.[1] && getProjectById(mainMatch[1])) return mainMatch[1];
  const blankMatch = /^(.+)-blank-/u.exec(conversationId);
  if (blankMatch?.[1] && getProjectById(blankMatch[1])) return blankMatch[1];
  for (const project of getMergedProjects()) {
    if (conversationId === project.id || conversationId.startsWith(`${project.id}-`)) {
      return project.id;
    }
  }
  return null;
}

function pathForConversation(projectId: string, conversationId: string): string {
  if (conversationId === `${projectId}-main`) {
    return `/app/chat/${projectId}`;
  }
  return `/app/chat/${projectId}/${conversationId}`;
}

/** 顶部「对话中心」与 /app/chat 重定向：总能进入可对话页面，不再弹回总览 */
export function resolveChatEntryPath(userId: string | null): string {
  const lastChat = loadLastChatProjectId();
  if (lastChat && getProjectById(lastChat)) {
    return `/app/chat/${lastChat}`;
  }

  if (userId) {
    const convs = loadPersistedConversations(userId) ?? [];
    const msgs = loadPersistedLiveMessages(userId) ?? {};

    const recentWithMessages = [...convs]
      .filter((c) => {
        const list = msgs[c.id];
        return Array.isArray(list) && list.length > 0 && Boolean(getProjectById(c.projectId));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (recentWithMessages[0]) {
      const c = recentWithMessages[0];
      return pathForConversation(c.projectId, c.id);
    }

    let bestProjectId: string | null = null;
    let bestCount = 0;
    for (const [conversationId, list] of Object.entries(msgs)) {
      if (!Array.isArray(list) || list.length === 0) continue;
      const projectId = inferProjectIdFromConversationId(conversationId);
      if (!projectId || !getProjectById(projectId)) continue;
      if (list.length > bestCount) {
        bestCount = list.length;
        bestProjectId = projectId;
      }
    }
    if (bestProjectId) {
      return `/app/chat/${bestProjectId}`;
    }
  }

  const sorted = sortProjectsForOverview(getMergedProjects());
  const first = sorted[0];
  if (first) {
    return `/app/chat/${first.id}`;
  }
  return "/app/projects";
}
