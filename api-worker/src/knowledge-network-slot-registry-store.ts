import type { KnSlotRegistry } from "./knowledge-network-kb-config";
import { buildSlotRegistryFromKnowledgeNetworkHtml } from "./knowledge-network-kb-config";

export type KnSlotRegistryStoreEnv = { FILES: R2Bucket };

export function projectKnSlotRegistryR2Key(projectId: string): string {
  return `projects/${projectId}/knowledge-network/slot-registry.json`;
}

export async function loadProjectKnSlotRegistry(
  env: KnSlotRegistryStoreEnv,
  projectId: string,
): Promise<KnSlotRegistry | null> {
  try {
    const obj = await env.FILES.get(projectKnSlotRegistryR2Key(projectId));
    if (!obj) return null;
    const raw = await obj.text();
    const parsed = JSON.parse(raw) as KnSlotRegistry;
    if (!parsed?.displayOrder?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveProjectKnSlotRegistry(
  env: KnSlotRegistryStoreEnv,
  projectId: string,
  registry: KnSlotRegistry,
): Promise<void> {
  await env.FILES.put(projectKnSlotRegistryR2Key(projectId), JSON.stringify(registry), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function clearProjectKnSlotRegistry(
  env: KnSlotRegistryStoreEnv,
  projectId: string,
): Promise<void> {
  try {
    await env.FILES.delete(projectKnSlotRegistryR2Key(projectId));
  } catch {
    /* best-effort */
  }
}

/** 优先 R2 registry；无则从当前 KB HTML 解析（并不要求已持久化） */
export async function resolveProjectKnSlotRegistry(
  env: KnSlotRegistryStoreEnv,
  projectId: string,
  html?: string | null,
): Promise<KnSlotRegistry | null> {
  const stored = await loadProjectKnSlotRegistry(env, projectId);
  if (stored?.hasExtensions) return stored;
  if (html?.trim()) {
    const fromHtml = buildSlotRegistryFromKnowledgeNetworkHtml(html);
    return fromHtml.hasExtensions ? fromHtml : stored;
  }
  return stored;
}
