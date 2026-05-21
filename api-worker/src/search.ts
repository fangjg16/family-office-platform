export type ChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  filename?: string;
};

/** 无向量：按关键词在 chunk 文本里计分 */
export function scoreChunks(chunks: ChunkRow[], query: string, topK = 6): ChunkRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return chunks.slice(0, topK);

  const terms = Array.from(
    new Set(
      q
        .split(/[\s,，。；;、]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
  if (terms.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((c) => {
    const hay = c.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hay.includes(term)) score += 1;
    }
    return { c, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.c);
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
