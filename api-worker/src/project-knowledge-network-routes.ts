import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  type ProjectKnowledgeNetworkEnv,
} from "./project-knowledge-network";
import { getProjectById } from "./projects-db";
import { canViewProjectKnowledgeNetwork } from "./workspace-roles";

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

/** GET /api/projects/:projectId/knowledge-network?userId= */
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

  return json({
    ok: true,
    projectId,
    hasKnowledgeNetwork: true,
    meta: {
      version: meta.version,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
      r2Key: meta.r2Key,
    },
    html: includeHtml ? html : undefined,
  });
}
