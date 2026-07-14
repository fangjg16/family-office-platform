import type { KnGenerationMode } from "./knowledge-network-generation-mode";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  CANONICAL_KB_SLOTS,
  type KnHtmlValidationResult,
  validateKnowledgeNetworkHtml,
} from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  validateEvidenceSourceIdsAgainstAppendixA,
  validateSlotPayload,
} from "./knowledge-network-slot-payload-validation";
import {
  extractSectionTitleBlock,
  renderSlotPayloadByCanonicalSlot,
  sectionReplaceRegex,
} from "./knowledge-network-slot-render";
import {
  STRUCTURED_SLOT_PATCH_SCHEMA_VERSION,
  STRUCTURED_SLOT_PATCH_TYPE,
  type StructuredPatchOperation,
  type StructuredSlotPatchAny,
} from "./knowledge-network-structured-patch-types";

export {
  STRUCTURED_SLOT_PATCH_SCHEMA_VERSION,
  STRUCTURED_SLOT_PATCH_TYPE,
} from "./knowledge-network-structured-patch-types";
export type {
  StructuredSlotPatchAny,
  StructuredPatchOperation,
  SlotPayloadBySlot,
} from "./knowledge-network-structured-patch-types";
export { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";
export { rejectHtmlOrScriptInPayload, validateEvidenceSourceIdsAgainstAppendixA } from "./knowledge-network-slot-payload-validation";

export type StructuredSlotPatchExtractResult =
  | { ok: true; patch: StructuredSlotPatchAny; blocked?: false }
  | { ok: true; patch: StructuredSlotPatchAny; blocked: true; reason: string }
  | { ok: false; reason: string; notFound?: boolean };

export type StructuredSlotPatchApplyResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

const CANONICAL_SLOT_SET = new Set<string>(CANONICAL_KB_SLOTS);

const VALID_OPERATIONS = new Set<StructuredPatchOperation>([
  "replace-slot-data",
  "append-items",
  "update-fields",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractFencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const m of text.matchAll(re)) {
    const body = m[1]?.trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

function parseStructuredSlotPatchObject(raw: unknown): StructuredSlotPatchAny | null {
  if (!isRecord(raw)) return null;
  if (raw.type !== STRUCTURED_SLOT_PATCH_TYPE) return null;
  if (raw.schemaVersion !== STRUCTURED_SLOT_PATCH_SCHEMA_VERSION) return null;
  if (raw.mode !== "incremental") return null;
  const slot = String(raw.slot ?? "").trim();
  if (!CANONICAL_SLOT_SET.has(slot)) return null;
  const operation = String(raw.operation ?? "replace-slot-data").trim() as StructuredPatchOperation;
  if (!VALID_OPERATIONS.has(operation)) return null;
  if (!isRecord(raw.payload)) return null;

  const status = raw.status;
  if (
    status != null &&
    status !== "blocked" &&
    status !== "requires_full_update"
  ) {
    return null;
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : undefined;

  return {
    type: STRUCTURED_SLOT_PATCH_TYPE,
    schemaVersion: STRUCTURED_SLOT_PATCH_SCHEMA_VERSION,
    mode: "incremental",
    slot: slot as CanonicalKbSlot,
    operation,
    payload: raw.payload as StructuredSlotPatchAny["payload"],
    summary,
    status: status as StructuredSlotPatchAny["status"],
  };
}

export function validateStructuredSlotPatch(
  patch: StructuredSlotPatchAny,
): StructuredSlotPatchExtractResult {
  if (patch.status === "blocked" || patch.status === "requires_full_update") {
    return {
      ok: true,
      patch,
      blocked: true,
      reason:
        patch.summary?.trim() ||
        `structured patch 状态为 ${patch.status}，需整页更新，不合并 HTML`,
    };
  }

  const payloadErr = validateSlotPayload(patch.slot, patch.payload);
  if (payloadErr) {
    return { ok: false, reason: payloadErr };
  }

  return { ok: true, patch };
}

export function extractStructuredSlotPatchFromAnswer(
  answer: string,
): StructuredSlotPatchExtractResult {
  const blocks = extractFencedJsonBlocks(answer);
  let lastReason = "未找到 structured-slot-patch JSON 代码块";
  let foundType = false;

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      if (isRecord(parsed) && parsed.type === STRUCTURED_SLOT_PATCH_TYPE) {
        foundType = true;
      }
      const patch = parseStructuredSlotPatchObject(parsed);
      if (!patch) {
        if (isRecord(parsed) && parsed.type === STRUCTURED_SLOT_PATCH_TYPE) {
          lastReason = "structured-slot-patch JSON 字段不完整或无效";
        }
        continue;
      }
      const validated = validateStructuredSlotPatch(patch);
      if (validated.ok) return validated;
      lastReason = validated.reason;
    } catch {
      lastReason = "structured-slot-patch JSON 解析失败";
    }
  }

  return {
    ok: false,
    reason: lastReason,
    notFound: !foundType,
  };
}

export function renderStructuredSlotSection(
  slot: CanonicalKbSlot,
  payload: StructuredSlotPatchAny["payload"],
  previousHtml: string,
): string {
  const titleBlock = extractSectionTitleBlock(previousHtml, slot);
  const body = renderSlotPayloadByCanonicalSlot(slot, payload);
  return `<section class="block kb-panel" id="${slot}">${titleBlock}${body}</section>`;
}

export function applyStructuredSlotPatchToKnowledgeNetworkHtml(
  previousHtml: string,
  patch: StructuredSlotPatchAny,
): StructuredSlotPatchApplyResult {
  const prev = previousHtml.trim();
  if (!prev) {
    return { ok: false, error: "当前 KB HTML 为空，无法 structured patch" };
  }

  const validated = validateStructuredSlotPatch(patch);
  if (!validated.ok) {
    return { ok: false, error: validated.reason };
  }
  if (validated.blocked) {
    return { ok: false, error: validated.reason };
  }

  const evidenceErr = validateEvidenceSourceIdsAgainstAppendixA(prev, patch.payload);
  if (evidenceErr) {
    return { ok: false, error: evidenceErr };
  }

  const sectionRe = sectionReplaceRegex(patch.slot);
  if (!sectionRe.test(prev)) {
    return {
      ok: false,
      error: `当前 KB 中找不到 id="${patch.slot}" 的 section`,
    };
  }

  const sectionHtml = renderStructuredSlotSection(patch.slot, patch.payload, previousHtml);
  const merged = prev.replace(sectionRe, sectionHtml.trim());
  return { ok: true, html: merged };
}

export function validateMergedKnowledgeNetworkAfterStructuredPatch(
  mergedHtml: string,
  options: {
    previousHtml: string;
    touchesTimeline?: boolean;
  },
): KnHtmlValidationResult {
  return validateKnowledgeNetworkHtml(mergedHtml, {
    mode: "incremental",
    previousHtml: options.previousHtml,
    strict: true,
    touchesTimeline:
      options.touchesTimeline ??
      /id=["']timeline-milestones["']/i.test(mergedHtml),
  });
}

export function shouldUseStructuredSlotPatchMode(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: readonly CanonicalKbSlot[],
  options?: { generationMode?: KnGenerationMode },
): boolean {
  if (options?.generationMode === "fragment") return false;
  return mode === "incremental" && touchedSlots.length === 1;
}

export function structuredSlotPatchSummaryForJob(patch: StructuredSlotPatchAny): string {
  return patch.summary?.trim() || `structured patch：仅更新 ${patch.slot}`;
}

export function isStructuredPatchBlocked(
  result: StructuredSlotPatchExtractResult,
): result is { ok: true; patch: StructuredSlotPatchAny; blocked: true; reason: string } {
  return result.ok === true && "blocked" in result && result.blocked === true;
}
