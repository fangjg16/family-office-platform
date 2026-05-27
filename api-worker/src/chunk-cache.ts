import type { ChunkRow } from "./search";

const CACHE_PREFIX = "https://jfo-chunk-cache.local/v1";

function cacheKey(projectId: string, userId: string, conversationId: string): string {
  return `${CACHE_PREFIX}/${encodeURIComponent(projectId)}/${encodeURIComponent(userId)}/${encodeURIComponent(conversationId)}`;
}

export async function getCachedChunks(
  projectId: string,
  userId: string,
  conversationId: string,
): Promise<ChunkRow[] | null> {
  const cache = caches.default;
  const res = await cache.match(cacheKey(projectId, userId, conversationId));
  if (!res) return null;
  try {
    const data = (await res.json()) as ChunkRow[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function putCachedChunks(
  projectId: string,
  userId: string,
  conversationId: string,
  rows: ChunkRow[],
): Promise<void> {
  const cache = caches.default;
  await cache.put(
    cacheKey(projectId, userId, conversationId),
    new Response(JSON.stringify(rows), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=300",
      },
    }),
  );
}

/** 上传/删资料后调用，避免读到旧 chunk 列表 */
export async function invalidateChunkCache(
  projectId: string,
  userId?: string,
  conversationId?: string,
): Promise<void> {
  const cache = caches.default;
  if (userId && conversationId) {
    await cache.delete(cacheKey(projectId, userId, conversationId));
  }
  if (userId) {
    await cache.delete(cacheKey(projectId, userId, ""));
  }
  await cache.delete(cacheKey(projectId, "", ""));
}
