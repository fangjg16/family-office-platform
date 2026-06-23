/** Slot-batch 架构与并行 guard（受控 rollout） */

export type SlotBatchArchitecture = "v1" | "v2";

export type SlotBatchEnvConfig = {
  KN_SLOT_BATCH_V2_ENABLED?: string;
  KN_SLOT_BATCH_FORCE_V1?: string;
  KN_SLOT_BATCH_PARALLEL_LIMIT?: string;
  KN_SLOT_BATCH_STARTS_PER_TICK?: string;
};

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

/** 用户消息显式请求 v1（smoke / 回退） */
export function userMessageRequestsSlotBatchV1(message: string): boolean {
  return /\bslot-batch-v1\b|串行\s*slot-batch|slot-batched?\s*v1/i.test(message);
}

/**
 * 解析 full/initial 使用的 slot-batch 架构。
 * - 默认 v2（KN_SLOT_BATCH_V2_ENABLED 未设或非 0）
 * - KN_SLOT_BATCH_FORCE_V1=1 或用户消息含 slot-batch-v1 → v1
 */
export function resolveSlotBatchArchitecture(
  env: SlotBatchEnvConfig,
  opts?: { userMessage?: string },
): SlotBatchArchitecture {
  if (truthy(env.KN_SLOT_BATCH_FORCE_V1)) return "v1";
  if (opts?.userMessage && userMessageRequestsSlotBatchV1(opts.userMessage)) return "v1";
  const disabled =
    env.KN_SLOT_BATCH_V2_ENABLED === "0" || env.KN_SLOT_BATCH_V2_ENABLED === "false";
  if (disabled) return "v1";
  return "v2";
}

/** Hermes 并行 batch 上限（1–4，默认 4） */
export function resolveParallelBatchLimit(env: SlotBatchEnvConfig): number {
  const raw = (env.KN_SLOT_BATCH_PARALLEL_LIMIT ?? "4").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(4, n));
}

/** 单次 Worker invocation 内最多启动几个并行 Hermes batch（防 subrequest 超限） */
export function resolveMaxParallelStartsPerInvocation(env: SlotBatchEnvConfig): number {
  const raw = (env.KN_SLOT_BATCH_STARTS_PER_TICK ?? "1").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, n));
}
