import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

export type KnGenerationMode = "structured" | "fragment";

export type KnGenerationModeEnv = {
  KN_GENERATION_MODE?: string;
};

/** 用户消息强制 structured slot-batch（运维回退） */
export function userMessageRequestsStructuredGeneration(message: string): boolean {
  return /\bslot-batch-structured\b|structured-slot-batch\s*模式/i.test(message);
}

/** 用户消息强制 fragment（显式 smoke） */
export function userMessageRequestsFragmentGeneration(message: string): boolean {
  return /\bfragment-batch\b|kb-fragment-batch|slot-batch-fragment/i.test(message);
}

/**
 * full/initial slot-batch 交付物：structured JSON vs HTML fragment。
 * 默认 fragment；KN_GENERATION_MODE=structured 或用户消息 slot-batch-structured → structured。
 */
export function resolveKnGenerationMode(
  env: KnGenerationModeEnv,
  opts?: { userMessage?: string },
): KnGenerationMode {
  if (opts?.userMessage && userMessageRequestsStructuredGeneration(opts.userMessage)) {
    return "structured";
  }
  if (opts?.userMessage && userMessageRequestsFragmentGeneration(opts.userMessage)) {
    return "fragment";
  }
  const raw = (env.KN_GENERATION_MODE ?? "fragment").trim().toLowerCase();
  if (raw === "structured" || raw === "json") return "structured";
  return raw === "fragment" || raw === "html" ? "fragment" : "fragment";
}

export function isFragmentGenerationSession(
  session: Pick<KnSlotBatchSession, "generationMode">,
): boolean {
  return session.generationMode === "fragment";
}

/** v2.91：13 canonical slot 必须出现在 HTML + nav（非隐藏开关，文档锚点） */
export const KN_FRAGMENT_REQUIRE_ALL_CANONICAL_SLOTS = true as const;
