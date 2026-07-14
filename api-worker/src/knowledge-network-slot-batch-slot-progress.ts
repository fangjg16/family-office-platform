import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import { SLOT_DEFAULT_TITLES } from "./knowledge-network-slot-render";
import {
  KN_SLOT_BATCH_PLAN,
  type KnSlotBatchRunState,
  type KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";

const ACTIVE_BATCH_RUN_STATUSES = new Set<KnSlotBatchRunState["status"]>([
  "queued",
  "pending",
  "running",
]);

/** 并行：batchRuns 活跃 batch 的 slot 并集；串行：当前 batch plan */
export function resolveGeneratingBatchSlots(session: KnSlotBatchSession): CanonicalKbSlot[] {
  if (session.parallelMode && session.batchRuns?.length) {
    const activeIndices = session.batchRuns
      .filter((run) => !run.merged && ACTIVE_BATCH_RUN_STATUSES.has(run.status))
      .map((run) => run.batchIndex);
    if (activeIndices.length > 0) {
      const slotSet = new Set<CanonicalKbSlot>();
      for (const idx of activeIndices) {
        for (const slot of KN_SLOT_BATCH_PLAN[idx] ?? []) {
          slotSet.add(slot);
        }
      }
      return CANONICAL_KB_SLOTS.filter((slot) => slotSet.has(slot));
    }
  }

  const idx = session.currentBatchIndex;
  if (idx >= 0 && idx < KN_SLOT_BATCH_PLAN.length) {
    return [...KN_SLOT_BATCH_PLAN[idx]!];
  }
  return [];
}

export function resolveSlotChineseTitle(slot: string): string {
  const meta = SLOT_DEFAULT_TITLES[slot as CanonicalKbSlot];
  return meta?.title ?? slot;
}

export function formatSlotChineseList(slots: readonly string[]): string[] {
  return slots.map((slot) => resolveSlotChineseTitle(slot));
}

export function formatSlotChineseJoined(slots: readonly string[], max = 6): string {
  const titles = formatSlotChineseList(slots);
  if (titles.length <= max) return titles.join("、");
  return `${titles.slice(0, max).join("、")} 等 ${titles.length} 项`;
}
