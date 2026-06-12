import type { ProjectJson } from "./projects-db";

/** 平台管理员可代管任意云端项目 */
const PLATFORM_ADMIN_USER_IDS = new Set(["candice-guo"]);

export function isPlatformAdmin(userId: string | null | undefined): boolean {
  const id = (userId ?? "").trim();
  return id.length > 0 && PLATFORM_ADMIN_USER_IDS.has(id);
}

export function canManageProjectRecord(
  project: ProjectJson,
  userId: string | null,
): boolean {
  if (!userId) return false;
  if (isPlatformAdmin(userId)) return true;
  if (!project.createdBy) return false;
  return project.createdBy === userId;
}
