import type { ProjectJson } from "./projects-db";

/** 平台管理员可代管任意云端项目 */
const PLATFORM_ADMIN_USER_IDS = new Set(["candice-guo"]);

export function canManageProjectRecord(
  project: ProjectJson,
  userId: string | null,
): boolean {
  if (!userId) return false;
  if (PLATFORM_ADMIN_USER_IDS.has(userId)) return true;
  if (!project.createdBy) return false;
  return project.createdBy === userId;
}
