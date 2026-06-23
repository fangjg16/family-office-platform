import { isGapMarkedRow, isRecord } from "./knowledge-network-coverage-target";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  computeSlotEvidenceMaturity,
  scoreSlotEvidenceMaturity,
  type SlotEvidenceMaturity,
} from "./knowledge-network-slot-evidence-maturity";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";

export type SlotContentMode = "evidence-backed" | "gap-first" | "stub";

export type SlotMaturitySummaryRow = {
  slot: CanonicalKbSlot;
  mode: SlotContentMode;
  evidenceScore: number;
  capReason?: string;
};

function isEmptyPayload(payload: unknown): boolean {
  if (payload == null || !isRecord(payload)) return true;
  try {
    const blob = JSON.stringify(payload).replace(/\s/g, "");
    return blob.length < 12 || blob === "{}";
  } catch {
    return true;
  }
}

function countGapRows(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (isRecord(item) && isGapMarkedRow(item)) n += 1;
        else walk(item);
      }
    } else if (isRecord(v)) {
      for (const val of Object.values(v)) walk(val);
    }
  };
  walk(payload);
  return n;
}

export function classifySlotContentMode(
  slot: CanonicalKbSlot,
  payload: unknown,
  evidence: SlotEvidenceMaturity,
): SlotContentMode {
  if (isEmptyPayload(payload)) return "stub";
  const gaps = countGapRows(payload);
  const gapFirstSlots: CanonicalKbSlot[] = [
    "legal-ownership",
    "regulatory-compliance",
    "comps-benchmark",
    "valuation-returns",
    "diligence-gaps",
  ];
  if (gaps >= 2 || (gapFirstSlots.includes(slot) && gaps >= 1)) {
    return "gap-first";
  }
  if (evidence.score >= 20 && !evidence.capApplied) return "evidence-backed";
  if (evidence.score >= 15) return "evidence-backed";
  return gaps > 0 ? "gap-first" : "stub";
}

export function buildSlotMaturitySummaryRows(data: StructuredKbData): SlotMaturitySummaryRow[] {
  return CANONICAL_KB_SLOTS.map((slot) => {
    const evidence = scoreSlotEvidenceMaturity(slot, data);
    const payload = data.slots[slot as keyof typeof data.slots];
    return {
      slot,
      mode: classifySlotContentMode(slot, payload, evidence),
      evidenceScore: evidence.score,
      capReason: evidence.capApplied,
    };
  });
}

const MODE_LABEL: Record<SlotContentMode, string> = {
  "evidence-backed": "evidence-backed",
  "gap-first": "gap-first",
  stub: "stub",
};

export function buildSlotMaturitySummaryText(data: StructuredKbData): string {
  const rows = buildSlotMaturitySummaryRows(data);
  const factorA = computeSlotEvidenceMaturity(data);
  const lines = [
    "**Slot Evidence Maturity 摘要**（v2.93 · 非 publish gate）",
    `Factor A（13-slot 均值）：**${factorA.score}%**`,
    "",
    "| Slot | 模式 | Evidence | Cap |",
    "| --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.slot} | ${MODE_LABEL[r.mode]} | ${r.evidenceScore}% | ${r.capReason ?? "—"} |`,
    );
  }
  return lines.join("\n");
}
