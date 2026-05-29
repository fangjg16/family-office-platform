import { invalidateChunkCache } from "./chunk-cache";
import { documentAccessError, type DocumentRow } from "./documents-access";
import { canManageProjectRecord } from "./projects-auth";
import { getProjectById } from "./projects-db";
import { decodePathProjectId } from "./projects-resolve";

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

function canDeleteDocument(
  doc: Pick<DocumentRow, "scope" | "uploaded_by">,
  userId: string,
  project: { createdBy: string | null },
): boolean {
  if (canManageProjectRecord(project, userId)) return true;
  if (doc.uploaded_by && doc.uploaded_by === userId) return true;
  return false;
}

export async function handleDeleteProjectFile(
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
    `SELECT id, project_id, filename, scope, conversation_id, uploaded_by, r2_key
     FROM documents WHERE id = ? AND project_id = ?`,
  )
    .bind(id, projectId)
    .first<DocumentRow>();

  if (!row) return json({ error: "文件不存在或已删除" }, 404);

  const accessErr = documentAccessError(row, userId);
  if (accessErr) return json({ error: accessErr }, 403);

  if (!canDeleteDocument(row, userId, project)) {
    return json({ error: "仅项目创建人、平台管理员或该文件上传者可删除" }, 403);
  }

  try {
    await env.DB.prepare(`DELETE FROM chunks WHERE document_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM documents WHERE id = ? AND project_id = ?`)
      .bind(id, projectId)
      .run();

    if (row.r2_key) {
      try {
        await env.FILES.delete(row.r2_key);
      } catch {
        /* D1 已删；R2 缺失时仍返回成功 */
      }
    }

    await invalidateChunkCache(
      projectId,
      userId,
      row.scope === "session" ? row.conversation_id ?? undefined : undefined,
    );
    if (row.uploaded_by && row.uploaded_by !== userId) {
      await invalidateChunkCache(
        projectId,
        row.uploaded_by,
        row.scope === "session" ? row.conversation_id ?? undefined : undefined,
      );
    }

    return json({
      ok: true,
      documentId: id,
      projectId,
      filename: row.filename,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `删除失败：${msg}` }, 500);
  }
}
