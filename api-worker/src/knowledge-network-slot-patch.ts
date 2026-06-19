import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  CANONICAL_KB_SLOTS,
  type KnHtmlValidationResult,
  validateKnowledgeNetworkHtml,
  extractAppendixASourceIdSet,
  validateAppendixASourceIdUniqueness,
} from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

export const SLOT_HTML_PATCH_TYPE = "slot-html-patch" as const;
export const SLOT_HTML_PATCH_SCHEMA_VERSION = "2.91" as const;

export type SlotHtmlPatchAppendixUpdates = {
  sourceIndexHtml?: string | null;
  glossaryHtml?: string | null;
  dataDictionaryHtml?: string | null;
  versionLedgerRowHtml?: string | null;
};

export type SlotHtmlPatch = {
  type: typeof SLOT_HTML_PATCH_TYPE;
  schemaVersion: typeof SLOT_HTML_PATCH_SCHEMA_VERSION;
  mode: "incremental";
  slot: CanonicalKbSlot;
  replace: "section";
  sectionHtml: string;
  appendixUpdates?: SlotHtmlPatchAppendixUpdates | null;
  summary?: string;
};

export type SlotHtmlPatchExtractResult =
  | { ok: true; patch: SlotHtmlPatch }
  | { ok: false; reason: string };

export type SlotHtmlPatchApplyResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

const CANONICAL_SLOT_SET = new Set<string>(CANONICAL_KB_SLOTS);

const FORBIDDEN_PATCH_PATTERNS: ReadonlyArray<{ re: RegExp; reason: string }> = [
  { re: /<!DOCTYPE/i, reason: "patch 含 <!DOCTYPE>" },
  { re: /<html[\s>]/i, reason: "patch 含 <html>" },
  { re: /<body[\s>]/i, reason: "patch 含 <body>" },
  { re: /<!--\s*KB-CONFIG/i, reason: "patch 含 KB-CONFIG" },
  { re: /<nav\s+class=["']kb-nav["']/i, reason: "patch 含 kb-nav" },
  { re: /\bkb-shell\b/i, reason: "patch 含 kb-shell" },
  { re: /<script\b/i, reason: "patch 含 <script>" },
];

const SOURCE_CITATION_RE = /#(source-[A-Za-z0-9_-]+)/g;

/** 从 HTML 片段提取 #source-* citation anchor（不含附录 A 定义行本身的 id） */
export function extractSourceCitationIdsFromHtml(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(SOURCE_CITATION_RE)) {
    if (m[1]) ids.add(m[1]);
  }
  return ids;
}

/** 从整页 KB 的 Appendix A 提取已存在的 source id（唯一集合；duplicate 须另查） */
export function extractAppendixASourceIds(html: string): Set<string> {
  return extractAppendixASourceIdSet(html);
}

function validateAppendixUpdatesFirstVersion(
  updates: SlotHtmlPatchAppendixUpdates | null | undefined,
): string | null {
  if (!updates) return null;
  if (updates.sourceIndexHtml?.trim()) {
    return "slot patch 不支持 sourceIndexHtml；新增来源索引请走整页 HTML fallback";
  }
  if (updates.glossaryHtml?.trim()) {
    return "slot patch 不支持 glossaryHtml";
  }
  if (updates.dataDictionaryHtml?.trim()) {
    return "slot patch 不支持 dataDictionaryHtml";
  }
  return null;
}

/** 校验 patch 引用的 #source-* 均存在于当前 KB Appendix A */
export function validateSlotPatchSourceCitations(
  previousHtml: string,
  patch: SlotHtmlPatch,
): SlotHtmlPatchExtractResult {
  const dupErr = validateAppendixASourceIdUniqueness(previousHtml);
  if (dupErr) {
    return { ok: false, reason: dupErr };
  }

  const existing = extractAppendixASourceIds(previousHtml);
  const cited = extractSourceCitationIdsFromHtml(patch.sectionHtml);
  const rowHtml = patch.appendixUpdates?.versionLedgerRowHtml?.trim() ?? "";
  for (const id of extractSourceCitationIdsFromHtml(rowHtml)) {
    cited.add(id);
  }

  const unknown = [...cited].filter((id) => !existing.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      reason:
        `sectionHtml 引用未知来源 ${unknown.join(", ")}；` +
        "当前 Appendix A 无对应 id，请走整页 HTML fallback",
    };
  }
  return { ok: true, patch };
}

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

function parseSlotHtmlPatchObject(raw: unknown): SlotHtmlPatch | null {
  if (!isRecord(raw)) return null;
  if (raw.type !== SLOT_HTML_PATCH_TYPE) return null;
  if (raw.schemaVersion !== SLOT_HTML_PATCH_SCHEMA_VERSION) return null;
  if (raw.mode !== "incremental") return null;
  if (raw.replace !== "section") return null;
  const slot = String(raw.slot ?? "").trim();
  if (!CANONICAL_SLOT_SET.has(slot)) return null;
  const sectionHtml = String(raw.sectionHtml ?? "").trim();
  if (!sectionHtml) return null;

  let appendixUpdates: SlotHtmlPatchAppendixUpdates | null = null;
  if (raw.appendixUpdates != null) {
    if (!isRecord(raw.appendixUpdates)) return null;
    appendixUpdates = {
      sourceIndexHtml: raw.appendixUpdates.sourceIndexHtml as string | null | undefined,
      glossaryHtml: raw.appendixUpdates.glossaryHtml as string | null | undefined,
      dataDictionaryHtml: raw.appendixUpdates.dataDictionaryHtml as string | null | undefined,
      versionLedgerRowHtml: raw.appendixUpdates.versionLedgerRowHtml as
        | string
        | null
        | undefined,
    };
  }

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : undefined;

  return {
    type: SLOT_HTML_PATCH_TYPE,
    schemaVersion: SLOT_HTML_PATCH_SCHEMA_VERSION,
    mode: "incremental",
    slot: slot as CanonicalKbSlot,
    replace: "section",
    sectionHtml,
    appendixUpdates,
    summary,
  };
}

export function validateSlotHtmlPatch(patch: SlotHtmlPatch): SlotHtmlPatchExtractResult {
  for (const { re, reason } of FORBIDDEN_PATCH_PATTERNS) {
    if (re.test(patch.sectionHtml)) {
      return { ok: false, reason };
    }
  }

  const sectionIdRe = new RegExp(
    `<section[^>]*\\bid=["']${patch.slot}["']`,
    "i",
  );
  if (!sectionIdRe.test(patch.sectionHtml)) {
    return {
      ok: false,
      reason: `sectionHtml 缺少 id="${patch.slot}" 的 <section>`,
    };
  }
  if (!/<\/section>\s*$/i.test(patch.sectionHtml.trim())) {
    return { ok: false, reason: "sectionHtml 须为完整 <section>…</section>" };
  }

  const rowHtml = patch.appendixUpdates?.versionLedgerRowHtml?.trim();
  if (rowHtml) {
    if (!/^<tr\b/i.test(rowHtml) || !/<\/tr>\s*$/i.test(rowHtml)) {
      return { ok: false, reason: "versionLedgerRowHtml 须为完整 <tr>…</tr>" };
    }
    for (const { re, reason } of FORBIDDEN_PATCH_PATTERNS) {
      if (re.test(rowHtml)) {
        return { ok: false, reason: `versionLedgerRowHtml ${reason}` };
      }
    }
  }

  const appendixError = validateAppendixUpdatesFirstVersion(patch.appendixUpdates);
  if (appendixError) {
    return { ok: false, reason: appendixError };
  }

  return { ok: true, patch };
}

/** 从 Hermes answer 提取 slot-html-patch（优先 json fenced block） */
export function extractSlotHtmlPatchFromAnswer(
  answer: string,
): SlotHtmlPatchExtractResult {
  const blocks = extractFencedJsonBlocks(answer);
  let lastReason = "未找到 slot-html-patch JSON 代码块";

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const patch = parseSlotHtmlPatchObject(parsed);
      if (!patch) continue;
      const validated = validateSlotHtmlPatch(patch);
      if (validated.ok) return validated;
      lastReason = validated.reason;
    } catch {
      lastReason = "slot-html-patch JSON 解析失败";
    }
  }

  return { ok: false, reason: lastReason };
}

function sectionReplaceRegex(slot: string): RegExp {
  return new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>[\\s\\S]*?<\\/section>`,
    "i",
  );
}

function appendVersionLedgerRowHtml(html: string, rowHtml: string): string {
  const tbodyRe =
    /(<section[^>]*\bid=["']version-ledger["'][^>]*>[\s\S]*?<table[^>]*>[\s\S]*?<tbody>)([\s\S]*?)(<\/tbody>)/i;
  if (!tbodyRe.test(html)) {
    return html;
  }
  return html.replace(tbodyRe, `$1$2${rowHtml}$3`);
}

/** 将 slot patch 合并进当前 KB HTML（不修改 KB-CONFIG / nav） */
export function applySlotHtmlPatchToKnowledgeNetworkHtml(
  previousHtml: string,
  patch: SlotHtmlPatch,
): SlotHtmlPatchApplyResult {
  const prev = previousHtml.trim();
  if (!prev) {
    return { ok: false, error: "当前 KB HTML 为空，无法 slot patch" };
  }

  const validated = validateSlotHtmlPatch(patch);
  if (!validated.ok) {
    return { ok: false, error: validated.reason };
  }

  const citationCheck = validateSlotPatchSourceCitations(prev, patch);
  if (!citationCheck.ok) {
    return { ok: false, error: citationCheck.reason };
  }

  const sectionRe = sectionReplaceRegex(patch.slot);
  if (!sectionRe.test(prev)) {
    return {
      ok: false,
      error: `当前 KB 中找不到 id="${patch.slot}" 的 section`,
    };
  }

  let merged = prev.replace(sectionRe, patch.sectionHtml.trim());

  const rowHtml = patch.appendixUpdates?.versionLedgerRowHtml?.trim();
  if (rowHtml) {
    const before = merged;
    merged = appendVersionLedgerRowHtml(merged, rowHtml);
    if (merged === before) {
      return {
        ok: false,
        error: "version-ledger 缺少 <tbody>，无法 append versionLedgerRowHtml",
      };
    }
  }

  return { ok: true, html: merged };
}

export function validateMergedKnowledgeNetworkAfterSlotPatch(
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

/** incremental 且用户仅点名 1 个 slot 时启用 slot patch 交付 */
export function shouldUseSlotHtmlPatchMode(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: readonly CanonicalKbSlot[],
): boolean {
  return mode === "incremental" && touchedSlots.length === 1;
}

export function slotHtmlPatchSummaryForJob(patch: SlotHtmlPatch): string {
  return (
    patch.summary?.trim() ||
    `slot patch：仅更新 ${patch.slot}`
  );
}
