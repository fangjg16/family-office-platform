import type { WorkspaceProject } from "./projects";
import { getProjectRole } from "./workspace-users";

/** 写入 D1 的用户自建项目（id 以 proj- 开头） */
export function isPersistedUserProject(project: WorkspaceProject): boolean {
  return project.id.startsWith("proj-");
}

export function canUserManageProjectMetadata(
  userId: string,
  project: WorkspaceProject,
): boolean {
  if (!isPersistedUserProject(project)) return false;
  if (getProjectRole(userId, project.id) === "admin") return true;
  return Boolean(project.createdBy && project.createdBy === userId);
}
