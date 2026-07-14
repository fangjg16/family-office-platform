import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  extractSourceCitationIdsFromHtml,
} from "./knowledge-network-slot-patch";
import type {
  KbAppendixFragmentSlot,
  KbFragmentRegistryContext,
  KbFragmentValidationResult,
} from "./knowledge-network-fragment-types";

const CANONICAL_SLOT_SET = new Set<string>(CANONICAL_KB_SLOTS);
const APPENDIX_FRAGMENT_SLOTS = new Set<string>(["glossary", "data-dictionary"]);

export const KB_FRAGMENT_SHELL_FORBIDDEN: ReadonlyArray<{ re: RegExp; reason: string }> = [
  { re: /<!DOCTYPE/i, reason: "fragment 含 <!DOCTYPE>" },
  { re: /<html[\s>]/i, reason: "fragment 含 <html>" },
  { re: /<body[\s>]/i, reason: "fragment 含 <body>" },
  { re: /<!--\s*KB-CONFIG/i, reason: "fragment 含 KB-CONFIG" },
  { re: /<nav\s+class=["']kb-nav["']/i, reason: "fragment 含 kb-nav" },
  { re: /\bkb-shell\b/i, reason: "fragment 含 kb-shell" },
  { re: /<script\b/i, reason: "fragment 含 <script>" },
];

function normalizeRegistryId(id: string): string {
  const t = id.trim();
  return t.startsWith("source-") ? t.slice("source-".length) : t;
}

function validateShellForbidden(html: string): string | null {
  for (const { re, reason } of KB_FRAGMENT_SHELL_FORBIDDEN) {
    if (re.test(html)) return reason;
  }
  return null;
}

function validateSectionEnvelope(
  slot: string,
  html: string,
): string | null {
  const shellErr = validateShellForbidden(html);
  if (shellErr) return shellErr;

  const sectionIdRe = new RegExp(`<section[^>]*\\bid=["']${slot}["']`, "i");
  if (!sectionIdRe.test(html)) {
    return `sectionHtml 缺少 id="${slot}" 的 <section>`;
  }
  if (!/<\/section>\s*$/i.test(html.trim())) {
    return "sectionHtml 须为完整 <section>…</section>";
  }
  return null;
}

function validateL2Citations(
  html: string,
  registry: KbFragmentRegistryContext,
): string | null {
  const cited = extractSourceCitationIdsFromHtml(html);
  const unknown: string[] = [];
  for (const raw of cited) {
    const id = normalizeRegistryId(raw.replace(/^#/, ""));
    const withPrefix = `source-${id}`;
    const known =
      registry.knownSourceIds.has(id) ||
      registry.knownSourceIds.has(withPrefix) ||
      registry.knownSourceIds.has(raw.replace(/^#/, ""));
    if (!known) unknown.push(raw);
  }
  if (unknown.length > 0) {
    return `fragment 引用未知来源 ${unknown.join(", ")}`;
  }
  return null;
}

export function validateSlotFragment(
  slot: string,
  sectionHtml: string,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult {
  const html = sectionHtml.trim();
  if (!html) {
    return { ok: false, slot, reason: "fragment 为空", level: "L1" };
  }

  const envelopeErr = validateSectionEnvelope(slot, html);
  if (envelopeErr) {
    return { ok: false, slot, reason: envelopeErr, level: "L1" };
  }

  if (registry) {
    const citeErr = validateL2Citations(html, registry);
    if (citeErr) {
      return { ok: false, slot, reason: citeErr, level: "L2" };
    }
  }

  return { ok: true, slot, html };
}

export function validateExtensionSlotFragment(
  slot: string,
  sectionHtml: string,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult {
  return validateSlotFragment(slot, sectionHtml, registry);
}

export function validateCanonicalSlotFragment(
  slot: CanonicalKbSlot,
  sectionHtml: string,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult {
  return validateSlotFragment(slot, sectionHtml, registry);
}

export function validateAppendixFragment(
  slot: KbAppendixFragmentSlot,
  sectionHtml: string,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult {
  const html = sectionHtml.trim();
  if (!html) {
    return { ok: false, slot, reason: "appendix fragment 为空", level: "L1" };
  }

  const envelopeErr = validateSectionEnvelope(slot, html);
  if (envelopeErr) {
    return { ok: false, slot, reason: envelopeErr, level: "L1" };
  }

  if (registry) {
    const citeErr = validateL2Citations(html, registry);
    if (citeErr) {
      return { ok: false, slot, reason: citeErr, level: "L2" };
    }
  }

  return { ok: true, slot, html };
}

import type { SourceProposalInput } from "./knowledge-network-source-proposals";

export function buildFragmentRegistryContext(
  sources: { id: string }[],
  pendingProposals?: readonly SourceProposalInput[],
): KbFragmentRegistryContext {
  const knownSourceIds = new Set<string>();
  for (const s of sources) {
    const id = s.id.trim();
    if (!id) continue;
    knownSourceIds.add(id);
    knownSourceIds.add(id.replace(/^source-/, ""));
    knownSourceIds.add(id.startsWith("source-") ? id : `source-${id}`);
  }
  for (const p of pendingProposals ?? []) {
    for (const key of [p.sourceKey, p.proposalKey].filter(Boolean) as string[]) {
      const k = key.trim();
      knownSourceIds.add(k);
      knownSourceIds.add(k.replace(/^source-/, ""));
      knownSourceIds.add(k.startsWith("source-") ? k : `source-${k}`);
    }
  }
  return { knownSourceIds };
}

export function extractSectionHtmlById(html: string, slot: string): string | null {
  const re = new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>[\\s\\S]*?<\\/section>`,
    "i",
  );
  return html.match(re)?.[0] ?? null;
}

export function isCanonicalKbSlot(value: string): value is CanonicalKbSlot {
  return CANONICAL_SLOT_SET.has(value);
}

export function isAppendixFragmentSlot(value: string): value is KbAppendixFragmentSlot {
  return APPENDIX_FRAGMENT_SLOTS.has(value);
}
