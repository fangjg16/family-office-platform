import type { MaterialSnapshot } from "./knowledge-network-material-snapshot";

export type MaterialSnapshotStoreEnv = { FILES: R2Bucket };

export function projectMaterialSnapshotR2Key(projectId: string): string {
  return `projects/${projectId}/kn-material-snapshot.json`;
}

export async function loadProjectMaterialSnapshot(
  env: MaterialSnapshotStoreEnv,
  projectId: string,
): Promise<MaterialSnapshot | null> {
  try {
    const obj = await env.FILES.get(projectMaterialSnapshotR2Key(projectId));
    if (!obj) return null;
    const raw = await obj.text();
    const parsed = JSON.parse(raw) as MaterialSnapshot;
    if (!parsed?.fingerprint || !Array.isArray(parsed.documents)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveProjectMaterialSnapshot(
  env: MaterialSnapshotStoreEnv,
  projectId: string,
  snapshot: MaterialSnapshot,
): Promise<void> {
  await env.FILES.put(projectMaterialSnapshotR2Key(projectId), JSON.stringify(snapshot), {
    httpMetadata: { contentType: "application/json" },
  });
}
