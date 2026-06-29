import { renderAppendixSourceIndex } from "./knowledge-network-full-renderer";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import {
  normalizeFragmentCitations,
  rewriteFragmentHtmlCitations,
} from "./knowledge-network-fragment-citations";
import type { KbFragmentBatchPayload } from "./knowledge-network-fragment-types";
import {
  buildFragmentRegistryContext,
  extractSectionHtmlById,
  isCanonicalKbSlot,
  validateCanonicalSlotFragment,
  validateExtensionSlotFragment,
} from "./knowledge-network-fragment-validation";
import type { KnGenerationMode } from "./knowledge-network-generation-mode";
import { buildSlotRegistryFromKnowledgeNetworkHtml } from "./knowledge-network-kb-config";
import type { KnSlotRegistry } from "./knowledge-network-kb-config";
import {
  validateKnowledgeNetworkHtml,
  type KnHtmlValidationResult,
} from "./knowledge-network-html-validation";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import type { CanonicalKbSlot, KnTouchedSlot } from "./knowledge-network-slot-aliases";
import {
  mergeSourceProposalsIntoRegistry,
  type SourceProposalInput,
} from "./knowledge-network-source-proposals";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";

export type KbFragmentIncrementalApplyResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

export type KbFragmentIncrementalExtractResult =
  | { ok: true; batch: KbFragmentBatchPayload; slot: KnTouchedSlot; sectionHtml: string }
  | { ok: false; skipped?: boolean; error: string };

function stripHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** 从当前 KB Appendix A 表解析来源（供 incremental sourceProposals 合并） */
export function parseStructuredKbSourcesFromAppendixA(html: string): StructuredKbSource[] {
  const section = extractSectionHtmlById(html, "source-index");
  if (!section) return [];

  const sources: StructuredKbSource[] = [];
  const rowRe =
    /<tr>\s*<td>[\s\S]*?<span[^>]*id=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>[\s\S]*?<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  for (const m of section.matchAll(rowRe)) {
    const id = stripHtmlText(m[1] ?? "").replace(/^source-/, "");
    const type = stripHtmlText(m[2] ?? "") || "引用";
    const title = stripHtmlText(m[3] ?? "");
    if (!id || !title) continue;
    const author = stripHtmlText(m[4] ?? "") || undefined;
    const excerpt = stripHtmlText(m[5] ?? "") || undefined;
    const usedInRaw = stripHtmlText(m[6] ?? "");
    const usedIn = usedInRaw
      ? (usedInRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean) as CanonicalKbSlot[])
      : undefined;
    sources.push({ id, type, title, author, excerpt, usedIn });
  }
  return sources;
}

function sectionReplaceRegex(slot: string): RegExp {
  return new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>[\\s\\S]*?<\\/section>`,
    "i",
  );
}

function replaceSectionHtml(html: string, slot: string, sectionHtml: string): string | null {
  const re = sectionReplaceRegex(slot);
  if (!re.test(html)) return null;
  return html.replace(re, sectionHtml.trim());
}

export function shouldUseKbFragmentIncrementalMode(
  generationMode: KnGenerationMode,
  knMode: KnowledgeNetworkUpdateMode,
  touchedSlots: readonly KnTouchedSlot[],
  registry?: KnSlotRegistry | null,
): boolean {
  if (generationMode !== "fragment" || knMode !== "incremental" || touchedSlots.length !== 1) {
    return false;
  }
  const slot = touchedSlots[0]!;
  if (isCanonicalKbSlot(slot)) return true;
  return Boolean(registry?.extensions.includes(slot));
}

export function extractKbFragmentIncrementalFromAnswer(
  answer: string,
  expectedSlot: KnTouchedSlot,
): KbFragmentIncrementalExtractResult {
  const extracted = extractKbFragmentBatchFromAnswer(answer);
  if (!extracted.ok) {
    return { ok: false, skipped: true, error: extracted.reason };
  }

  const batch = extracted.batch;
  if (batch.mode !== "incremental") {
    return {
      ok: false,
      error: `kb-fragment-batch.mode 须为 incremental（收到 ${batch.mode}）`,
    };
  }

  const slots = Object.keys(batch.fragments).filter(
    (k) => batch.fragments[k]?.trim(),
  );

  if (slots.length !== 1) {
    return {
      ok: false,
      error:
        slots.length === 0
          ? "incremental fragment 须含且仅含一个 slot 的 fragments"
          : `incremental fragment 一次只能更新一个 slot（收到 ${slots.join(", ")}）`,
    };
  }

  const slot = slots[0]!;
  if (slot !== expectedSlot) {
    return {
      ok: false,
      error: `fragments 仅可更新用户点名的 \`${expectedSlot}\`（收到 \`${slot}\`）`,
    };
  }

  const sectionHtml = batch.fragments[slot]!.trim();
  return { ok: true, batch, slot, sectionHtml };
}

export function applyKbFragmentIncrementalToKnowledgeNetworkHtml(
  previousHtml: string,
  batch: KbFragmentBatchPayload,
  slot: KnTouchedSlot,
  sectionHtml: string,
): KbFragmentIncrementalApplyResult {
  const prev = previousHtml.trim();
  if (!prev) {
    return { ok: false, error: "当前 KB HTML 为空，无法 fragment incremental" };
  }

  const baseRegistry = parseStructuredKbSourcesFromAppendixA(prev);
  const proposals: SourceProposalInput[] = (batch.sourceProposals ?? []).map((p) => ({
    sourceKey: p.sourceKey,
    proposalKey: p.proposalKey ?? p.sourceKey,
    type: p.type,
    title: p.title,
    author: p.author,
    excerpt: p.excerpt,
    usedIn: p.usedIn,
    documentId: p.documentId,
  }));

  const { registry, proposalKeyToId, added } = mergeSourceProposalsIntoRegistry(baseRegistry, [
    { batchIndex: 0, proposals },
  ]);

  const registryCtx = buildFragmentRegistryContext(registry, proposals);
  const validated = isCanonicalKbSlot(slot)
    ? validateCanonicalSlotFragment(slot, sectionHtml, registryCtx)
    : validateExtensionSlotFragment(slot, sectionHtml, registryCtx);
  if (!validated.ok) {
    return { ok: false, error: `${slot} (${validated.level}): ${validated.reason}` };
  }

  let mergedSection = validated.html;
  if (proposalKeyToId.size) {
    mergedSection = rewriteFragmentHtmlCitations(mergedSection, proposalKeyToId);
  }
  mergedSection = normalizeFragmentCitations(mergedSection);

  let merged = replaceSectionHtml(prev, slot, mergedSection);
  if (!merged) {
    return { ok: false, error: `当前 KB 中找不到 id="${slot}" 的 section` };
  }

  if (added > 0) {
    const nextSourceIndex = renderAppendixSourceIndex(registry);
    const withSources = replaceSectionHtml(merged, "source-index", nextSourceIndex);
    if (!withSources) {
      return { ok: false, error: "无法更新 Appendix A source-index" };
    }
    merged = withSources;
  }

  const appendix = batch.appendixFragments;
  if (appendix?.glossary?.trim()) {
    const next = replaceSectionHtml(merged, "glossary", appendix.glossary.trim());
    if (!next) {
      return { ok: false, error: "无法更新 Appendix B glossary" };
    }
    merged = next;
  }
  if (appendix?.["data-dictionary"]?.trim()) {
    const next = replaceSectionHtml(
      merged,
      "data-dictionary",
      appendix["data-dictionary"].trim(),
    );
    if (!next) {
      return { ok: false, error: "无法更新 Appendix C data-dictionary" };
    }
    merged = next;
  }

  return { ok: true, html: merged };
}

export function validateMergedKnowledgeNetworkAfterFragmentIncremental(
  mergedHtml: string,
  options: {
    previousHtml: string;
    slot: KnTouchedSlot;
    slotRegistry?: KnSlotRegistry | null;
  },
): KnHtmlValidationResult {
  const registry =
    options.slotRegistry ??
    buildSlotRegistryFromKnowledgeNetworkHtml(options.previousHtml);
  return validateKnowledgeNetworkHtml(mergedHtml, {
    mode: "incremental",
    previousHtml: options.previousHtml,
    strict: true,
    touchesTimeline: options.slot === "timeline-milestones",
    slotRegistry: registry.hasExtensions ? registry : undefined,
    strictOrphanCitations: false,
  });
}

export function kbFragmentIncrementalSummaryForJob(
  batch: KbFragmentBatchPayload,
  slot: KnTouchedSlot,
): string {
  return batch.summary?.trim() || `kb-fragment-batch incremental：仅更新 ${slot}`;
}
