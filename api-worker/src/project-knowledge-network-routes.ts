import {
  getProjectKnowledgeNetworkMeta,
  listProjectKnowledgeNetworkVersions,
  readProjectKnowledgeNetworkHtml,
  readProjectKnowledgeNetworkVersionHtml,
  upsertProjectKnowledgeNetwork,
  validateProjectKnowledgeNetworkHtml,
  type ProjectKnowledgeNetworkEnv,
} from "./project-knowledge-network";
import { getProjectById } from "./projects-db";
import {
  canPublishProjectKnowledgeNetwork,
  canViewProjectKnowledgeNetwork,
} from "./workspace-roles";
import { workspaceUserDisplayName } from "./workspace-display-names";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeUserId(raw: string | null): string | null {
  const id = (raw ?? "").trim();
  return id.length > 0 ? id : null;
}

function metaJson(meta: {
  version: number;
  updatedAt: string;
  updatedBy: string;
  lastJobId: string | null;
  changelog: string | null;
  r2Key: string;
}) {
  return {
    version: meta.version,
    updatedAt: meta.updatedAt,
    updatedBy: meta.updatedBy,
    updatedByDisplayName: workspaceUserDisplayName(meta.updatedBy),
    lastJobId: meta.lastJobId,
    changelog: meta.changelog,
    r2Key: meta.r2Key,
  };
}

/** PUT /api/projects/:projectId/knowledge-network?userId= — 本地上传 HTML 覆盖当前版（归档旧版） */
export async function handlePutProjectKnowledgeNetwork(
  request: Request,
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
  userIdRaw: string | null,
): Promise<Response> {
  const userId = normalizeUserId(userIdRaw);
  if (!userId) {
    return json({ error: "缺少 userId 查询参数" }, 400);
  }

  const project = await getProjectById(env, projectId);
  if (!project) {
    return json({ error: "项目不存在" }, 404);
  }
  if (!canPublishProjectKnowledgeNetwork(userId, projectId)) {
    return json(
      { error: "当前角色无权上传或覆盖项目知识网络", code: "PUBLISH_FORBIDDEN" },
      403,
    );
  }

  let body: { html?: string; changelog?: string };
  try {
    body = (await request.json()) as { html?: string; changelog?: string };
  } catch {
    return json({ error: "请求体须为 JSON：{ html, changelog? }" }, 400);
  }

  const html = typeof body.html === "string" ? body.html : "";
  const validationError = validateProjectKnowledgeNetworkHtml(html);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const note = (body.changelog ?? "").trim().slice(0, 500);
  const meta = await upsertProjectKnowledgeNetwork(env, {
    projectId,
    userId,
    html: html.trim(),
    lastJobId: null,
    answerSummary: note || "本地上传 HTML 覆盖（视为全新当前版）",
  });

  return json({
    ok: true,
    projectId,
    hasKnowledgeNetwork: true,
    meta: metaJson({
      version: meta.version,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
      r2Key: meta.r2Key,
    }),
    message: `已发布为项目知识网络 v${meta.version}；旧版已归档，后续「按板块更新」将基于此版。`,
  });
}

/** GET /api/projects/:projectId/knowledge-network?userId=&html=1 */
export async function handleGetProjectKnowledgeNetwork(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
  userIdRaw: string | null,
  includeHtml: boolean,
): Promise<Response> {
  const userId = normalizeUserId(userIdRaw);
  if (!userId) {
    return json({ error: "缺少 userId 查询参数" }, 400);
  }

  const project = await getProjectById(env, projectId);
  if (!project) {
    return json({ error: "项目不存在" }, 404);
  }

  if (!canViewProjectKnowledgeNetwork(userId, projectId)) {
    return json({ error: "访客无权查看项目知识网络", code: "GUEST_FORBIDDEN" }, 403);
  }

  const meta = await getProjectKnowledgeNetworkMeta(env, projectId);
  if (!meta) {
    return json({
      ok: true,
      projectId,
      hasKnowledgeNetwork: false,
      meta: null,
      html: null,
      versions: [],
    });
  }

  let html: string | null = null;
  if (includeHtml) {
    html = await readProjectKnowledgeNetworkHtml(env, projectId);
    if (!html) {
      return json({
        ok: true,
        projectId,
        hasKnowledgeNetwork: false,
        meta: null,
        html: null,
        warning: "元数据存在但 R2 文件缺失",
      });
    }
  }

  const archived = await listProjectKnowledgeNetworkVersions(env, projectId);

  return json({
    ok: true,
    projectId,
    hasKnowledgeNetwork: true,
    meta: metaJson({
      version: meta.version,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
      r2Key: meta.r2Key,
    }),
    html: includeHtml ? html : undefined,
    versions: archived.map((v) => ({
      version: v.version,
      updatedAt: v.updatedAt,
      updatedBy: v.updatedBy,
      updatedByDisplayName: workspaceUserDisplayName(v.updatedBy),
      changelog: v.changelog,
    })),
  });
}

/** GET /api/projects/:projectId/knowledge-network/versions/:version?userId= */
export async function handleGetProjectKnowledgeNetworkVersion(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
  version: number,
  userIdRaw: string | null,
): Promise<Response> {
  const userId = normalizeUserId(userIdRaw);
  if (!userId) {
    return json({ error: "缺少 userId 查询参数" }, 400);
  }
  if (!Number.isFinite(version) || version < 1) {
    return json({ error: "无效版本号" }, 400);
  }

  const project = await getProjectById(env, projectId);
  if (!project) {
    return json({ error: "项目不存在" }, 404);
  }
  if (!canViewProjectKnowledgeNetwork(userId, projectId)) {
    return json({ error: "访客无权查看项目知识网络", code: "GUEST_FORBIDDEN" }, 403);
  }

  const html = await readProjectKnowledgeNetworkVersionHtml(env, projectId, version);
  if (!html) {
    return json({ error: "版本不存在或 R2 文件缺失" }, 404);
  }
  return json({ ok: true, projectId, version, html });
}
