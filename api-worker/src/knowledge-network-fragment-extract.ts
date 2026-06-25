import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  isAppendixFragmentSlot,
  isCanonicalKbSlot,
} from "./knowledge-network-fragment-validation";
import type {
  KbFragmentBatchAppendixFragments,
  KbFragmentBatchExtractResult,
  KbFragmentBatchPayload,
} from "./knowledge-network-fragment-types";
import type { SourceProposalInput } from "./knowledge-network-source-proposals";
import {
  KB_FRAGMENT_BATCH_SCHEMA_VERSION,
  KB_FRAGMENT_BATCH_TYPE,
} from "./knowledge-network-fragment-types";

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseFragmentsInput(raw: unknown): Partial<Record<CanonicalKbSlot, string>> {
  const out: Partial<Record<CanonicalKbSlot, string>> = {};
  if (!isRecord(raw)) return out;
  for (const [key, val] of Object.entries(raw)) {
    if (!CANONICAL_SET.has(key)) continue;
    const html = String(val ?? "").trim();
    if (!html) continue;
    out[key as CanonicalKbSlot] = html;
  }
  return out;
}

function parseAppendixFragmentsInput(raw: unknown): KbFragmentBatchAppendixFragments | null {
  if (raw == null) return null;
  if (!isRecord(raw)) return null;
  const out: KbFragmentBatchAppendixFragments = {};
  for (const key of ["glossary", "data-dictionary"] as const) {
    const val = raw[key];
    if (val == null) {
      out[key] = null;
      continue;
    }
    const html = String(val).trim();
    out[key] = html || null;
  }
  return out;
}

function parseMaturityInput(raw: unknown): KbFragmentBatchPayload["maturity"] | undefined {
  if (!isRecord(raw)) return undefined;
  const factorA = raw.factorA != null ? String(raw.factorA).trim() : "";
  const factorB = raw.factorB != null ? String(raw.factorB).trim() : "";
  const combined = raw.combined != null ? String(raw.combined).trim() : "";
  if (!factorA && !factorB && !combined) return undefined;
  return {
    factorA: factorA || "—",
    factorB: factorB || "—",
    combined: combined || "—",
    tier:
      raw.tier === "Bare Lead" ||
      raw.tier === "Early" ||
      raw.tier === "Mid" ||
      raw.tier === "Mature"
        ? raw.tier
        : undefined,
    factorANote: raw.factorANote != null ? String(raw.factorANote) : undefined,
    factorBNote: raw.factorBNote != null ? String(raw.factorBNote) : undefined,
  };
}

function parseSourceProposals(raw: unknown): SourceProposalInput[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceProposalInput[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const title = String(item.title ?? "").trim();
    if (!title) continue;
    out.push({
      sourceKey: item.sourceKey != null ? String(item.sourceKey) : undefined,
      proposalKey: item.proposalKey != null ? String(item.proposalKey) : undefined,
      type: String(item.type ?? "引用").trim() || "引用",
      title,
      author: item.author != null ? String(item.author) : undefined,
      excerpt: item.excerpt != null ? String(item.excerpt) : undefined,
      documentId: item.documentId != null ? String(item.documentId) : undefined,
      usedIn: Array.isArray(item.usedIn)
        ? item.usedIn.filter((s): s is CanonicalKbSlot => isCanonicalKbSlot(String(s)))
        : undefined,
    });
  }
  return out;
}

function parseKbFragmentBatchObject(raw: unknown): KbFragmentBatchPayload | null {
  if (!isRecord(raw)) return null;
  if (raw.type !== KB_FRAGMENT_BATCH_TYPE) return null;
  if (raw.schemaVersion !== KB_FRAGMENT_BATCH_SCHEMA_VERSION) return null;

  const mode = String(raw.mode ?? "").trim() as KnowledgeNetworkUpdateMode;
  if (mode !== "initial" && mode !== "full" && mode !== "incremental" && mode !== "reorder") {
    return null;
  }

  const batchIndex = Number(raw.batchIndex);
  if (!Number.isInteger(batchIndex) || batchIndex < 0) return null;

  const fragments = parseFragmentsInput(raw.fragments);
  if (Object.keys(fragments).length === 0) {
    const appendixOnly = parseAppendixFragmentsInput(raw.appendixFragments);
    const hasAppendix =
      appendixOnly &&
      (appendixOnly.glossary?.trim() || appendixOnly["data-dictionary"]?.trim());
    if (!hasAppendix) return null;
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : undefined;

  return {
    type: KB_FRAGMENT_BATCH_TYPE,
    schemaVersion: KB_FRAGMENT_BATCH_SCHEMA_VERSION,
    mode,
    batchIndex,
    fragments,
    appendixFragments: parseAppendixFragmentsInput(raw.appendixFragments),
    sourceProposals: parseSourceProposals(raw.sourceProposals),
    summary,
    maturity: parseMaturityInput(raw.maturity),
  };
}

/** 从 Hermes answer 提取 kb-fragment-batch（优先 json fenced block） */
export function extractKbFragmentBatchFromAnswer(
  answer: string,
): KbFragmentBatchExtractResult {
  const blocks = extractFencedJsonBlocks(answer);
  let lastReason = "未找到 kb-fragment-batch JSON 代码块";

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const batch = parseKbFragmentBatchObject(parsed);
      if (!batch) continue;
      return { ok: true, batch };
    } catch {
      lastReason = "kb-fragment-batch JSON 解析失败";
    }
  }

  return { ok: false, reason: lastReason };
}

export function mergeKbFragmentBatchPayload(
  target: {
    fragments: Partial<Record<CanonicalKbSlot, string>>;
    appendixFragments: Partial<Record<"glossary" | "data-dictionary", string>>;
  },
  batch: KbFragmentBatchPayload,
): void {
  for (const [slot, html] of Object.entries(batch.fragments)) {
    if (!isCanonicalKbSlot(slot)) continue;
    if (!html?.trim()) continue;
    target.fragments[slot] = html.trim();
  }
  const appendix = batch.appendixFragments;
  if (appendix?.glossary?.trim()) {
    target.appendixFragments.glossary = appendix.glossary.trim();
  }
  if (appendix?.["data-dictionary"]?.trim()) {
    target.appendixFragments["data-dictionary"] = appendix["data-dictionary"].trim();
  }
}

export function listKbFragmentBatchSlots(batch: KbFragmentBatchPayload): CanonicalKbSlot[] {
  return Object.keys(batch.fragments).filter((s): s is CanonicalKbSlot =>
    isCanonicalKbSlot(s),
  );
}

export function listKbFragmentBatchAppendixSlots(
  batch: KbFragmentBatchPayload,
): ("glossary" | "data-dictionary")[] {
  const appendix = batch.appendixFragments;
  if (!appendix) return [];
  return (["glossary", "data-dictionary"] as const).filter((slot) => {
    const html = appendix[slot];
    return Boolean(html?.trim());
  });
}

export function validateKbFragmentBatchShape(batch: KbFragmentBatchPayload): string | null {
  for (const slot of listKbFragmentBatchSlots(batch)) {
    if (!isCanonicalKbSlot(slot)) return `未知 slot: ${slot}`;
  }
  if (batch.appendixFragments) {
    for (const key of Object.keys(batch.appendixFragments)) {
      if (!isAppendixFragmentSlot(key)) return `未知 appendix slot: ${key}`;
    }
  }
  return null;
}
