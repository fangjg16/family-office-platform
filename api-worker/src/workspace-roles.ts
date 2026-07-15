/** 与前端 workspace-users.ts 对齐的演示权限（Worker 侧校验） */

import { getProjectMemberRoleOverride } from "./project-member-roles-db";
import { getProjectById } from "./projects-db";
import { DEFAULT_ROLE_BY_USER } from "./workspace-known-users";
import { isPlatformAdmin } from "./projects-auth";

export type WorkspaceRole = "admin" | "core" | "mid" | "low" | "guest";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  guest: 0,
  low: 1,
  mid: 2,
  core: 3,
  admin: 4,
};

function higherRole(a: WorkspaceRole, b: WorkspaceRole): WorkspaceRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

type RoleEnv = { DB: D1Database };

/** 解析用户在项目上的有效角色（含 DB 覆盖与创建人 Core 下限） */
export async function resolveProjectRole(
  env: RoleEnv,
  userId: string,
  projectId: string,
  createdBy?: string | null,
): Promise<WorkspaceRole> {
  const uid = userId.trim();
  if (!uid) return "guest";
  if (isPlatformAdmin(uid)) return "admin";

  const project = await getProjectById(env, projectId);
  const visibility = project?.visibility ?? "public";
  const creator = (createdBy ?? project?.createdBy ?? "").trim();
  const override = await getProjectMemberRoleOverride(env, projectId, uid);

  // 仅限邀请：非创建人且无成员席位 → Guest（不可当作「进了项目」）
  if (visibility === "invite") {
    if (creator && creator === uid) {
      return higherRole(override ?? "core", "core");
    }
    if (override) return override;
    return "guest";
  }

  let role: WorkspaceRole = override ?? DEFAULT_ROLE_BY_USER[uid] ?? "guest";
  if (creator && creator === uid) {
    role = higherRole(role, "core");
  }
  return role;
}

/** @deprecated 仅作无 DB 时的同步回退；生产路径请用 resolveProjectRole */
export function getProjectRole(userId: string, _projectId: string): WorkspaceRole {
  const uid = userId.trim();
  if (!uid) return "guest";
  if (isPlatformAdmin(uid)) return "admin";
  return DEFAULT_ROLE_BY_USER[uid] ?? "guest";
}

export async function canViewProjectKnowledgeNetwork(
  _env: RoleEnv,
  userId: string,
  _projectId: string,
  _createdBy?: string | null,
): Promise<boolean> {
  return Boolean(userId.trim());
}

/** 列出项目资料包：Guest 不可见 */
export async function canListProjectFiles(
  env: RoleEnv,
  userId: string,
  projectId: string,
  createdBy?: string | null,
): Promise<boolean> {
  const role = await resolveProjectRole(env, userId, projectId, createdBy);
  return role !== "guest";
}

/** 上传/覆盖项目知识网络 HTML：admin / core（创建人自动为 core） */
export async function canPublishProjectKnowledgeNetwork(
  env: RoleEnv,
  userId: string,
  projectId: string,
  createdBy?: string | null,
): Promise<boolean> {
  const role = await resolveProjectRole(env, userId, projectId, createdBy);
  return role === "admin" || role === "core";
}

/** 下载项目资料包原文件：admin / core / 项目创建人 */
export async function canDownloadProjectFile(
  env: RoleEnv,
  userId: string,
  projectId: string,
  createdBy?: string | null,
): Promise<boolean> {
  const uid = userId.trim();
  if (!uid) return false;
  const role = await resolveProjectRole(env, uid, projectId, createdBy);
  if (role === "admin" || role === "core") return true;
  const creator = (createdBy ?? "").trim();
  return Boolean(creator && creator === uid);
}
