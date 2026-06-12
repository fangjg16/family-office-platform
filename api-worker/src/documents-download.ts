import { documentAccessError, type DocumentRow } from "./documents-access";
import { getProjectById } from "./projects-db";
import { decodePathProjectId } from "./projects-resolve";
import { canDownloadProjectFile } from "./workspace-roles";

type Env = { DB: D1Database; FILES: R2Bucket };

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

/** GET /api/projects/:projectId/files/:docId/download?userId= */
export async function handleDownloadProjectFile(
  request: Request,
  env: Env,
  pathProjectId: string,
  docId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const userId = normalizeUserId(url.searchParams.get("userId"));
  if (!userId) return json({ error: "缺少 userId 查询参数" }, 400);

  const projectId = decodePathProjectId(pathProjectId);
  const id = docId.trim();
  if (!id) return json({ error: "缺少 documentId" }, 400);

  const project = await getProjectById(env, projectId);
  if (!project) return json({ error: "项目不存在" }, 404);

  const row = await env.DB.prepare(
    `SELECT id, project_id, filename, scope, conversation_id, uploaded_by, r2_key, mime
     FROM documents WHERE id = ? AND project_id = ?`,
  )
    .bind(id, projectId)
    .first<DocumentRow & { mime: string | null }>();

  if (!row) return json({ error: "文件不存在或已删除" }, 404);

  const accessErr = documentAccessError(row, userId);
  if (accessErr) return json({ error: accessErr }, 403);

  if (row.scope === "package") {
    const allowed = await canDownloadProjectFile(
      env,
      userId,
      projectId,
      project.createdBy,
    );
    if (!allowed) {
      return json({ error: "仅 Admin、Core 或项目创建人可下载资料包文件" }, 403);
    }
  }

  if (!row.r2_key) {
    return json({ error: "文件对象不存在" }, 404);
  }

  const object = await env.FILES.get(row.r2_key);
  if (!object) {
    return json({ error: "R2 中找不到文件对象" }, 404);
  }

  const headers = new Headers();
  const mime = row.mime || "application/octet-stream";
  headers.set("Content-Type", mime);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(row.filename)}"`,
  );

  return new Response(object.body, { status: 200, headers });
}
