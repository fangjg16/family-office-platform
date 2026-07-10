import { workspaceUserDisplayName } from "./workspace-display-names";

type Env = { DB: D1Database };

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
