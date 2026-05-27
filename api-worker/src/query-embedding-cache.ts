import type { EmbedEnv } from "./embeddings";
import { embedTexts } from "./embeddings";

const CACHE_PREFIX = "https://jfo-query-embed.local/v1";
/** 同项目、同问题短时复用 query 向量，减少 DashScope 往返 */
const CACHE_MAX_AGE_SEC = 600;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function cacheKey(projectId: string, normalizedQuery: string): string {
  const q = normalizedQuery.slice(0, 480);
  return `${CACHE_PREFIX}/${encodeURIComponent(projectId)}/${encodeURIComponent(q)}`;
}

async function readCachedVector(
  projectId: string,
  normalizedQuery: string,
): Promise<number[] | null> {
  const cache = caches.default;
  const res = await cache.match(cacheKey(projectId, normalizedQuery));
  if (!res) return null;
  try {
    const data = (await res.json()) as number[];
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

async function writeCachedVector(
  projectId: string,
  normalizedQuery: string,
  vector: number[],
): Promise<void> {
  const cache = caches.default;
  await cache.put(
    cacheKey(projectId, normalizedQuery),
    new Response(JSON.stringify(vector), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `max-age=${CACHE_MAX_AGE_SEC}`,
      },
    }),
  );
}

/** 带 Workers Cache 的 query embedding；未命中时调 DashScope */
export async function getQueryEmbeddingCached(
  env: EmbedEnv,
  projectId: string,
  query: string,
): Promise<number[] | null> {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key) return null;

  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const cached = await readCachedVector(projectId, normalized);
  if (cached) return cached;

  const vectors = await embedTexts(env, [query]);
  const vec = vectors[0];
  if (!vec?.length) return null;

  await writeCachedVector(projectId, normalized, vec);
  return vec;
}
