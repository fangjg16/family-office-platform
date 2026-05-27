import { getCachedChunks, putCachedChunks } from "./chunk-cache";
import { parseEmbeddingJson } from "./embeddings";
import { LOAD_CHUNKS_SQL } from "./documents-access";
import type { ChunkRow } from "./search";

export type ChatDataEnv = { DB: D1Database };

export async function loadChunks(
  env: ChatDataEnv,
  projectId: string,
  userId: string,
  conversationId?: string,
): Promise<ChunkRow[]> {
  const convKey = conversationId ?? "";
  const cached = await getCachedChunks(projectId, userId, convKey);
  if (cached) return cached;

  const { results } = await env.DB.prepare(LOAD_CHUNKS_SQL)
    .bind(projectId, userId, convKey)
    .all<ChunkRow & { embedding_json?: string | null }>();

  const rows: ChunkRow[] = (results ?? []).map((r) => ({
    id: r.id,
    document_id: r.document_id,
    chunk_index: r.chunk_index,
    text: r.text,
    filename: r.filename,
    scope: r.scope,
    embedding: parseEmbeddingJson(r.embedding_json),
  }));

  await putCachedChunks(projectId, userId, convKey, rows);
  return rows;
}
