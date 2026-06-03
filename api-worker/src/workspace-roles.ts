/** 与前端 workspace-users.ts 对齐的演示权限（Worker 侧校验） */

export type WorkspaceRole = "admin" | "core" | "mid" | "low" | "guest";

export const GUEST_USER_ID = "janice-hi";

/** 演示账号默认档位（无项目级覆盖时） */
const USER_DEFAULT_ROLE: Record<string, WorkspaceRole> = {
  "candice-guo": "admin",
  "jimmy-huang": "core",
  "jessica-hu": "mid",
  "jensen-fang": "low",
  "janice-hi": "guest",
};

/** 与前端 PROJECT_ROLES 一致的项目级覆盖（仅列出的项目） */
const PROJECT_ROLE_OVERRIDES: Record<string, Record<string, WorkspaceRole>> = {
  "jimmy-huang": {
    shrimp: "core",
    "natgeo-rwa": "core",
    "offshore-trust": "core",
    "ip-invest": "mid",
  },
  "jessica-hu": {
    "digital-portal": "core",
    "ip-invest": "core",
    "edu-ma": "core",
    "cross-trade": "low",
  },
  "jensen-fang": {
    shrimp: "core",
    "hk-us-equity": "mid",
    "energy-ma": "mid",
    "med-channel": "mid",
  },
};

export function getProjectRole(userId: string, projectId: string): WorkspaceRole {
  const uid = userId.trim();
  if (!uid) return "guest";
  if (uid === GUEST_USER_ID) return "guest";
  const overrides = PROJECT_ROLE_OVERRIDES[uid];
  if (overrides?.[projectId]) return overrides[projectId];
  return USER_DEFAULT_ROLE[uid] ?? "guest";
}

export function canViewProjectKnowledgeNetwork(
  userId: string,
  projectId: string,
): boolean {
  return getProjectRole(userId, projectId) !== "guest";
}
