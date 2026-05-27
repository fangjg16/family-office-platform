import { canManageProjectRecord } from "./projects-auth";
import {
  createProject,
  deleteProjectCascade,
  getProjectById,
  listProjects,
  normalizeProjectPhase,
  updateProject,
} from "./projects-db";

type Env = { DB: D1Database; FILES: R2Bucket };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeUserId(raw: string | null): string | null {
  const id = (raw ?? "").trim();
  if (!id || id.length > 128) return null;
  return id;
}

export async function handleListProjects(env: Env): Promise<Response> {
  const projects = await listProjects(env);
  return json({ projects });
}

export async function handleGetProject(env: Env, projectId: string): Promise<Response> {
  const project = await getProjectById(env, projectId);
  if (!project) return json({ error: "项目不存在" }, 404);
  return json({ project });
}

export async function handleCreateProject(request: Request, env: Env): Promise<Response> {
  let body: {
    name?: string;
    detail?: string;
    summary?: string;
    category?: string;
    phase?: string;
    createdBy?: string;
    userId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const name = (body.name ?? "").trim();
  if (!name) return json({ error: "请填写项目名称" }, 400);

  const detail = (body.detail ?? body.summary ?? "").trim();
  const summary =
    detail ||
    `${name} 已创建，可上传资料包并在对话中使用 Master Agent 分析。`;
  const guestSummary = `${name} 项目在管推进中，详情按权限展示。`;
  const createdBy = normalizeUserId(body.createdBy ?? body.userId ?? null);

  try {
    const project = await createProject(env, {
      name,
      summary,
      guestSummary,
      category: body.category,
      phase: body.phase as Parameters<typeof createProject>[1]["phase"],
      createdBy,
    });
    return json({ project }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/no such table:\s*projects/i.test(msg)) {
      return json(
        {
          error:
            "projects 表未创建。请在 api-worker 目录执行：npx wrangler d1 execute jfo-meta --remote --file=./migrations/0005_projects.sql",
        },
        503,
      );
    }
    return json({ error: `创建项目失败：${msg}` }, 500);
  }
}

export async function handleUpdateProject(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  let body: {
    name?: string;
    detail?: string;
    summary?: string;
    guestSummary?: string;
    category?: string;
    phase?: string;
    userId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const userId = normalizeUserId(body.userId ?? null);
  if (!userId) return json({ error: "缺少 userId" }, 400);

  const existing = await getProjectById(env, projectId);
  if (!existing) return json({ error: "项目不存在" }, 404);
  if (!canManageProjectRecord(existing, userId)) {
    return json({ error: "仅项目创建人或平台管理员可编辑" }, 403);
  }

  const detail = (body.detail ?? body.summary)?.trim();
  try {
    const project = await updateProject(env, projectId, {
      name: body.name?.trim(),
      summary: detail !== undefined ? detail || existing.summary : undefined,
      guestSummary: body.guestSummary?.trim(),
      category: body.category?.trim(),
      phase: body.phase ? normalizeProjectPhase(body.phase) : undefined,
    });
    if (!project) return json({ error: "项目不存在" }, 404);
    return json({ project });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `更新失败：${msg}` }, 500);
  }
}

export async function handleDeleteProject(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  const url = new URL(request.url);
  let userId = normalizeUserId(url.searchParams.get("userId"));
  if (!userId && request.headers.get("Content-Type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as { userId?: string };
      userId = normalizeUserId(body.userId ?? null);
    } catch {
      /* 无 body */
    }
  }

  if (!userId) return json({ error: "缺少 userId" }, 400);

  const existing = await getProjectById(env, projectId);
  if (!existing) return json({ error: "项目不存在" }, 404);
  if (!canManageProjectRecord(existing, userId)) {
    return json({ error: "仅项目创建人或平台管理员可删除" }, 403);
  }

  try {
    await deleteProjectCascade(env, projectId);
    return json({ ok: true, projectId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `删除失败：${msg}` }, 500);
  }
}
