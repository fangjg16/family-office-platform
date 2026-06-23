import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";
import { normalizeSlotPayload } from "./knowledge-network-slot-normalizer";

/**
 * @deprecated 使用 normalizeSlotPayload；保留此导出以兼容旧调用点。
 */
export function adaptSlotPayloadFromCodexKeys<S extends CanonicalKbSlot>(
  slot: S,
  payload: unknown,
): SlotPayloadBySlot[S] {
  return normalizeSlotPayload(slot, payload).payload;
}

/** 全量 structured-kb-data 归一化（渲染 / 入库前） */
export function adaptStructuredKbDataFromCodexKeys(data: StructuredKbData): StructuredKbData {
  const slots = { ...data.slots };
  for (const slot of CANONICAL_KB_SLOTS) {
    slots[slot] = normalizeSlotPayload(
      slot,
      slots[slot],
    ).payload as SlotPayloadBySlot[typeof slot];
  }
  return { ...data, slots };
}
