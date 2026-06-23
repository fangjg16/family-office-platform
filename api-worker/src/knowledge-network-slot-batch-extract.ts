import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  STRUCTURED_SLOT_BATCH_TYPE,
  type StructuredSlotBatchPayload,
} from "./knowledge-network-slot-batch-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";
import { extractStructuredSlotPatchFromAnswer } from "./knowledge-network-structured-patch";

const CANONICAL_SET = new Set<string>(CANONICAL_KB_SLOTS);

function extractFencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const m of text.matchAll(re)) {
    const body = m[1]?.trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

function normalizeSlotsInput(raw: unknown): StructuredSlotBatchPayload["slots"] {
  const slots: StructuredSlotBatchPayload["slots"] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Record<string, unknown>;
      const slot = String(row.slot ?? "").trim() as CanonicalKbSlot;
      if (!CANONICAL_SET.has(slot)) continue;
      if (typeof row.payload !== "object" || row.payload === null) continue;
      slots.push({
        slot,
        payload: row.payload as SlotPayloadBySlot[typeof slot],
        status: row.status === "draft" ? "draft" : "ready",
      });
    }
    return slots;
  }
  if (typeof raw === "object" && raw !== null) {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (!CANONICAL_SET.has(key)) continue;
      if (typeof val !== "object" || val === null) continue;
      const row = val as Record<string, unknown>;
      const payload =
        typeof row.payload === "object" && row.payload !== null ? row.payload : val;
      slots.push({
        slot: key as CanonicalKbSlot,
        payload: payload as SlotPayloadBySlot[CanonicalKbSlot],
        status: row.status === "draft" ? "draft" : "ready",
      });
    }
  }
  return slots;
}

function parseBatchObject(raw: unknown): StructuredSlotBatchPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== STRUCTURED_SLOT_BATCH_TYPE) return null;
  if (o.schemaVersion !== "2.91") return null;

  const status = o.status === "blocked" ? "blocked" : "ready";
  const blockedReason =
    typeof o.blockedReason === "string" ? o.blockedReason.trim() : undefined;
  const slots = normalizeSlotsInput(o.slots);

  if (status === "blocked") {
    return {
      type: STRUCTURED_SLOT_BATCH_TYPE,
      schemaVersion: "2.91",
      mode: o.mode === "initial" ? "initial" : o.mode === "full" ? "full" : undefined,
      batchIndex: typeof o.batchIndex === "number" ? o.batchIndex : 0,
      summary: typeof o.summary === "string" ? o.summary : undefined,
      status: "blocked",
      blockedReason: blockedReason || "Hermes status blocked",
      slots,
    };
  }

  if (!slots.length) return null;

  return {
    type: STRUCTURED_SLOT_BATCH_TYPE,
    schemaVersion: "2.91",
    mode: o.mode === "initial" ? "initial" : o.mode === "full" ? "full" : undefined,
    batchIndex: typeof o.batchIndex === "number" ? o.batchIndex : 0,
    summary: typeof o.summary === "string" ? o.summary : undefined,
    status: "ready",
    config: o.config as StructuredSlotBatchPayload["config"],
    meta: o.meta as StructuredSlotBatchPayload["meta"],
    sources: Array.isArray(o.sources)
      ? (o.sources as StructuredSlotBatchPayload["sources"])
      : undefined,
    sourceProposals: Array.isArray(o.sourceProposals)
      ? (o.sourceProposals as StructuredSlotBatchPayload["sourceProposals"])
      : undefined,
    terms: o.terms as StructuredSlotBatchPayload["terms"],
    dataDictionary: o.dataDictionary as StructuredSlotBatchPayload["dataDictionary"],
    slots,
  };
}

export type SlotBatchExtractResult =
  | { ok: true; batch: StructuredSlotBatchPayload }
  | {
      ok: false;
      reason: string;
      blocked?: boolean;
      blockedReason?: string;
      fallbackPatches?: number;
    };

/** 从 Hermes 回复提取 structured-slot-batch；兼容 slots array/object 与 status:blocked */
export function extractStructuredSlotBatchFromAnswer(answer: string): SlotBatchExtractResult {
  const blocks = extractFencedJsonBlocks(answer);
  let lastReason = "未找到 structured-slot-batch JSON";

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const batch = parseBatchObject(parsed);
      if (batch?.status === "blocked") {
        return {
          ok: false,
          reason: batch.blockedReason ?? "Hermes status blocked",
          blocked: true,
          blockedReason: batch.blockedReason,
        };
      }
      if (batch) return { ok: true, batch };
      lastReason = "JSON 不是有效的 structured-slot-batch";
    } catch {
      lastReason = "structured-slot-batch JSON 解析失败";
    }
  }

  const patches: StructuredSlotBatchPayload["slots"] = [];
  const batchIndex = 0;
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      if (typeof parsed !== "object" || parsed === null) continue;
      const t = (parsed as Record<string, unknown>).type;
      if (t === STRUCTURED_SLOT_BATCH_TYPE) continue;
      if (t === "structured-slot-patch") {
        const ext = extractStructuredSlotPatchFromAnswer(`\`\`\`json\n${block}\n\`\`\``);
        if (ext.ok) {
          patches.push({ slot: ext.patch.slot, payload: ext.patch.payload, status: "ready" });
        }
      }
    } catch {
      /* skip */
    }
  }
  if (patches.length > 0) {
    return {
      ok: true,
      batch: {
        type: STRUCTURED_SLOT_BATCH_TYPE,
        schemaVersion: "2.91",
        batchIndex,
        slots: patches,
      },
    };
  }

  return { ok: false, reason: lastReason };
}
