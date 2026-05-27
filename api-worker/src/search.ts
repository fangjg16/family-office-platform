import type { EmbedEnv } from "./embeddings";
import { embedTexts, scoreChunksByEmbedding } from "./embeddings";

export type ChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  filename?: string;
  scope?: string;
  embedding?: number[] | null;
};

const PACKAGE_SCOPE = "package";

function sortChunksInDocOrder(a: ChunkRow, b: ChunkRow): number {
  if (a.document_id !== b.document_id) {
    return a.document_id.localeCompare(b.document_id);
  }
  return a.chunk_index - b.chunk_index;
}

/** 深度模式：优先注入项目资料包全部 chunk，再补 session；受 maxChars 限制 */
export function selectChunksForChat(
  chunks: ChunkRow[],
  query: string,
  options: { deep: boolean; maxChars: number; topK?: number },
): ChunkRow[] {
  const usable = chunks.filter((c) => !isPlaceholderChunkText(c.text));
  const pool = usable.length > 0 ? usable : chunks;
  const topK = options.topK ?? 8;

  if (!options.deep) {
    return scoreChunks(pool, query, topK);
  }

  const packageChunks = pool
    .filter((c) => (c.scope ?? PACKAGE_SCOPE) !== "session")
    .sort(sortChunksInDocOrder);
  const sessionChunks = pool.filter((c) => c.scope === "session").sort(sortChunksInDocOrder);
  const sessionHits =
    sessionChunks.length > 0 ? scoreChunks(sessionChunks, query, Math.min(16, sessionChunks.length)) : [];

  const ordered = [...packageChunks];
  for (const c of sessionHits) {
    if (!ordered.some((x) => x.id === c.id)) ordered.push(c);
  }

  const selected: ChunkRow[] = [];
  let total = 0;
  for (const c of ordered) {
    const len = c.text.length;
    if (total > 0 && total + len > options.maxChars) break;
    selected.push(c);
    total += len;
  }

  if (selected.length > 0) return selected;
  return scoreChunks(pool, query, topK);
}

function extractSearchTerms(query: string): string[] {
  const terms = new Set<string>();
  const raw = query.trim();
  if (!raw) return [];

  for (const part of raw.split(/[\s,，。；;、？?！!]+/u)) {
    const t = part.trim().toLowerCase();
    if (t.length >= 2) terms.add(t);
  }

  const cjk = raw.replace(/[^\u4e00-\u9fff]/gu, "");
  for (const len of [6, 5, 4, 3, 2] as const) {
    for (let i = 0; i <= cjk.length - len; i++) {
      terms.add(cjk.slice(i, i + len));
    }
  }

  return Array.from(terms).slice(0, 40);
}

export function isPlaceholderChunkText(text: string): boolean {
  return /（已上传 PDF|暂未解析|未能提取|未在云端解析/u.test(text);
}

/** 无向量：按关键词在 chunk 文本里计分 */
export function scoreChunks(chunks: ChunkRow[], query: string, topK = 6): ChunkRow[] {
  const usable = chunks.filter((c) => !isPlaceholderChunkText(c.text));
  const pool = usable.length > 0 ? usable : chunks;
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, topK);

  const terms = extractSearchTerms(query);
  if (terms.length === 0) return pool.slice(0, topK);

  const scored = pool.map((c) => {
    const hay = `${c.text} ${c.filename ?? ""}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hay.includes(term)) score += 1;
    }
    return { c, score };
  });

  const ranked = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.c);

  if (ranked.length > 0) return ranked;
  return [...pool].sort(sortChunksInDocOrder).slice(0, topK);
}

/** 泛项目问题（无明确关键词）应优先读资料包前文，而非仅取末尾 chunk */
export function isGenericProjectQuestion(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return /这是什么项目|项目是什么|什么项目|介绍.{0,6}项目|项目.{0,6}介绍|项目背景|项目概况|项目情况|有哪些资料|资料里|上传了|说了什么|讲的是什么|项目是做什么|项目做什么/u.test(
    m,
  );
}

/** 优先向量检索（chunk 已 embedding），否则关键词；轻问仍走 Hermes，仅减少摘录体积 */
export async function selectChunksForChatWithVectors(
  env: EmbedEnv,
  chunks: ChunkRow[],
  query: string,
  options: { deep: boolean; maxChars: number; topK?: number },
): Promise<ChunkRow[]> {
  const topK = options.topK ?? 8;
  const embedded = chunks.filter((c) => c.embedding && c.embedding.length > 0);
  if (!options.deep && embedded.length >= 3 && (env.DASHSCOPE_API_KEY || "").trim()) {
    try {
      const vectors = await embedTexts(env, [query]);
      const qVec = vectors[0];
      if (qVec?.length) {
        const ranked = scoreChunksByEmbedding(
          chunks.map((c) => ({ row: c, embedding: c.embedding ?? null })),
          qVec,
          topK,
        );
        if (ranked.length > 0) {
          let total = 0;
          const selected: ChunkRow[] = [];
          for (const c of ranked) {
            if (total > 0 && total + c.text.length > options.maxChars) break;
            selected.push(c);
            total += c.text.length;
          }
          if (selected.length > 0) return selected;
        }
      }
    } catch {
      /* 向量失败则关键词 */
    }
  }
  return selectChunksForChat(chunks, query, options);
}

export function chunkPlainText(text: string, size = 900): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const out: string[] = [];
  for (let i = 0; i < normalized.length; i += size) {
    out.push(normalized.slice(i, i + size));
  }
  return out;
}
