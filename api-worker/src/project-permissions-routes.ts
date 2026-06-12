import {
  isAssignableProjectRole,
  listKnownWorkspaceUsers,
  listProjectMemberRoleOverrides,
  upsertProjectMemberRole,
} from "./project-member-roles-db";
import { canManageProjectRecord } from "./projects-auth";
import { getProjectById, listProjects } from "./projects-db";
import { decodePathProjectId } from "./projects-resolve";
import { resolveProjectRole, type WorkspaceRole } from "./workspace-roles";
import { workspaceUserDisplayName } from "./workspace-display-names";
type Env = { DB: D1Database };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeUserId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim();
  return id.length > 0 ? id : null;
}

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

export type ProjectPermissionMember = {
  userId: string;
  displayName: string;
  defaultRole: WorkspaceRole;
  overrideRole: WorkspaceRole | null;
  effectiveRole: WorkspaceRole;
  isCreator: boolean;
  isPlatformAdmin: boolean;
};

async function buildPermissionMembers(
  env: Env,
  projectId: string,
  createdBy: string | null,
): Promise<ProjectPermissionMember[]> {
  const overrides = await listProjectMemberRoleOverrides(env, projectId);
  const creator = (createdBy ?? "").trim();

  return listKnownWorkspaceUsers().map(({ userId, defaultRole }) => {
    const overrideRole = overrides[userId] ?? null;
    let effectiveRole: WorkspaceRole = overrideRole ?? defaultRole;
    const isCreator = Boolean(creator && creator === userId);
    if (isCreator) {
      effectiveRole = higherRole(effectiveRole, "core");
    }
    if (userId === "candice-guo") {
      effectiveRole = "admin";
    }
    return {
      userId,
      displayName: workspaceUserDisplayName(userId),
      defaultRole,
      overrideRole,
      effectiveRole,
      isCreator,
      isPlatformAdmin: userId === "candice-guo",
    };
  });
}

/** GET /api/projects/:id/permissions?userId= */
export async function handleGetProjectPermissions(
  env: Env,
  pathProjectId: string,
  userIdRaw: string | null,
): Promise<Response> {
  const userId = normalizeUserId(userIdRaw);
  if (!userId) return json({ error: "缺少 userId 查询参数" }, 400);

  const projectId = decodePathProjectId(pathProjectId);
  const project = await getProjectById(env, projectId);
  if (!project) return json({ error: "项目不存在" }, 404);

  const canManage = canManageProjectRecord(project, userId);
  if (!canManage) {
    return json({ error: "仅平台管理员或项目创建人可查看权限管理" }, 403);
  }

  const members = await buildPermissionMembers(env, projectId, project.createdBy);
  return json({
    projectId,
    createdBy: project.createdBy,
    canManage: true,
    members,
  });
}

/** PUT /api/projects/:id/permissions?userId= */
export async function handlePutProjectPermissions(
  request: Request,
  env: Env,
  pathProjectId: string,
  userIdRaw: string | null,
): Promise<Response> {
  const userId = normalizeUserId(userIdRaw);
  if (!userId) return json({ error: "缺少 userId 查询参数" }, 400);

  const projectId = decodePathProjectId(pathProjectId);
  const project = await getProjectById(env, projectId);
  if (!project) return json({ error: "项目不存在" }, 404);

  if (!canManageProjectRecord(project, userId)) {
    return json({ error: "仅平台管理员或项目创建人可修改权限" }, 403);
  }

  let body: { updates?: { userId?: string; role?: string }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const updates = body.updates ?? [];
  if (!Array.isArray(updates) || updates.length === 0) {
    return json({ error: "请提供 updates 数组" }, 400);
  }

  const creator = (project.createdBy ?? "").trim();

  for (const item of updates) {
    const targetId = normalizeUserId(item.userId ?? null);
    if (!targetId) return json({ error: "updates 中缺少 userId" }, 400);
    if (targetId === "candice-guo") {
      return json({ error: "平台管理员权限不可在此修改" }, 400);
    }
    const rawRole = (item.role ?? "").trim();
    if (!isAssignableProjectRole(rawRole)) {
      return json({ error: `无效角色：${rawRole}` }, 400);
    }
    let role: WorkspaceRole = rawRole;
    if (creator && creator === targetId) {
      role = higherRole(role, "core");
    }
    await upsertProjectMemberRole(env, projectId, targetId, role, userId);
  }

  const members = await buildPermissionMembers(env, projectId, project.createdBy);
  return json({
    ok: true,
    projectId,
    createdBy: project.createdBy,
    members,
  });
}

/** GET /api/users/:userId/project-roles — 当前用户在各项目上的有效角色 */
export async function handleGetUserProjectRoles(
  env: Env,
  routeUserId: string,
): Promise<Response> {
  const userId = normalizeUserId(routeUserId);
  if (!userId) return json({ error: "无效 userId" }, 400);

  const projects = await listProjects(env);
  const roles: Record<string, WorkspaceRole> = {};
  for (const p of projects) {
    roles[p.id] = await resolveProjectRole(env, userId, p.id, p.createdBy);
  }
  return json({ userId, roles });
}
