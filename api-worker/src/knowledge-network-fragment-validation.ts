import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import {
  normalizeFragmentSectionHtml,
  validateFragmentSectionTitle,
  validateSlotComponentMarkers,
} from "./knowledge-network-fragment-normalize";
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

/** L3：section 去掉标签后最小有效文本长度 */
export const KB_FRAGMENT_MIN_TEXT_CHARS = 48;

const RICH_CONTENT_RE =
  /<table\b|<ul\b|<ol\b|class=["'][^"']*gap|class=["'][^"']*oq-|class=["'][^"']*missing|class=["'][^"']*glossary-row|journey-wrap|scenario-cards|valuation-box/i;

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function validateL3Content(html: string): string | null {
  const plain = stripHtmlToPlainText(html);
  if (plain.length >= KB_FRAGMENT_MIN_TEXT_CHARS) return null;
  if (RICH_CONTENT_RE.test(html)) return null;
  return `section 内容过薄（纯文本 ${plain.length} 字符）`;
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

export function validateCanonicalSlotFragment(
  slot: CanonicalKbSlot,
  sectionHtml: string,
  registry?: KbFragmentRegistryContext,
): KbFragmentValidationResult {
  const normalized = normalizeFragmentSectionHtml(slot, sectionHtml.trim());
  const html = normalized.trim();
  if (!html) {
    return { ok: false, slot, reason: "fragment 为空", level: "L1" };
  }

  const envelopeErr = validateSectionEnvelope(slot, html);
  if (envelopeErr) {
    return { ok: false, slot, reason: envelopeErr, level: "L1" };
  }

  const titleErr = validateFragmentSectionTitle(slot, html);
  if (titleErr) {
    return { ok: false, slot, reason: titleErr, level: "L1" };
  }

  const componentErr = validateSlotComponentMarkers(slot, html);
  if (componentErr) {
    return { ok: false, slot, reason: componentErr, level: "L1" };
  }

  if (registry) {
    const citeErr = validateL2Citations(html, registry);
    if (citeErr) {
      return { ok: false, slot, reason: citeErr, level: "L2" };
    }
  }

  const contentErr = validateL3Content(html);
  if (contentErr) {
    return { ok: false, slot, reason: contentErr, level: "L3" };
  }

  return { ok: true, slot, html };
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

  const contentErr = validateL3Content(html);
  if (contentErr) {
    return { ok: false, slot, reason: contentErr, level: "L3" };
  }

  return { ok: true, slot, html };
}

export function buildFragmentRegistryContext(
  sources: { id: string }[],
): KbFragmentRegistryContext {
  const knownSourceIds = new Set<string>();
  for (const s of sources) {
    const id = s.id.trim();
    if (!id) continue;
    knownSourceIds.add(id);
    knownSourceIds.add(id.replace(/^source-/, ""));
    knownSourceIds.add(id.startsWith("source-") ? id : `source-${id}`);
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
