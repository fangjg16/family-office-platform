export type EmbedEnv = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  EMBED_MODEL?: string;
  EMBED_DIMENSION?: string;
  EMBED_INSTRUCT?: string;
};

export type EmbedTextOptions = {
  textType?: "query" | "document";
  instruct?: string;
};

const DEFAULT_EMBED_MODEL = "text-embedding-v4";
const DEFAULT_EMBED_DIMENSION = 1024;
const DEFAULT_EMBED_INSTRUCT =
  "Given a family office investment research query, retrieve relevant excerpts from uploaded project documents, business plans, and due diligence materials.";
/** v4 单请求最多 10 条；每条约 8192 tokens，中文按字符保守截断 */
export const EMBED_BATCH_SIZE = 10;
export const EMBED_MAX_INPUT_CHARS = 6000;

const DASHSCOPE_NATIVE_EMBED_PATH =
  "/api/v1/services/embeddings/text-embedding/text-embedding";

type DashScopeEmbedResponse = {
  status_code?: number;
  code?: string;
  message?: string;
  output?: {
    embeddings?: { embedding?: number[]; text_index?: number }[];
  };
  error?: { message?: string };
};

export function resolveEmbedModel(env: EmbedEnv): string {
  return (env.EMBED_MODEL || DEFAULT_EMBED_MODEL).trim() || DEFAULT_EMBED_MODEL;
}

export function resolveEmbedDimension(env: EmbedEnv): number {
  const n = Number.parseInt((env.EMBED_DIMENSION || String(DEFAULT_EMBED_DIMENSION)).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EMBED_DIMENSION;
  return n;
}

export function resolveEmbedInstruct(env: EmbedEnv, override?: string): string {
  const t = (override ?? env.EMBED_INSTRUCT ?? DEFAULT_EMBED_INSTRUCT).trim();
  return t || DEFAULT_EMBED_INSTRUCT;
}

/** 从 compatible-mode base_url 推导 DashScope 原生 embedding endpoint */
export function resolveDashScopeEmbedUrl(baseUrl?: string): string {
  const base = (
    baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1"
  )
    .trim()
    .replace(/\/$/, "");

  if (base.includes(DASHSCOPE_NATIVE_EMBED_PATH)) {
    return base;
  }
  if (base.includes("/compatible-mode/v1")) {
    return base.replace(/\/compatible-mode\/v1$/, DASHSCOPE_NATIVE_EMBED_PATH);
  }
  if (/\/api\/v1$/i.test(base)) {
    return `${base}/services/embeddings/text-embedding/text-embedding`;
  }
  return `https://dashscope.aliyuncs.com${DASHSCOPE_NATIVE_EMBED_PATH}`;
}

export function normalizeEmbedInputs(inputs: string[]): string[] {
  return inputs.map((t) => t.slice(0, EMBED_MAX_INPUT_CHARS));
}

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

function sortEmbeddingsByTextIndex(
  rows: { embedding?: number[]; text_index?: number }[],
  expected: number,
): number[][] {
  const sorted = [...rows].sort((a, b) => (a.text_index ?? 0) - (b.text_index ?? 0));
  const out: number[][] = [];
  for (let i = 0; i < expected; i++) {
    const vec = sorted[i]?.embedding ?? [];
    out.push(vec.length > 0 ? vec : []);
  }
  return out;
}

async function embedTextsBatch(
  env: EmbedEnv,
  inputs: string[],
  options: EmbedTextOptions,
): Promise<number[][]> {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key || inputs.length === 0) return [];

  const url = resolveDashScopeEmbedUrl(env.DASHSCOPE_BASE_URL);
  const model = resolveEmbedModel(env);
  const dimension = resolveEmbedDimension(env);
  const textType = options.textType ?? "document";

  const parameters: Record<string, string | number> = {
    dimension,
    output_type: "dense",
    text_type: textType,
  };
  if (textType === "query") {
    parameters.instruct = resolveEmbedInstruct(env, options.instruct);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: { texts: inputs },
      parameters,
    }),
  });

  const raw = (await res.json()) as DashScopeEmbedResponse;
  const httpOk = res.ok && (raw.status_code == null || raw.status_code === 200);
  if (!httpOk) {
    const msg =
      raw.message ||
      raw.error?.message ||
      raw.code ||
      `embedding HTTP ${res.status}`;
    throw new Error(msg);
  }

  const rows = raw.output?.embeddings ?? [];
  const vectors = sortEmbeddingsByTextIndex(rows, inputs.length);
  if (vectors.some((v) => v.length === 0)) {
    throw new Error("embedding 返回空向量");
  }
  return vectors;
}

/** 向量化文本；自动按官方 batch 上限分批，保持输入顺序 */
export async function embedTexts(
  env: EmbedEnv,
  inputs: string[],
  options: EmbedTextOptions = {},
): Promise<number[][]> {
  const normalized = normalizeEmbedInputs(inputs);
  if (normalized.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < normalized.length; i += EMBED_BATCH_SIZE) {
    const batch = normalized.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedTextsBatch(env, batch, options);
    if (vectors.length !== batch.length) {
      throw new Error(
        `embedding 返回条数不一致：期望 ${batch.length}，实际 ${vectors.length}`,
      );
    }
    out.push(...vectors);
  }
  return out;
}

/** 底库文档 chunk：text_type=document */
export async function embedDocumentTexts(env: EmbedEnv, inputs: string[]): Promise<number[][]> {
  return embedTexts(env, inputs, { textType: "document" });
}

/** 用户检索 query：text_type=query + instruct */
export async function embedQueryTexts(env: EmbedEnv, inputs: string[]): Promise<number[][]> {
  return embedTexts(env, inputs, { textType: "query" });
}

export type ReembedDocumentResult = {
  documentId: string;
  chunkCount: number;
  embeddedCount: number;
  skipped: boolean;
  reason?: string;
};

/** 为单个文档的全部 chunk 重算 document 向量并写回 D1 */
export async function reembedDocumentChunks(
  env: EmbedEnv & { DB: D1Database },
  documentId: string,
): Promise<ReembedDocumentResult> {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key) {
    return {
      documentId,
      chunkCount: 0,
      embeddedCount: 0,
      skipped: true,
      reason: "DASHSCOPE_API_KEY 未配置",
    };
  }

  const expectedDim = resolveEmbedDimension(env);

  const { results } = await env.DB.prepare(
    `SELECT id, text FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC`,
  )
    .bind(documentId)
    .all<{ id: string; text: string }>();

  const rows = results ?? [];
  if (rows.length === 0) {
    return {
      documentId,
      chunkCount: 0,
      embeddedCount: 0,
      skipped: true,
      reason: "无 chunk",
    };
  }

  const texts = rows.map((r) => r.text);
  const vectors = await embedDocumentTexts(env, texts);
  let embeddedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const vec = vectors[i];
    if (!vec?.length || vec.length !== expectedDim) continue;
    await env.DB.prepare(`UPDATE chunks SET embedding_json = ? WHERE id = ?`)
      .bind(JSON.stringify(vec), rows[i]!.id)
      .run();
    embeddedCount++;
  }

  return { documentId, chunkCount: rows.length, embeddedCount, skipped: false };
}

export async function embedDocumentChunks(
  env: EmbedEnv & { DB: D1Database },
  documentId: string,
): Promise<void> {
  await reembedDocumentChunks(env, documentId);
}

export function scoreChunksByEmbedding(
  chunks: { row: import("./search").ChunkRow; embedding: number[] | null }[],
  queryEmbedding: number[],
  topK: number,
): import("./search").ChunkRow[] {
  const qDim = queryEmbedding.length;
  const scored = chunks
    .filter((c) => c.embedding && c.embedding.length > 0 && c.embedding.length === qDim)
    .map((c) => ({
      row: c.row,
      score: cosineSimilarity(queryEmbedding, c.embedding!),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  return scored.slice(0, topK).map((s) => s.row);
}
