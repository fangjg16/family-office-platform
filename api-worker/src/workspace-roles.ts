/** 与前端 workspace-users.ts 对齐的演示权限（Worker 侧校验） */

import { SEED_PROJECT_IDS } from "./workspace-project-ids";

export type WorkspaceRole = "admin" | "core" | "mid" | "low" | "guest";

export const GUEST_USER_ID = "janice-hi";

function fillRoles(role: WorkspaceRole): Record<string, WorkspaceRole> {
  return Object.fromEntries(SEED_PROJECT_IDS.map((id) => [id, role]));
}

/** 与前端 PROJECT_ROLES 一致 */
const PROJECT_ROLES: Record<string, Record<string, WorkspaceRole>> = {
  "candice-guo": fillRoles("admin"),
  "jimmy-huang": {
    ...fillRoles("core"),
    shrimp: "core",
    "natgeo-rwa": "core",
    "offshore-trust": "core",
    "ip-invest": "mid",
  },
  "jessica-hu": {
    ...fillRoles("mid"),
    "digital-portal": "core",
    "ip-invest": "core",
    "edu-ma": "core",
    "cross-trade": "low",
  },
  "jensen-fang": {
    ...fillRoles("low"),
    shrimp: "core",
    "hk-us-equity": "mid",
    "energy-ma": "mid",
    "med-channel": "mid",
  },
  "janice-hi": fillRoles("guest"),
};

export function getProjectRole(userId: string, projectId: string): WorkspaceRole {
  const uid = userId.trim();
  if (!uid) return "guest";
  const map = PROJECT_ROLES[uid];
  if (!map) return "guest";
  if (map[projectId]) return map[projectId];
  if (uid === GUEST_USER_ID) return "guest";
  return "core";
}

export function canViewProjectKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  return getProjectRole(userId, projectId) !== "guest";
}

/** 上传/覆盖项目知识网络 HTML（访客与 low 只读） */
export function canPublishProjectKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  const role = getProjectRole(userId, projectId);
  return role === "admin" || role === "core" || role === "mid";
}
