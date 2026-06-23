import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";
import { knSlotBatchSessionR2Key } from "./knowledge-network-slot-batch-types";

export type SlotBatchEnv = {
  FILES: R2Bucket;
};

export async function readKnSlotBatchSession(
  env: SlotBatchEnv,
  projectId: string,
  jobId: string,
): Promise<KnSlotBatchSession | null> {
  const obj = await env.FILES.get(knSlotBatchSessionR2Key(projectId, jobId));
  if (!obj) return null;
  try {
    const parsed = JSON.parse(await obj.text()) as KnSlotBatchSession;
    if (parsed?.version !== 1 && parsed?.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeKnSlotBatchSession(
  env: SlotBatchEnv,
  session: KnSlotBatchSession,
): Promise<void> {
  const body = JSON.stringify(session);
  await env.FILES.put(knSlotBatchSessionR2Key(session.projectId, session.jobId), body, {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function deleteKnSlotBatchSession(
  env: SlotBatchEnv,
  projectId: string,
  jobId: string,
): Promise<void> {
  await env.FILES.delete(knSlotBatchSessionR2Key(projectId, jobId));
}
