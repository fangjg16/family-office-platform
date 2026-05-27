import {
  loadPersistedConversations,
  loadPersistedLiveMessages,
} from "@/workspace/chat-persistence";
import { ALL_PROJECTS } from "@/workspace/projects";
import {
  getMergedProjects,
  getProjectById,
  sortProjectsForOverview,
} from "@/workspace/project-registry";
import { loadLastChatProjectId } from "@/workspace/session";

const FALLBACK_SEED_PROJECT_ID = "nn-fresh-port";

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
  for (const seed of ALL_PROJECTS) {
    if (conversationId === seed.id || conversationId.startsWith(`${seed.id}-`)) {
      return seed.id;
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

function pickSeedFallbackProjectId(): string {
  const sorted = sortProjectsForOverview(getMergedProjects());
  const seed = sorted.find((p) => ALL_PROJECTS.some((s) => s.id === p.id));
  return seed?.id ?? ALL_PROJECTS[0]?.id ?? FALLBACK_SEED_PROJECT_ID;
}

/** 顶部「对话中心」与 /app/chat 重定向：始终进入具体项目对话页 */
export function resolveChatEntryPath(userId: string | null): string {
  const lastChat = loadLastChatProjectId();
  if (lastChat) {
    if (getProjectById(lastChat)) {
      return `/app/chat/${lastChat}`;
    }
    if (lastChat.startsWith("proj-")) {
      return `/app/chat/${lastChat}`;
    }
  }

  if (userId) {
    const convs = loadPersistedConversations(userId) ?? [];
    const msgs = loadPersistedLiveMessages(userId) ?? {};

    const recentWithMessages = [...convs]
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
      return `/app/chat/${bestProjectId}`;
    }
  }

  return `/app/chat/${pickSeedFallbackProjectId()}`;
}
