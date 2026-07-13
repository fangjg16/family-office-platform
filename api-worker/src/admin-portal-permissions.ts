import { requireAdminPortalAuth } from "./admin-portal-auth";
import {
  getProjectMemberRoleOverride,
  upsertProjectMemberRole,
} from "./project-member-roles-db";
import { isPlatformAdmin } from "./projects-auth";
import { listProjects } from "./projects-db";
import { resolveProjectRole, type WorkspaceRole } from "./workspace-roles";
import { workspaceUserProfile } from "./workspace-user-profiles";
import { DEFAULT_ROLE_BY_USER } from "./workspace-known-users";

type Env = {
  DB: D1Database;
  ADMIN_PORTAL_USERNAME?: string;
  ADMIN_PORTAL_PASSWORD?: string;
};

const ROLE_ACCESS_LABEL: Record<WorkspaceRole, string> = {
  admin: "Admin",
  core: "Core 核心级",
  mid: "Advanced 进阶级",
  low: "Basic 基础级",
  guest: "Guest",
};

const ROLE_RANK: Record<WorkspaceRole, number> = {
  guest: 0,
  low: 1,
  mid: 2,
  core: 3,
  admin: 4,
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function higherRole(a: WorkspaceRole, b: WorkspaceRole): WorkspaceRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

export type AdminUserProjectPermissionRow = {
  projectId: string;
  projectName: string;
  accessLabel: string;
  effectiveRole: WorkspaceRole;
  overrideRole: WorkspaceRole | null;
  defaultRole: WorkspaceRole;
  isCreator: boolean;
  canEdit: boolean;
};

async function buildUserPermissionRows(
  env: Env,
  userId: string,
): Promise<AdminUserProjectPermissionRow[]> {
  const projects = await listProjects(env);
  const defaultRole = DEFAULT_ROLE_BY_USER[userId] ?? "guest";
  const platformAdmin = isPlatformAdmin(userId);
  const rows: AdminUserProjectPermissionRow[] = [];

  for (const project of projects) {
    const effectiveRole = await resolveProjectRole(
      env,
      userId,
      project.id,
      project.createdBy,
    );
    const overrideRole = await getProjectMemberRoleOverride(env, project.id, userId);
    const creator = (project.createdBy ?? "").trim();
    const isCreator = Boolean(creator && creator === userId);

    rows.push({
      projectId: project.id,
      projectName: project.name,
      accessLabel: ROLE_ACCESS_LABEL[effectiveRole],
      effectiveRole,
      overrideRole,
      defaultRole,
      isCreator,
      canEdit: !platformAdmin,
    });
  }

  return rows;
}

/** GET /api/admin/users/:userId/permissions */
export async function handleGetAdminUserPermissions(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;

  const uid = userId.trim();
  if (!uid) return json({ error: "无效 userId" }, 400);

  const profile = workspaceUserProfile(uid);
  const projects = await buildUserPermissionRows(env, uid);

  return json({
    ok: true,
    userId: uid,
    displayName: profile.displayName,
    isPlatformAdmin: isPlatformAdmin(uid),
    projects,
  });
}

/** PUT /api/admin/users/:userId/permissions */
export async function handlePutAdminUserPermissions(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;

  const uid = userId.trim();
  if (!uid) return json({ error: "无效 userId" }, 400);
  if (isPlatformAdmin(uid)) {
    return json({ error: "平台管理员权限不可修改" }, 400);
  }

  let body: { updates?: { projectId?: string; role?: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const updates = body.updates ?? [];
  if (!Array.isArray(updates) || updates.length === 0) {
    return json({ error: "请提供 updates 数组" }, 400);
  }

  const allProjects = await listProjects(env);
  const projectById = new Map(allProjects.map((p) => [p.id, p]));

  for (const item of updates) {
    const projectId = (item.projectId ?? "").trim();
    if (!projectId) return json({ error: "updates 中缺少 projectId" }, 400);
    const project = projectById.get(projectId);
    if (!project) return json({ error: `项目不存在：${projectId}` }, 404);

    const rawRole = (item.role ?? "").trim();
    const allowedRoles: WorkspaceRole[] = ["guest", "low", "mid", "core"];
    if (!allowedRoles.includes(rawRole as WorkspaceRole)) {
      return json({ error: `无效角色：${rawRole}` }, 400);
    }

    let role: WorkspaceRole = rawRole as WorkspaceRole;
    const creator = (project.createdBy ?? "").trim();
    if (creator && creator === uid) {
      role = higherRole(role, "core");
    }

    await upsertProjectMemberRole(env, projectId, uid, role, "admin-portal");
  }

  const projects = await buildUserPermissionRows(env, uid);
  return json({
    ok: true,
    userId: uid,
    projects,
  });
}
