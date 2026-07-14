import { formatKnVersionDisplay } from "./knowledge-network-version";
import { validateKnowledgeNetworkHtmlForWrite } from "./knowledge-network-html-validation";
import {
  getProjectKnowledgeNetworkMeta,
  listProjectKnowledgeNetworkVersions,
  readProjectKnowledgeNetworkHtml,
  readProjectKnowledgeNetworkVersionHtml,
  rollbackProjectKnowledgeNetwork,
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
  versionLabel: string | null;
  updatedAt: string;
  updatedBy: string;
  lastJobId: string | null;
  changelog: string | null;
  r2Key: string;
}) {
  const versionDisplay = formatKnVersionDisplay(meta.version, meta.versionLabel);
  return {
    version: meta.version,
    versionLabel: meta.versionLabel,
    versionDisplay,
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
  if (!(await canPublishProjectKnowledgeNetwork(env, userId, projectId, project.createdBy))) {
    return json(
      { error: "当前角色无权上传或覆盖项目知识网络", code: "PUBLISH_FORBIDDEN" },
      403,
    );
  }

  let body: { html?: string; changelog?: string; uploadFileName?: string };
  try {
    body = (await request.json()) as {
      html?: string;
      changelog?: string;
      uploadFileName?: string;
    };
  } catch {
    return json({ error: "请求体须为 JSON：{ html, changelog?, uploadFileName? }" }, 400);
  }

  const html = typeof body.html === "string" ? body.html : "";
  const validationError = validateProjectKnowledgeNetworkHtml(html);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  const trimmed = html.trim();
  const strictValidation = validateKnowledgeNetworkHtmlForWrite(trimmed, {
    mode: "full",
    strict: true,
    browserUpload: true,
    touchesTimeline: /id=["']timeline-milestones["']/i.test(trimmed),
  });
  const htmlToStore = strictValidation.ok ? (strictValidation.html ?? trimmed) : trimmed;
  const note = (body.changelog ?? "").trim().slice(0, 500);
  const uploadFileName =
    typeof body.uploadFileName === "string" ? body.uploadFileName.trim() : "";
  const meta = await upsertProjectKnowledgeNetwork(env, {
    projectId,
    userId,
    html: htmlToStore,
    lastJobId: null,
    answerSummary: note || "本地上传 HTML 覆盖（视为全新当前版）",
    uploadFileName: uploadFileName || undefined,
  });
  const vDisplay = formatKnVersionDisplay(meta.version, meta.versionLabel);

  return json({
    ok: true,
    projectId,
    hasKnowledgeNetwork: true,
    meta: metaJson({
      version: meta.version,
      versionLabel: meta.versionLabel,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
      r2Key: meta.r2Key,
    }),
    warning: strictValidation.ok
      ? (strictValidation.warning ?? null)
      : `当前 HTML 已按宽松模式覆盖，但不符合平台标准结构（${strictValidation.error ?? "结构校验未通过"}）；后续「按板块更新」可能不可用，建议需要局部更新时先「全量重做」为平台标准版。`,
    message: strictValidation.ok
      ? `已发布为项目知识网络 v${vDisplay}；旧版已归档，后续「按板块更新」将基于此版。`
      : `已宽松覆盖为项目知识网络 v${vDisplay}；旧版已归档。`,
  });
}

/** POST /api/projects/:projectId/knowledge-network/rollback?userId= — 回滚至归档版 */
export async function handleRollbackProjectKnowledgeNetwork(
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
  if (!(await canPublishProjectKnowledgeNetwork(env, userId, projectId, project.createdBy))) {
    return json(
      { error: "当前角色无权回滚项目知识网络", code: "PUBLISH_FORBIDDEN" },
      403,
    );
  }

  let body: { archiveVersion?: number } = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as { archiveVersion?: number };
    }
  } catch {
    return json({ error: "请求体须为 JSON：{ archiveVersion? }" }, 400);
  }

  const archiveVersion =
    body.archiveVersion != null && Number.isFinite(body.archiveVersion)
      ? body.archiveVersion
      : undefined;

  try {
    const result = await rollbackProjectKnowledgeNetwork(
      env,
      projectId,
      userId,
      archiveVersion,
    );

    const vDisplay = formatKnVersionDisplay(result.meta.version, result.meta.versionLabel);
    const removedDisplay =
      result.removedVersion != null
        ? formatKnVersionDisplay(result.removedVersion, result.removedVersionLabel)
        : null;

    return json({
      ok: true,
      projectId,
      hasKnowledgeNetwork: true,
      meta: metaJson({
        version: result.meta.version,
        versionLabel: result.meta.versionLabel,
        updatedAt: result.meta.updatedAt,
        updatedBy: result.meta.updatedBy,
        lastJobId: result.meta.lastJobId,
        changelog: result.meta.changelog,
        r2Key: result.meta.r2Key,
      }),
      removedVersion: result.removedVersion,
      removedVersionDisplay: removedDisplay,
      message: removedDisplay
        ? `已回滚至 v${vDisplay}（已撤销 v${removedDisplay}）`
        : `已回滚至 v${vDisplay}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "回滚失败";
    return json({ error: msg }, 400);
  }
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

  if (!(await canViewProjectKnowledgeNetwork(env, userId, projectId, project.createdBy))) {
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
      versionLabel: meta.versionLabel,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
      r2Key: meta.r2Key,
    }),
    html: includeHtml ? html : undefined,
    versions: archived.map((v) => ({
      version: v.version,
      versionLabel: v.versionLabel,
      versionDisplay: formatKnVersionDisplay(v.version, v.versionLabel),
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
  if (!(await canViewProjectKnowledgeNetwork(env, userId, projectId, project.createdBy))) {
    return json({ error: "访客无权查看项目知识网络", code: "GUEST_FORBIDDEN" }, 403);
  }

  const html = await readProjectKnowledgeNetworkVersionHtml(env, projectId, version);
  if (!html) {
    return json({ error: "版本不存在或 R2 文件缺失" }, 404);
  }
  return json({ ok: true, projectId, version, html });
}
