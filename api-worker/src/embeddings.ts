type EmbedEnv = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
};

const EMBED_MODEL = "text-embedding-v3";

export function parseEmbeddingJson(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as number[];
    return Array.isArray(v) && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedTexts(env: EmbedEnv, inputs: string[]): Promise<number[][]> {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key || inputs.length === 0) return [];

  const base = (
    env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
  )
    .trim()
    .replace(/\/$/, "");

  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs.map((t) => t.slice(0, 2000)),
    }),
  });

  const raw = (await res.json()) as {
    data?: { embedding?: number[] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(raw.error?.message || `embedding HTTP ${res.status}`);
  }
  return (raw.data ?? []).map((d) => d.embedding ?? []).filter((v) => v.length > 0);
}

export async function embedDocumentChunks(
  env: EmbedEnv & { DB: D1Database },
  documentId: string,
): Promise<void> {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key) return;

  const { results } = await env.DB.prepare(
    `SELECT id, text FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 120`,
  )
    .bind(documentId)
    .all<{ id: string; text: string }>();

  const rows = results ?? [];
  if (rows.length === 0) return;

  const texts = rows.map((r) => r.text.slice(0, 2000));
  const vectors = await embedTexts(env, texts);
  for (let i = 0; i < rows.length; i++) {
    const vec = vectors[i];
    if (!vec?.length) continue;
    await env.DB.prepare(`UPDATE chunks SET embedding_json = ? WHERE id = ?`)
      .bind(JSON.stringify(vec), rows[i]!.id)
      .run();
  }
}

export function scoreChunksByEmbedding(
  chunks: { row: import("./search").ChunkRow; embedding: number[] | null }[],
  queryEmbedding: number[],
  topK: number,
): import("./search").ChunkRow[] {
  const scored = chunks
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((c) => ({
      row: c.row,
      score: cosineSimilarity(queryEmbedding, c.embedding!),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  return scored.slice(0, topK).map((s) => s.row);
}
