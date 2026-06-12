import type { WorkspaceRole } from "./types";

/** 由 API 拉取后写入：当前登录用户在各项目上的有效角色 */
let myRolesByProject: Record<string, WorkspaceRole> = {};

export function setMyProjectRoles(map: Record<string, WorkspaceRole>): void {
  myRolesByProject = { ...map };
}

export function patchMyProjectRole(projectId: string, role: WorkspaceRole): void {
  myRolesByProject = { ...myRolesByProject, [projectId]: role };
}

export function clearMyProjectRoles(): void {
  myRolesByProject = {};
}

export function readCachedProjectRole(projectId: string): WorkspaceRole | null {
  return myRolesByProject[projectId] ?? null;
}
