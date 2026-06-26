import type { WorkspaceRole } from "./workspace-roles";

/** 与前端 workspace-users.ts 对齐的演示账号 */
export const DEFAULT_ROLE_BY_USER: Record<string, WorkspaceRole> = {
  "candice-guo": "admin",
  "jimmy-huang": "core",
  "jessica-hu": "mid",
  "jensen-fang": "low",
  "binghe-su": "low",
  "janice-hi": "guest",
  peptide: "guest",
  aishort: "guest",
};

export const KNOWN_WORKSPACE_USER_IDS = Object.keys(DEFAULT_ROLE_BY_USER);

export function isKnownWorkspaceUser(userId: string): boolean {
  return KNOWN_WORKSPACE_USER_IDS.includes(userId.trim());
}
