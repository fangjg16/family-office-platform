import { collectEvidenceSourceIds, normalizeSourceId } from "./knowledge-network-slot-payload-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";
import type { StructuredKbSlots } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const FINAL_SOURCE_ID_RE = /^source-(?:[UA]-\d+)$/i;

function registryIdSet(registry: StructuredKbSource[]): Set<string> {
  return new Set(
    registry.map((s) => normalizeSourceId(s.id.replace(/^source-/, ""))),
  );
}

/** 将 proposalKey / 临时 sourceKey 映射为 Worker 分配的 source-{U|A}-N */
export function resolveProposalKeyToSourceId(
  ref: string,
  proposalKeyToId: Map<string, string>,
  registryIds: Set<string>,
): string | null {
  const norm = normalizeSourceId(ref);
  if (registryIds.has(norm)) return norm;

  const short = norm.replace(/^source-/, "");
  const mapped = proposalKeyToId.get(short) ?? proposalKeyToId.get(norm);
  if (mapped) return normalizeSourceId(mapped);

  if (short.startsWith("prop-") || short.startsWith("key-")) {
    const m = proposalKeyToId.get(short);
    if (m) return normalizeSourceId(m);
  }
  return null;
}

function rewriteValue(
  value: unknown,
  proposalKeyToId: Map<string, string>,
  registryIds: Set<string>,
): unknown {
  if (typeof value === "string") {
    return value.replace(/source-[A-Za-z0-9_-]+/gi, (match) => {
      const resolved = resolveProposalKeyToSourceId(match, proposalKeyToId, registryIds);
      return resolved ?? match;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string" && item.startsWith("source-")) {
        const resolved = resolveProposalKeyToSourceId(item, proposalKeyToId, registryIds);
        return resolved ?? item;
      }
      return rewriteValue(item, proposalKeyToId, registryIds);
    });
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        (k === "evidenceSourceIds" || k === "evidenceRefs") &&
        Array.isArray(v)
      ) {
        out[k] = v.map((id) => {
          if (typeof id !== "string") return id;
          const resolved = resolveProposalKeyToSourceId(id, proposalKeyToId, registryIds);
          return resolved ?? id;
        });
      } else {
        out[k] = rewriteValue(v, proposalKeyToId, registryIds);
      }
    }
    return out;
  }
  return value;
}

export function resolveEvidenceSourceRefsInSlots(
  slots: StructuredKbSlots,
  registry: StructuredKbSource[],
  proposalKeyToId: Map<string, string>,
): { slots: StructuredKbSlots; unresolved: string[] } {
  const registryIds = registryIdSet(registry);
  const unresolved = new Set<string>();
  const out = {} as StructuredKbSlots;

  for (const slot of CANONICAL_KB_SLOTS) {
    const payload = slots[slot as keyof SlotPayloadBySlot];
    if (!payload) continue;
    const rewritten = rewriteValue(payload, proposalKeyToId, registryIds) as SlotPayloadBySlot[typeof slot];
    out[slot as keyof StructuredKbSlots] = rewritten;
    for (const ref of collectEvidenceSourceIds(rewritten)) {
      if (!registryIds.has(ref) && !FINAL_SOURCE_ID_RE.test(ref)) {
        unresolved.add(ref);
      }
      if (FINAL_SOURCE_ID_RE.test(ref) && !registryIds.has(ref)) {
        unresolved.add(ref);
      }
    }
  }

  return { slots: out, unresolved: [...unresolved] };
}

/** batch 不得自行编造最终 Appendix id（U-N / A-N 未在 registry） */
export function rejectInventedFinalSourceIds(
  proposals: { id?: string; sourceKey?: string; title: string }[],
  registry: StructuredKbSource[],
): string | null {
  const registryShort = new Set(registry.map((s) => s.id.replace(/^source-/, "")));
  for (const p of proposals) {
    const id = (p.id ?? "").trim().replace(/^source-/, "");
    if (!id) continue;
    if (/^[UA]-\d+$/i.test(id) && !registryShort.has(id)) {
      return `sourceProposals 不得自行指定最终 id ${id}；请用 sourceKey，由 Worker 分配 Appendix A id`;
    }
  }
  return null;
}
