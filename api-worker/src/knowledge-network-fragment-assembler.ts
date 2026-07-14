import { extractSnapshotOverviewFallback } from "./knowledge-network-fragment-normalize";
import { listUndeliveredCanonicalFragments } from "./knowledge-network-fragment-merge";
import {
  renderWorkerGapStubAppendixDataDictionary,
  renderWorkerGapStubAppendixGlossary,
  renderWorkerGapStubFragment,
} from "./knowledge-network-fragment-stub";
import { normalizeSessionFragmentCitations } from "./knowledge-network-fragment-citations";
import { computeDeterministicMaturityFromFragments } from "./knowledge-network-fragment-maturity";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";
import {
  resolveStructuredKbDisplayOrder,
  renderKbTemplateWithSections,
} from "./knowledge-network-full-renderer";
import type {
  KbFragmentAssembleResult,
  KbFragmentAssemblyInput,
  KbFragmentRegistryContext,
  KbFragmentValidationResult,
} from "./knowledge-network-fragment-types";
import { validateCanonicalSlotFragment } from "./knowledge-network-fragment-validation";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

export function joinCanonicalFragmentsInOrder(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
  displayOrder: readonly CanonicalKbSlot[],
): string {
  return displayOrder
    .map((slot) => fragments[slot]?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function listMissingCanonicalFragments(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
): CanonicalKbSlot[] {
  return CANONICAL_KB_SLOTS.filter((slot) => !fragments[slot]?.trim());
}

export function validateAllCanonicalFragments(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult[] {
  const results: KbFragmentValidationResult[] = [];
  for (const slot of CANONICAL_KB_SLOTS) {
    const html = fragments[slot];
    if (!html?.trim()) {
      results.push({ ok: false, slot, reason: `缺少 ${slot} fragment`, level: "L1" });
      continue;
    }
    results.push(validateCanonicalSlotFragment(slot, html, registry));
  }
  return results;
}

export function firstHardFragmentFailure(
  results: KbFragmentValidationResult[],
): KbFragmentValidationResult | null {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return null;
}

/** 将 13 slot fragment + 附录 B/C 组装为完整 KB HTML */
export function assembleKbFromFragments(
  input: KbFragmentAssemblyInput,
  options?: { versionDisplay?: string; schemaVersion?: string },
): KbFragmentAssembleResult {
  const missingSlots = listMissingCanonicalFragments(input.fragments);
  if (missingSlots.length > 0) {
    return {
      ok: false,
      error: `assemble 失败：缺少 slot fragment（${missingSlots.join(", ")}）`,
      missingSlots,
    };
  }

  const appendixFragments = input.appendixFragments ?? {};
  if (!appendixFragments.glossary?.trim()) {
    return { ok: false, error: "assemble 失败：缺少 glossary appendix fragment" };
  }
  if (!appendixFragments["data-dictionary"]?.trim()) {
    return { ok: false, error: "assemble 失败：缺少 data-dictionary appendix fragment" };
  }

  const shellData: StructuredKbData = {
    type: "structured-kb-data",
    schemaVersion: input.shell.schemaVersion ?? "2.91",
    mode: input.shell.mode ?? "full",
    summary: input.shell.summary ?? "fragment-assembled KB",
    config: input.shell.config,
    meta: input.shell.meta,
    maturity: input.shell.maturity,
    slots: {} as StructuredKbData["slots"],
    sources: input.shell.sources ?? [],
  };

  const normalizedFragments = normalizeSessionFragmentCitations(input.fragments);
  const displayOrder = resolveStructuredKbDisplayOrder(shellData);
  const mainSectionsHtml = joinCanonicalFragmentsInOrder(normalizedFragments, displayOrder);

  const html = renderKbTemplateWithSections(
    shellData,
    {
      mainSectionsHtml,
      appendixBHtml: appendixFragments.glossary,
      appendixCHtml: appendixFragments["data-dictionary"],
      kbConfigNote: "fragment-full | Worker assemble",
    },
    options,
  );

  return { ok: true, html, missingSlots: [] };
}

export type PrepareFragmentsResult = {
  fragments: Partial<Record<CanonicalKbSlot, string>>;
  appendixFragments: Partial<Record<"glossary" | "data-dictionary", string>>;
  undeliveredSlots: CanonicalKbSlot[];
  workerStubSlots: CanonicalKbSlot[];
  workerStubAppendix: ("glossary" | "data-dictionary")[];
};

/** D-α：对 undelivered slot 注入 Worker gap stub 后再 assemble */
export function prepareSessionFragmentsForAssemble(
  session: KnSlotBatchSession,
): PrepareFragmentsResult {
  const fragments: Partial<Record<CanonicalKbSlot, string>> = {
    ...(session.fragments ?? {}),
  };
  const appendixFragments = { ...(session.appendixFragments ?? {}) };
  const undelivered = listUndeliveredCanonicalFragments(session);
  const workerStubSlots: CanonicalKbSlot[] = [];

  const workerStubAppendix: ("glossary" | "data-dictionary")[] = [];

  if (!session.fragmentDelivery) session.fragmentDelivery = {};

  for (const slot of undelivered) {
    fragments[slot] = renderWorkerGapStubFragment(slot, {
      projectTitle: session.projectTitle,
    });
    workerStubSlots.push(slot);
    session.fragmentDelivery[slot] = { delivery: "worker-stub" };
  }

  if (!appendixFragments.glossary?.trim()) {
    appendixFragments.glossary = renderWorkerGapStubAppendixGlossary();
    workerStubAppendix.push("glossary");
    session.fragmentDelivery.glossary = { delivery: "worker-stub" };
  }
  if (!appendixFragments["data-dictionary"]?.trim()) {
    appendixFragments["data-dictionary"] = renderWorkerGapStubAppendixDataDictionary();
    workerStubAppendix.push("data-dictionary");
    session.fragmentDelivery["data-dictionary"] = { delivery: "worker-stub" };
  }

  session.fragments = fragments;
  session.appendixFragments = appendixFragments;
  session.workerStubSlots = workerStubSlots;
  session.workerStubAppendix = workerStubAppendix;

  return {
    fragments,
    appendixFragments,
    undeliveredSlots: undelivered,
    workerStubSlots,
    workerStubAppendix,
  };
}

export function assembleKbFromFragmentSession(
  session: KnSlotBatchSession,
  options?: { versionDisplay?: string; applyWorkerStubs?: boolean },
): KbFragmentAssembleResult {
  if (options?.applyWorkerStubs !== false) {
    prepareSessionFragmentsForAssemble(session);
  }

  const sources = session.sourceRegistry ?? session.shell.sources ?? [];
  const computed = computeDeterministicMaturityFromFragments(
    session.fragments ?? {},
    sources,
  );
  const maturity = {
    factorA: computed.factorADisplay,
    factorB: computed.factorBDisplay,
    combined: computed.combinedDisplay,
    tier: computed.tier,
    factorANote: computed.factorANote,
    factorBNote: computed.factorBNote,
  };
  session.shell.maturity = maturity;

  const snapshotFallback = extractSnapshotOverviewFallback(
    session.fragments?.snapshot ?? "",
  );
  const autoSummary =
    session.shell.meta?.autoSummary?.trim() ||
    snapshotFallback.autoSummary ||
    "";
  const lead =
    session.shell.meta?.lead?.trim() || snapshotFallback.lead || "";

  return assembleKbFromFragments(
    {
      shell: {
        mode: session.mode,
        schemaVersion: "2.91",
        summary:
          session.shell.summary ??
          session.batchSummaries.filter(Boolean).join(" ") ??
          `fragment-batched ${session.mode} KB`,
        config: session.shell.config ?? {
          displayOrder: [...CANONICAL_KB_SLOTS],
          projectType: "general",
          renderingMode: "chinese-only",
        },
        meta: {
          ...session.shell.meta,
          title: session.shell.meta?.title ?? session.projectTitle,
          autoSummary,
          lead,
        },
        maturity,
        sources: session.sourceRegistry ?? session.shell.sources ?? [],
      },
      fragments: session.fragments ?? {},
      appendixFragments: session.appendixFragments,
    },
    options,
  );
}
