import { requireAdminPortalAuth } from "./admin-portal-auth";
import type { DocumentRow } from "./documents-access";
import { workspaceUserDisplayName } from "./workspace-display-names";

type Env = {
  DB: D1Database;
  FILES?: R2Bucket;
  ADMIN_PORTAL_USERNAME?: string;
  ADMIN_PORTAL_PASSWORD?: string;
};

export type AdminDocParseStatus = "已解析" | "解析中" | "失败";

export type AdminPackageDocument = {
  filename: string;
  parseStatus: AdminDocParseStatus;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
};

export type AdminSessionDocument = AdminPackageDocument & {
  userId: string;
  userName: string;
  conversationId: string;
};

export type AdminProjectDocuments = {
  projectDocuments: AdminPackageDocument[];
  conversationDocuments: AdminSessionDocument[];
};

type DocRow = {
  filename: string;
  scope: string;
  conversation_id: string | null;
  created_at: string;
  uploaded_by: string | null;
  chunk_count: number;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function parseStatusFromChunks(chunkCount: number): AdminDocParseStatus {
  return chunkCount > 0 ? "已解析" : "解析中";
}

function formatDocDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function listProjectDocumentsForAdmin(
  env: Env,
  projectId: string,
): Promise<AdminProjectDocuments> {
  const { results } = await env.DB.prepare(
    `SELECT d.filename, d.scope, d.conversation_id, d.created_at, d.uploaded_by,
            (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
     FROM documents d
     WHERE d.project_id = ?
     ORDER BY d.created_at DESC
     LIMIT 200`,
  )
    .bind(projectId)
    .all<DocRow>();

  const projectDocuments: AdminPackageDocument[] = [];
  const conversationDocuments: AdminSessionDocument[] = [];

  for (const row of results ?? []) {
    const base = {
      filename: row.filename,
      parseStatus: parseStatusFromChunks(Number(row.chunk_count) || 0),
      uploadedAt: formatDocDate(row.created_at),
      uploadedBy: row.uploaded_by,
      uploadedByName: row.uploaded_by
        ? workspaceUserDisplayName(row.uploaded_by)
        : null,
    };
    if (row.scope === "session") {
      const userId = (row.uploaded_by ?? "").trim();
      if (!userId) continue;
      conversationDocuments.push({
        ...base,
        userId,
        userName: workspaceUserDisplayName(userId),
        conversationId: row.conversation_id ?? "",
      });
    } else {
      projectDocuments.push(base);
    }
  }

  return { projectDocuments, conversationDocuments };
}

export async function countAllProjectDocuments(
  env: Env,
  projectIds: string[],
): Promise<number> {
  if (projectIds.length === 0) return 0;
  const placeholders = projectIds.map(() => "?").join(", ");
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM documents WHERE project_id IN (${placeholders})`,
  )
    .bind(...projectIds)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function buildProjectDocumentsMap(
  env: Env,
  projectIds: string[],
): Promise<Record<string, AdminProjectDocuments>> {
  const map: Record<string, AdminProjectDocuments> = {};
  for (const projectId of projectIds) {
    map[projectId] = await listProjectDocumentsForAdmin(env, projectId);
  }
  return map;
}

/** GET /api/admin/documents/:documentId/download?projectId=&disposition=inline|attachment */
export async function handleAdminDownloadDocument(
  request: Request,
  env: Env,
  documentId: string,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;

  if (!env.FILES) return json({ error: "文件存储未配置" }, 503);

  const id = documentId.trim();
  if (!id) return json({ error: "缺少 documentId" }, 400);

  const url = new URL(request.url);
  const projectId = (url.searchParams.get("projectId") ?? "").trim();
  const dispositionParam = (url.searchParams.get("disposition") ?? "attachment").trim();
  const disposition = dispositionParam === "inline" ? "inline" : "attachment";

  const row = projectId
    ? await env.DB.prepare(
        `SELECT id, project_id, filename, scope, conversation_id, uploaded_by, r2_key, mime
         FROM documents WHERE id = ? AND project_id = ?`,
      )
        .bind(id, projectId)
        .first<DocumentRow & { project_id: string; mime: string | null }>()
    : await env.DB.prepare(
        `SELECT id, project_id, filename, scope, conversation_id, uploaded_by, r2_key, mime
         FROM documents WHERE id = ?`,
      )
        .bind(id)
        .first<DocumentRow & { project_id: string; mime: string | null }>();

  if (!row) return json({ error: "文件不存在或已删除" }, 404);
  if (!row.r2_key) return json({ error: "文件对象不存在" }, 404);

  const object = await env.FILES.get(row.r2_key);
  if (!object) return json({ error: "R2 中找不到文件对象" }, 404);

  const mime = row.mime || object.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", mime);
  headers.set(
    "Content-Disposition",
    `${disposition}; filename="${encodeURIComponent(row.filename)}"`,
  );

  return new Response(object.body, { status: 200, headers });
}
