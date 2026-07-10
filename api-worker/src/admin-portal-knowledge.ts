import { workspaceUserDisplayName } from "./workspace-display-names";

type Env = {
  DB: D1Database;
  EMBED_MODEL?: string;
  EMBED_DIMENSION?: string;
};

export type AdminKnowledgeDocument = {
  id: string;
  projectId: string;
  projectName: string;
  filename: string;
  scope: "package" | "session";
  folderLabel: string;
  conversationId: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  parseStatus: "已解析" | "解析中" | "待嵌入";
  chunkCount: number;
  embeddedCount: number;
};

export type AdminKnowledgeNetworkRow = {
  projectId: string;
  projectName: string;
  version: number;
  versionLabel: string | null;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  lastJobId: string | null;
  changelog: string | null;
};

export type AdminKnowledgeSummary = {
  documentCount: number;
  parsedCount: number;
  pendingEmbedCount: number;
  knowledgeNetworkCount: number;
  embedModel: string;
  embedDimension: number;
};

export type AdminKnowledgeCatalog = {
  documents: AdminKnowledgeDocument[];
  knowledgeNetworks: AdminKnowledgeNetworkRow[];
  summary: AdminKnowledgeSummary;
};

type DocRow = {
  id: string;
  project_id: string;
  filename: string;
  scope: string;
  conversation_id: string | null;
  created_at: string;
  uploaded_by: string | null;
  chunk_count: number;
  embedded_count: number;
};

type KnRow = {
  project_id: string;
  version: number;
  version_label: string | null;
  updated_at: string;
  updated_by: string;
  last_job_id: string | null;
  changelog: string | null;
};

function formatDocDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseStatusFromCounts(
  chunkCount: number,
  embeddedCount: number,
): AdminKnowledgeDocument["parseStatus"] {
  if (chunkCount <= 0) return "解析中";
  if (embeddedCount < chunkCount) return "待嵌入";
  return "已解析";
}

export async function buildAdminKnowledgeCatalog(
  env: Env,
  projects: { id: string; name: string }[],
): Promise<AdminKnowledgeCatalog> {
  const projectIds = projects.map((p) => p.id);
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  const documents: AdminKnowledgeDocument[] = [];
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => "?").join(", ");
    const { results } = await env.DB.prepare(
      `SELECT d.id, d.project_id, d.filename, d.scope, d.conversation_id, d.created_at,
              d.uploaded_by,
              (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count,
              (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id
                 AND c.embedding_json IS NOT NULL AND TRIM(c.embedding_json) != '') AS embedded_count
       FROM documents d
       WHERE d.project_id IN (${placeholders})
       ORDER BY d.project_id ASC, d.created_at DESC
       LIMIT 500`,
    )
      .bind(...projectIds)
      .all<DocRow>();

    for (const row of results ?? []) {
      const chunkCount = Number(row.chunk_count) || 0;
      const embeddedCount = Number(row.embedded_count) || 0;
      const scope = row.scope === "session" ? "session" : "package";
      documents.push({
        id: row.id,
        projectId: row.project_id,
        projectName: nameById.get(row.project_id) ?? row.project_id,
        filename: row.filename,
        scope,
        folderLabel: scope === "session" ? "对话附件" : "项目资料包",
        conversationId: row.conversation_id,
        uploadedAt: formatDocDate(row.created_at),
        uploadedBy: row.uploaded_by,
        uploadedByName: row.uploaded_by
          ? workspaceUserDisplayName(row.uploaded_by)
          : null,
        parseStatus: parseStatusFromCounts(chunkCount, embeddedCount),
        chunkCount,
        embeddedCount,
      });
    }
  }

  const knowledgeNetworks: AdminKnowledgeNetworkRow[] = [];
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => "?").join(", ");
    try {
      const { results } = await env.DB.prepare(
        `SELECT project_id, version, version_label, updated_at, updated_by, last_job_id, changelog
         FROM project_knowledge_networks
         WHERE project_id IN (${placeholders})
         ORDER BY updated_at DESC`,
      )
        .bind(...projectIds)
        .all<KnRow>();

      for (const row of results ?? []) {
        knowledgeNetworks.push({
          projectId: row.project_id,
          projectName: nameById.get(row.project_id) ?? row.project_id,
          version: Number(row.version) || 1,
          versionLabel: row.version_label,
          updatedAt: formatDocDate(row.updated_at),
          updatedBy: row.updated_by,
          updatedByName: workspaceUserDisplayName(row.updated_by),
          lastJobId: row.last_job_id,
          changelog: row.changelog,
        });
      }
    } catch {
      /* table may be missing on old DB */
    }
  }

  const parsedCount = documents.filter((d) => d.parseStatus === "已解析").length;
  const pendingEmbedCount = documents.filter((d) => d.parseStatus === "待嵌入").length;

  return {
    documents,
    knowledgeNetworks,
    summary: {
      documentCount: documents.length,
      parsedCount,
      pendingEmbedCount,
      knowledgeNetworkCount: knowledgeNetworks.length,
      embedModel: (env.EMBED_MODEL || "text-embedding-v4").trim(),
      embedDimension: Number((env.EMBED_DIMENSION || "1024").trim()) || 1024,
    },
  };
}
