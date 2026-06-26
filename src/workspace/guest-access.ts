/** 限定访客：仅可见指定项目；知识网络预览按项目预置开放 */
export const PEPTIDE_GUEST_USER_ID = "peptide";
export const AISHORT_GUEST_USER_ID = "aishort";

type ScopedGuestConfig = {
  projectIds: readonly string[];
  knPreviewProjectIds: readonly string[];
};

const SCOPED_GUEST: Record<string, ScopedGuestConfig> = {
  [PEPTIDE_GUEST_USER_ID]: {
    projectIds: ["proj-535a240acf88"],
    knPreviewProjectIds: ["proj-535a240acf88"],
  },
  [AISHORT_GUEST_USER_ID]: {
    projectIds: ["proj-4a974e67c0f9"],
    knPreviewProjectIds: ["proj-4a974e67c0f9"],
  },
};

export const SCOPED_GUEST_PASSWORDS: Record<string, string> = {
  [PEPTIDE_GUEST_USER_ID]: "peptide2026",
  [AISHORT_GUEST_USER_ID]: "aidj2026",
};

export type GuestKnApplyState = "none" | "pending";

function applyStorageKey(userId: string, projectId: string): string {
  return `fo-guest-kn-apply:${userId.trim()}:${projectId.trim()}`;
}

export function isScopedGuestUser(userId: string): boolean {
  return userId.trim() in SCOPED_GUEST;
}

export function filterProjectsForUser<T extends { id: string }>(
  userId: string,
  projects: T[],
): T[] {
  const cfg = SCOPED_GUEST[userId.trim()];
  if (!cfg) return projects;
  const allowed = new Set(cfg.projectIds);
  return projects.filter((p) => allowed.has(p.id));
}

export function canGuestPreviewKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  const cfg = SCOPED_GUEST[userId.trim()];
  if (cfg) {
    return cfg.knPreviewProjectIds.includes(projectId);
  }
  return false;
}

/** Guest 获批预览后仅可预览/新标签打开，不可下载 HTML */
export function canGuestDownloadKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  if (!canGuestPreviewKnowledgeNetwork(userId, projectId)) return false;
  return false;
}

export function shouldShowGuestKnApply(userId: string, projectId: string): boolean {
  if (isScopedGuestUser(userId)) return false;
  return getGuestKnApplyState(userId, projectId) === "none";
}

export function getGuestKnApplyState(
  userId: string,
  projectId: string,
): GuestKnApplyState {
  try {
    const raw = localStorage.getItem(applyStorageKey(userId, projectId));
    if (raw === "pending") return "pending";
  } catch {
    /* ignore */
  }
  return "none";
}

export function submitGuestKnApply(userId: string, projectId: string): void {
  try {
    localStorage.setItem(applyStorageKey(userId, projectId), "pending");
  } catch {
    /* ignore */
  }
}
