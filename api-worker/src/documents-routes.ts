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

function splitBasename(filename: string): string {
  const normalized = filename.replace(/\\/g, "/").replace(/^\/+/u, "");
  const i = normalized.lastIndexOf("/");
  return i >= 0 ? normalized.slice(i + 1) : normalized;
}

/** 清洗文件夹相对路径；空字符串表示根目录 */
export function normalizePackageFolderPath(raw: string | null | undefined): string {
  let folder = (raw ?? "").trim().replace(/\\/g, "/");
  folder = folder.replace(/^\/+|\/+$/gu, "");
  if (!folder) return "";
  if (folder.includes("..") || folder.includes("\0")) {
    throw new Error("非法文件夹路径");
  }
  if (!/^[\w.\-一-龥/]+$/u.test(folder)) {
    throw new Error("文件夹名含不支持的字符");
  }
  return folder;
}

export function buildPackageFilename(folder: string, basename: string): string {
  const name = basename.trim().replace(/^\/+/u, "");
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error("非法文件名");
  }
  return folder ? `${folder}/${name}` : name;
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

  const conversationId = (url.searchParams.get("conversationId") ?? "").trim();
  if (
    row.scope === "session" &&
    conversationId &&
    row.conversation_id &&
    row.conversation_id !== conversationId
  ) {
    return json({ error: "该文件不属于当前对话" }, 403);
  }

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

/**
 * PATCH /api/projects/:id/files/:docId
 * body: { userId, folder?: string } — 将资料包文件逻辑路径移入 folder（空=根目录）。
 * 只改 D1 filename（分组依据）；R2 对象 key 不变。
 */
export async function handleMoveProjectFile(
  request: Request,
  env: Env,
  pathProjectId: string,
  docId: string,
): Promise<Response> {
  let body: { userId?: string; folder?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const userId = normalizeUserId(body.userId);
  if (!userId) return json({ error: "缺少 userId" }, 400);

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
  if (row.scope !== "package") {
    return json({ error: "仅项目资料包文件可移动到文件夹" }, 400);
  }

  const accessErr = documentAccessError(row, userId);
  if (accessErr) return json({ error: accessErr }, 403);
  if (!canDeleteDocument(row, userId, project)) {
    return json({ error: "仅项目创建人、平台管理员或该文件上传者可移动" }, 403);
  }

  let folder: string;
  try {
    folder = normalizePackageFolderPath(body.folder ?? "");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "非法文件夹路径" }, 400);
  }

  const basename = splitBasename(row.filename);
  if (!basename) return json({ error: "当前文件名无效" }, 400);

  let nextFilename: string;
  try {
    nextFilename = buildPackageFilename(folder, basename);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "无法生成路径" }, 400);
  }

  if (nextFilename === row.filename) {
    return json({
      ok: true,
      documentId: id,
      projectId,
      filename: row.filename,
      unchanged: true,
    });
  }

  const clash = await env.DB.prepare(
    `SELECT id FROM documents WHERE project_id = ? AND scope = 'package' AND filename = ? AND id != ?`,
  )
    .bind(projectId, nextFilename, id)
    .first<{ id: string }>();
  if (clash) {
    return json({ error: `目标位置已有同名文件：${nextFilename}` }, 409);
  }

  try {
    await env.DB.prepare(
      `UPDATE documents SET filename = ? WHERE id = ? AND project_id = ?`,
    )
      .bind(nextFilename, id, projectId)
      .run();

    await invalidateChunkCache(projectId, userId, undefined);
    if (row.uploaded_by && row.uploaded_by !== userId) {
      await invalidateChunkCache(projectId, row.uploaded_by, undefined);
    }

    return json({
      ok: true,
      documentId: id,
      projectId,
      filename: nextFilename,
      previousFilename: row.filename,
      folder: folder || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: `移动失败：${msg}` }, 500);
  }
}
