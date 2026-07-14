import {
  reembedDocumentChunks,
  resolveEmbedDimension,
  resolveEmbedModel,
  type EmbedEnv,
} from "./embeddings";
import { requireHermesAuth, type HermesBridgeEnv } from "./hermes-bridge";

export type DocumentReembedRow = {
  id: string;
  project_id: string;
  filename: string;
  chunk_count: number;
  missing_embeddings: number;
};

export type ReembedDocumentsOptions = {
  projectId?: string;
  documentId?: string;
  missingOnly?: boolean;
  dryRun?: boolean;
  delayMs?: number;
  /** 同步模式每次最多处理文档数；0 = 不限制 */
  limit?: number;
  offset?: number;
};

export type ReembedDocumentsSummary = {
  ok: boolean;
  model: string;
  dimension: number;
  documents: number;
  chunks: number;
  embedded: number;
  results: Awaited<ReturnType<typeof reembedDocumentChunks>>[];
  failures: { documentId: string; error: string }[];
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export async function listDocumentsForReembed(
  env: { DB: D1Database },
  options: ReembedDocumentsOptions,
): Promise<DocumentReembedRow[]> {
  const clauses: string[] = [];
  const binds: string[] = [];

  if (options.documentId?.trim()) {
    clauses.push("d.id = ?");
    binds.push(options.documentId.trim());
  }
  if (options.projectId?.trim()) {
    clauses.push("d.project_id = ?");
    binds.push(options.projectId.trim());
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `
    SELECT
      d.id,
      d.project_id,
      d.filename,
      COUNT(c.id) AS chunk_count,
      SUM(
        CASE
          WHEN c.embedding_json IS NULL OR TRIM(c.embedding_json) = '' THEN 1
          ELSE 0
        END
      ) AS missing_embeddings
    FROM documents d
    INNER JOIN chunks c ON c.document_id = d.id
    ${where}
    GROUP BY d.id
    ORDER BY d.created_at ASC
  `;

  const stmt = env.DB.prepare(sql);
  const bound = binds.length > 0 ? stmt.bind(...binds) : stmt;
  const { results } = await bound.all<DocumentReembedRow>();
  let rows = results ?? [];
  if (options.missingOnly) {
    rows = rows.filter((r) => Number(r.missing_embeddings) > 0);
  }
  return rows;
}

export async function reembedDocuments(
  env: EmbedEnv & { DB: D1Database },
  options: ReembedDocumentsOptions,
): Promise<ReembedDocumentsSummary> {
  const model = resolveEmbedModel(env);
  const dimension = resolveEmbedDimension(env);
  let docs = await listDocumentsForReembed(env, options);
  const offset = Math.max(0, options.offset ?? 0);
  if (offset > 0) docs = docs.slice(offset);
  const limit = options.limit ?? 0;
  if (limit > 0) docs = docs.slice(0, limit);
  const delayMs = Math.max(0, options.delayMs ?? 300);

  if (options.dryRun) {
    return {
      ok: true,
      model,
      dimension,
      documents: docs.length,
      chunks: docs.reduce((n, d) => n + Number(d.chunk_count), 0),
      embedded: 0,
      results: [],
      failures: [],
    };
  }

  const results: Awaited<ReturnType<typeof reembedDocumentChunks>>[] = [];
  const failures: { documentId: string; error: string }[] = [];
  let totalChunks = 0;
  let totalEmbedded = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    try {
      const result = await reembedDocumentChunks(env, doc.id);
      results.push(result);
      if (!result.skipped) {
        totalChunks += result.chunkCount;
        totalEmbedded += result.embeddedCount;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ documentId: doc.id, error: msg });
    }
    if (i < docs.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    ok: failures.length === 0,
    model,
    dimension,
    documents: docs.length,
    chunks: totalChunks,
    embedded: totalEmbedded,
    results,
    failures,
  };
}

/** POST /api/admin/documents/reembed — Bearer JFO_INTERNAL_KEY */
export async function handleReembedDocuments(
  request: Request,
  env: HermesBridgeEnv & EmbedEnv & { DB: D1Database },
  url: URL,
  ctx?: ExecutionContext,
): Promise<Response> {
  const auth = requireHermesAuth(request, env);
  if (auth) return auth;

  const projectId = (url.searchParams.get("projectId") ?? "").trim() || undefined;
  const documentId = (url.searchParams.get("documentId") ?? "").trim() || undefined;
  const missingOnly =
    url.searchParams.get("missingOnly") === "1" ||
    url.searchParams.get("missingOnly") === "true";
  const dryRun =
    url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const delayMs = Number.parseInt(url.searchParams.get("delayMs") ?? "300", 10);
  const asyncMode =
    url.searchParams.get("async") === "1" || url.searchParams.get("async") === "true";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "0", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);

  if (!(env.DASHSCOPE_API_KEY || "").trim()) {
    return json({ ok: false, error: "Worker 未配置 DASHSCOPE_API_KEY" }, 500);
  }

  const baseOptions: ReembedDocumentsOptions = {
    projectId,
    documentId,
    missingOnly,
    dryRun,
    delayMs: Number.isFinite(delayMs) ? delayMs : 300,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    offset: Number.isFinite(offset) && offset > 0 ? offset : undefined,
  };

  try {
    if (asyncMode && !dryRun && ctx) {
      const docs = await listDocumentsForReembed(env, {
        projectId,
        documentId,
        missingOnly,
      });
      let queued = docs;
      if (baseOptions.offset) queued = queued.slice(baseOptions.offset);
      if (baseOptions.limit) queued = queued.slice(0, baseOptions.limit);

      if (queued.length === 0) {
        return json({
          ok: true,
          accepted: false,
          documents: 0,
          message: "没有待重算的文档",
        });
      }

      ctx.waitUntil(
        reembedDocuments(env, baseOptions)
          .then((summary) => {
            console.log(
              JSON.stringify({
                event: "documents_reembed_complete",
                ...summary,
              }),
            );
          })
          .catch((e) => {
            console.error(
              JSON.stringify({
                event: "documents_reembed_failed",
                error: e instanceof Error ? e.message : String(e),
              }),
            );
          }),
      );

      return json(
        {
          ok: true,
          accepted: true,
          status: "processing",
          documents: queued.length,
          items: queued,
          model: resolveEmbedModel(env),
          dimension: resolveEmbedDimension(env),
          message:
            "已在 Worker 后台重算向量（约 1–3 分钟）。完成后用 dryRun=1&missingOnly=1 检查 missing_embeddings 是否为 0。",
        },
        202,
      );
    }

    const summary = await reembedDocuments(env, baseOptions);
    const docs = await listDocumentsForReembed(env, { projectId, documentId, missingOnly });
    return json({ ...summary, items: docs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
}
