/** 与前端 workspace-users.ts 对齐的演示权限（Worker 侧校验） */

export type WorkspaceRole = "admin" | "core" | "mid" | "low" | "guest";

export const GUEST_USER_ID = "janice-hi";

const DEFAULT_ROLE_BY_USER: Record<string, WorkspaceRole> = {
  "candice-guo": "admin",
  "jimmy-huang": "core",
  "jessica-hu": "mid",
  "jensen-fang": "low",
  "janice-hi": "guest",
};

const PROJECT_ROLES: Record<string, Record<string, WorkspaceRole>> = {
  "candice-guo": {},
  "jimmy-huang": {},
  "jessica-hu": {},
  "jensen-fang": {},
  "janice-hi": {},
};

export function getProjectRole(userId: string, projectId: string): WorkspaceRole {
  const uid = userId.trim();
  if (!uid) return "guest";
  const override = PROJECT_ROLES[uid]?.[projectId];
  if (override) return override;
  return DEFAULT_ROLE_BY_USER[uid] ?? "guest";
}

export function canViewProjectKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  return getProjectRole(userId, projectId) !== "guest";
}

/** 上传/覆盖项目知识网络 HTML：admin / core / 项目创建人 */
export function canPublishProjectKnowledgeNetwork(
  userId: string,
  projectId: string,
  createdBy?: string | null,
): boolean {
  const uid = userId.trim();
  if (!uid) return false;
  const role = getProjectRole(uid, projectId);
  if (role === "admin" || role === "core") return true;
  const creator = (createdBy ?? "").trim();
  return Boolean(creator && creator === uid);
}
