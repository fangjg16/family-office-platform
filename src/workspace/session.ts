import { SESSION_KEY } from "./types";

const LAST_PROJECT_KEY = "fo-last-project-id";
/** 仅在有真实发过消息时更新，供顶部「对话中心」入口使用 */
const LAST_CHAT_PROJECT_KEY = "fo-last-chat-project-id";

type SessionPayload = { userId: string };

export function saveLastProjectId(id: string) {
  sessionStorage.setItem(LAST_PROJECT_KEY, id);
}

export function loadLastProjectId(): string | null {
  return sessionStorage.getItem(LAST_PROJECT_KEY);
}

export function saveLastChatProjectId(id: string) {
  sessionStorage.setItem(LAST_CHAT_PROJECT_KEY, id);
}

export function loadLastChatProjectId(): string | null {
  return sessionStorage.getItem(LAST_CHAT_PROJECT_KEY);
}

export function clearLastChatProjectId() {
  sessionStorage.removeItem(LAST_CHAT_PROJECT_KEY);
}

export function saveSessionUser(userId: string) {
  const payload: SessionPayload = { userId };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function loadSessionUserId(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { userId?: string };
    return o.userId ?? null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
