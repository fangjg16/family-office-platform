import type { WorkspaceRole } from "./workspace-roles";
import { DEFAULT_ROLE_BY_USER, KNOWN_WORKSPACE_USER_IDS } from "./workspace-known-users";

type Env = { DB: D1Database };

export type ProjectMemberRoleRow = {
  project_id: string;
  user_id: string;
  role: string;
  updated_at: string;
  updated_by: string | null;
};

const ASSIGNABLE_ROLES: WorkspaceRole[] = ["guest", "low", "mid", "core"];

export function isAssignableProjectRole(role: string): role is WorkspaceRole {
  return ASSIGNABLE_ROLES.includes(role as WorkspaceRole);
}

export async function getProjectMemberRoleOverride(
  env: Env,
  projectId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const row = await env.DB.prepare(
    `SELECT role FROM project_member_roles WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId.trim())
    .first<{ role: string }>();
  if (!row?.role) return null;
  const role = row.role as WorkspaceRole;
  if (
    role === "admin" ||
    role === "core" ||
    role === "mid" ||
    role === "low" ||
    role === "guest"
  ) {
    return role;
  }
  return null;
}

export async function listProjectMemberRoleOverrides(
  env: Env,
  projectId: string,
): Promise<Record<string, WorkspaceRole>> {
  const { results } = await env.DB.prepare(
    `SELECT user_id, role FROM project_member_roles WHERE project_id = ?`,
  )
    .bind(projectId)
    .all<{ user_id: string; role: string }>();

  const map: Record<string, WorkspaceRole> = {};
  for (const row of results ?? []) {
    const role = row.role as WorkspaceRole;
    if (
      role === "admin" ||
      role === "core" ||
      role === "mid" ||
      role === "low" ||
      role === "guest"
    ) {
      map[row.user_id] = role;
    }
  }
  return map;
}

export async function upsertProjectMemberRole(
  env: Env,
  projectId: string,
  userId: string,
  role: WorkspaceRole,
  updatedBy: string,
): Promise<void> {
  const t = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO project_member_roles (project_id, user_id, role, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       role = excluded.role,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(projectId, userId.trim(), role, t, updatedBy)
    .run();
}

export async function deleteProjectMemberRolesForProject(
  env: Env,
  projectId: string,
): Promise<void> {
  await env.DB.prepare(`DELETE FROM project_member_roles WHERE project_id = ?`)
    .bind(projectId)
    .run();
}

export async function seedProjectMemberRoles(
  env: Env,
  projectId: string,
  createdBy: string | null,
  participants: { userId: string; role: WorkspaceRole }[],
  updatedBy: string,
): Promise<void> {
  const creator = (createdBy ?? "").trim();
  const seen = new Set<string>();

  if (creator) {
    await upsertProjectMemberRole(env, projectId, creator, "core", updatedBy);
    seen.add(creator);
  }

  for (const p of participants) {
    const uid = p.userId.trim();
    if (!uid || !isKnownWorkspaceUser(uid) || seen.has(uid)) continue;
    const role = isAssignableProjectRole(p.role) ? p.role : "mid";
    await upsertProjectMemberRole(env, projectId, uid, role, updatedBy);
    seen.add(uid);
  }
}

export function listKnownWorkspaceUsers(): { userId: string; defaultRole: WorkspaceRole }[] {
  return KNOWN_WORKSPACE_USER_IDS.map((userId) => ({
    userId,
    defaultRole: DEFAULT_ROLE_BY_USER[userId] ?? "guest",
  }));
}
