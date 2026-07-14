import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import type { KbFragmentBatchPayload } from "./knowledge-network-fragment-types";
import {
  buildFragmentRegistryContext,
  validateAppendixFragment,
  validateCanonicalSlotFragment,
} from "./knowledge-network-fragment-validation";
import {
  KN_SLOT_BATCH_PLAN,
  type KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";
import type { SourceProposalInput } from "./knowledge-network-source-proposals";
import { rejectInventedFinalSourceIds } from "./knowledge-network-source-ref-resolve";
import { createInitialPublicSearchTelemetry } from "./knowledge-network-slot-batch-prep";

export type FragmentBatchMergeResult =
  | { ok: true }
  | { ok: false; error: string; failedSlots: CanonicalKbSlot[]; hardOnly: boolean };

const PUBLIC_SOURCE_TYPE_RE = /公开|第三方|政府|监管|审计|年报|market|public|tavily|web/i;

function proposalsFromFragmentBatch(batch: KbFragmentBatchPayload): SourceProposalInput[] {
  return (batch.sourceProposals ?? []).map((p) => ({
    sourceKey: p.sourceKey,
    proposalKey: p.proposalKey ?? p.sourceKey,
    type: p.type,
    title: p.title,
    author: p.author,
    excerpt: p.excerpt,
    usedIn: p.usedIn,
    documentId: p.documentId,
  }));
}

function recordPublicSearchFromProposals(
  session: KnSlotBatchSession,
  proposals: SourceProposalInput[],
  batchIndex: number,
): void {
  const publicOnes = proposals.filter((p) => PUBLIC_SOURCE_TYPE_RE.test(p.type ?? ""));
  if (publicOnes.length === 0) return;
  const tel =
    session.publicSearchTelemetry ?? createInitialPublicSearchTelemetry();
  tel.attempted = true;
  tel.succeeded = true;
  tel.sourcesAdded += publicOnes.length;
  tel.notes.push(
    `batch ${batchIndex}: +${publicOnes.length} public/third-party sourceProposals`,
  );
  session.publicSearchTelemetry = tel;
}

function setFragmentDelivery(
  session: KnSlotBatchSession,
  slot: CanonicalKbSlot | "glossary" | "data-dictionary",
  delivery: "delivered" | "gap-first" | "worker-stub",
  batchIndex: number,
): void {
  if (!session.fragmentDelivery) session.fragmentDelivery = {};
  session.fragmentDelivery[slot] = { delivery, batchIndex };
}

function isGapFirstHtml(html: string): boolean {
  return /class=["'][^"']*callout missing|class=["'][^"']*gap|缺乏资料|资料缺口|oq-group/i.test(
    html,
  );
}

export function mergeFragmentBatchIntoSession(
  session: KnSlotBatchSession,
  batchIndex: number,
  answer: string,
): FragmentBatchMergeResult {
  const extracted = extractKbFragmentBatchFromAnswer(answer);
  if (!extracted.ok) {
    return {
      ok: false,
      error: extracted.reason,
      failedSlots: [...KN_SLOT_BATCH_PLAN[batchIndex]!],
      hardOnly: true,
    };
  }

  const batch = extracted.batch;
  const parallel = session.parallelMode === true;
  const proposals = proposalsFromFragmentBatch(batch);
  const registry = buildFragmentRegistryContext(
    session.sourceRegistry ?? session.shell.sources ?? [],
    [...(session.pendingSourceProposals ?? []), ...proposals],
  );

  if (!parallel && batchIndex === 0) {
    if (batch.summary) session.shell.summary = batch.summary;
    if (batch.overviewMeta) {
      session.shell.meta = {
        title: session.shell.meta?.title ?? session.projectTitle,
        autoSummary: session.shell.meta?.autoSummary ?? "",
        ...session.shell.meta,
        ...(batch.overviewMeta.lead ? { lead: batch.overviewMeta.lead } : {}),
        ...(batch.overviewMeta.autoSummary
          ? { autoSummary: batch.overviewMeta.autoSummary }
          : {}),
      };
    }
    // maturity：忽略 Hermes 自评；assemble 时由 Worker 计算覆盖
  } else if (parallel) {
    const invented = rejectInventedFinalSourceIds(
      (batch.sourceProposals ?? []) as { id?: string; sourceKey?: string; title: string }[],
      session.sourceRegistry ?? [],
    );
    if (invented) {
      return { ok: false, error: invented, failedSlots: [], hardOnly: true };
    }
  }

  // 并行路径同样忽略 batch.maturity（Worker-only）

  if (parallel && batch.overviewMeta && batchIndex === 0) {
    session.shell.meta = {
      title: session.shell.meta?.title ?? session.projectTitle,
      autoSummary: session.shell.meta?.autoSummary ?? "",
      ...session.shell.meta,
      ...(batch.overviewMeta.lead ? { lead: batch.overviewMeta.lead } : {}),
      ...(batch.overviewMeta.autoSummary
        ? { autoSummary: batch.overviewMeta.autoSummary }
        : {}),
    };
  }

  if (proposals.length) {
    session.pendingSourceProposals = [...(session.pendingSourceProposals ?? []), ...proposals];
    recordPublicSearchFromProposals(session, proposals, batchIndex);
  }

  if (batch.summary?.trim()) {
    session.batchSummaries[batchIndex] = batch.summary.trim();
  }

  const hardFailedSlots: CanonicalKbSlot[] = [];
  const repairLines: string[] = [];
  const expectedSlots = [...(KN_SLOT_BATCH_PLAN[batchIndex] ?? [])];

  if (!session.fragments) session.fragments = {};
  if (!session.appendixFragments) session.appendixFragments = {};

  for (const [key, html] of Object.entries(batch.fragments)) {
    const slot = key as CanonicalKbSlot;
    if (!CANONICAL_KB_SLOTS.includes(slot)) continue;
    const sectionHtml = String(html ?? "").trim();
    if (!sectionHtml) continue;

    const validated = validateCanonicalSlotFragment(slot, sectionHtml, registry);
    if (!validated.ok) {
      hardFailedSlots.push(slot);
      repairLines.push(`${slot} (${validated.level}): ${validated.reason}`);
      continue;
    }

    session.fragments[slot] = validated.html;
    setFragmentDelivery(
      session,
      slot,
      isGapFirstHtml(validated.html) ? "gap-first" : "delivered",
      batchIndex,
    );
  }

  const appendix = batch.appendixFragments;
  if (appendix?.glossary?.trim()) {
    const v = validateAppendixFragment("glossary", appendix.glossary, registry);
    if (!v.ok) {
      repairLines.push(`glossary (${v.level}): ${v.reason}`);
      return {
        ok: false,
        error: repairLines.join("\n"),
        failedSlots: [...expectedSlots],
        hardOnly: true,
      };
    }
    session.appendixFragments.glossary = v.html;
    setFragmentDelivery(
      session,
      "glossary",
      isGapFirstHtml(v.html) ? "gap-first" : "delivered",
      batchIndex,
    );
  }
  if (appendix?.["data-dictionary"]?.trim()) {
    const v = validateAppendixFragment(
      "data-dictionary",
      appendix["data-dictionary"],
      registry,
    );
    if (!v.ok) {
      repairLines.push(`data-dictionary (${v.level}): ${v.reason}`);
      return {
        ok: false,
        error: repairLines.join("\n"),
        failedSlots: [...expectedSlots],
        hardOnly: true,
      };
    }
    session.appendixFragments["data-dictionary"] = v.html;
    setFragmentDelivery(
      session,
      "data-dictionary",
      isGapFirstHtml(v.html) ? "gap-first" : "delivered",
      batchIndex,
    );
  }

  for (const slot of expectedSlots) {
    if (!session.fragments[slot]?.trim()) {
      hardFailedSlots.push(slot);
      repairLines.push(`${slot}: 本批未交付 fragment`);
    }
  }

  if (hardFailedSlots.length) {
    return {
      ok: false,
      error:
        `批次 ${batchIndex + 1} fragment hard 问题：${[...new Set(hardFailedSlots)].join(", ")}` +
        (repairLines.length ? `\n${repairLines.join("\n")}` : ""),
      failedSlots: [...new Set(hardFailedSlots)],
      hardOnly: true,
    };
  }

  return { ok: true };
}

export function listUndeliveredCanonicalFragments(
  session: KnSlotBatchSession,
): CanonicalKbSlot[] {
  return CANONICAL_KB_SLOTS.filter((slot) => !session.fragments?.[slot]?.trim());
}
