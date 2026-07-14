import type { SlotBatchEnvConfig } from "./knowledge-network-slot-batch-config";

/** 单 Hermes batch run 默认超时（20 分钟） */
export const DEFAULT_BATCH_RUN_TIMEOUT_MS = 20 * 60_000;

export function resolveBatchRunTimeoutMs(
  env: SlotBatchEnvConfig & { KN_SLOT_BATCH_RUN_TIMEOUT_MS?: string },
): number {
  const raw = (env.KN_SLOT_BATCH_RUN_TIMEOUT_MS ?? "").trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) return n;
  }
  return DEFAULT_BATCH_RUN_TIMEOUT_MS;
}

export function batchRunElapsedMs(startedAt: string | undefined, now = Date.now()): number {
  if (!startedAt) return 0;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, now - t);
}

export function isBatchRunTimedOut(
  startedAt: string | undefined,
  timeoutMs: number,
  now = Date.now(),
): boolean {
  const elapsed = batchRunElapsedMs(startedAt, now);
  return elapsed > 0 && elapsed >= timeoutMs;
}

export function buildBatchRunTimeoutRetryMessage(
  batchIndex: number,
  timeoutMs: number,
  outputFormatLabel: string,
): string {
  const min = Math.round(timeoutMs / 60_000);
  return (
    `【批次 ${batchIndex + 1} 超时重试 · 仅一次】` +
    `上一 Hermes run 已超过 ${min} 分钟无结果，已取消。` +
    `请重新交付本批 ${outputFormatLabel}。`
  );
}
