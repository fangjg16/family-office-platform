export type ChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  filename?: string;
};

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
  return pool.slice(-topK);
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
