import type { WorkspaceProject } from "./projects";
import { getProjectRole } from "./workspace-users";

/** 写入 D1 的用户自建项目（id 以 proj- 开头） */
export function isPersistedUserProject(project: WorkspaceProject): boolean {
  return project.id.startsWith("proj-");
}

export function formatProjectCreatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function canUserManageProjectMetadata(
  userId: string,
  project: WorkspaceProject,
): boolean {
  if (!isPersistedUserProject(project)) return false;
  if (getProjectRole(userId, project.id) === "admin") return true;
  return Boolean(project.createdBy && project.createdBy === userId);
}
