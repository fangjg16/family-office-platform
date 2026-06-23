import { adaptStructuredKbDataFromCodexKeys } from "./knowledge-network-codex-payload-adapter";
import { applyDeterministicMaturity } from "./knowledge-network-deterministic-maturity";
import {
  buildStructuredKbRepairMessage,
  validateFullStructuredKbQuality,
  type FullKbQualityResult,
} from "./knowledge-network-full-quality-contract";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import { renderFullStructuredKnowledgeNetwork } from "./knowledge-network-full-renderer";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  normalizeSourceId,
  rejectHtmlOrScriptInPayload,
  validateEvidenceSourceIdsAgainstSourceSet,
  validateSlotPayload,
} from "./knowledge-network-slot-payload-validation";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  STRUCTURED_KB_DATA_SCHEMA_VERSION,
  STRUCTURED_KB_DATA_TYPE,
  type StructuredKbData,
  type StructuredKbSource,
} from "./knowledge-network-structured-kb-data-types";

export function formatStructuredKbDataError(reason: string): string {
  if (/JSON 解析失败|Unexpected token|JSON parse failed/i.test(reason)) {
    return "JSON parse failed";
  }
  if (/缺少 canonical slot|missing 13 slot|slots 缺少/i.test(reason)) {
    return reason.startsWith("missing 13 slot") ? reason : `missing 13 slot: ${reason}`;
  }
  if (/重复 id|duplicate source id/i.test(reason)) {
    return reason.includes("duplicate source id")
      ? reason
      : `duplicate source id: ${reason.replace(/^sources 中重复 id：/u, "")}`;
  }
  if (/未知来源|unknown evidenceSourceIds|引用未知来源/i.test(reason)) {
    return reason.includes("unknown evidenceSourceIds")
      ? reason
      : `unknown evidenceSourceIds: ${reason.replace(/^payload 引用未知来源 /u, "")}`;
  }
  if (/validation failed/i.test(reason)) {
    return reason;
  }
  if (
    reason.includes("不能为空") ||
    reason.includes("须为") ||
    reason.includes("payload") ||
    reason.includes("禁止") ||
    reason.includes("timeline")
  ) {
    return `validation failed: ${reason}`;
  }
  return reason;
}

function missingCanonicalSlots(slots: Record<string, unknown>): string[] {
  return CANONICAL_KB_SLOTS.filter((slot) => !(slot in slots));
}

function diagnoseStructuredKbDataBlock(parsed: unknown): string | null {
  if (!isRecord(parsed)) return "JSON 字段无效";
  if (parsed.type !== STRUCTURED_KB_DATA_TYPE) return null;
  if (parsed.schemaVersion !== STRUCTURED_KB_DATA_SCHEMA_VERSION) {
    return `validation failed: schemaVersion 须为 ${STRUCTURED_KB_DATA_SCHEMA_VERSION}`;
  }
  const mode = String(parsed.mode ?? "").trim();
  if (mode !== "initial" && mode !== "full") {
    return "validation failed: mode 须为 initial 或 full";
  }
  if (!isRecord(parsed.slots)) {
    return "missing 13 slot: slots 须为对象";
  }
  const missing = missingCanonicalSlots(parsed.slots);
  if (missing.length > 0) {
    return `missing 13 slot: 缺少 ${missing.join(", ")}`;
  }
  if ("versionLedger" in parsed || "version-ledger" in parsed) {
    return "validation failed: 禁止输出 versionLedger（Appendix D 由 Worker 写入）";
  }
  return "validation failed: structured-kb-data JSON 字段不完整或无效";
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

const STRUCTURED_PAYLOAD_TYPES_FOR_DISPLAY = new Set([
  "structured-kb-data",
  "structured-slot-batch",
  "structured-slot-patch",
  "slot-html-patch",
]);

function detectStructuredPayloadTypeInFence(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed) && typeof parsed.type === "string") {
      const t = parsed.type.trim();
      if (STRUCTURED_PAYLOAD_TYPES_FOR_DISPLAY.has(t)) return t;
    }
  } catch {
    for (const t of STRUCTURED_PAYLOAD_TYPES_FOR_DISPLAY) {
      if (new RegExp(`["']type["']\\s*:\\s*["']${t}["']`).test(trimmed)) return t;
    }
  }
  return null;
}

function summaryFromStructuredPayloadBody(body: string): string | null {
  try {
    const parsed = JSON.parse(body.trim()) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.summary === "string" && parsed.summary.trim()) {
      return parsed.summary.trim();
    }
    const meta = parsed.meta;
    if (isRecord(meta) && typeof meta.autoSummary === "string" && meta.autoSummary.trim()) {
      return meta.autoSummary.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 聊天/UI 展示用：去掉 Hermes 交付的结构化 JSON 代码块，保留自然语言摘要。 */
export function stripStructuredKbPayloadFromDisplayAnswer(answer: string): string {
  const fallbackSummaries: string[] = [];
  let result = answer.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (fullMatch, body: string) => {
    if (!detectStructuredPayloadTypeInFence(String(body))) return fullMatch;
    const summary = summaryFromStructuredPayloadBody(String(body));
    if (summary) fallbackSummaries.push(summary);
    return "";
  });
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  if (result) return result;
  if (fallbackSummaries.length > 0) return fallbackSummaries[0]!;
  return "（结构化知识网络数据已处理，详见项目知识网络页面。）";
}

export type StructuredKbDataExtractResult =
  | { ok: true; data: StructuredKbData }
  | { ok: false; reason: string; notFound?: boolean };

export type StructuredKbDataValidateResult =
  | { ok: true; data: StructuredKbData; sourceIdSet: Set<string> }
  | { ok: false; reason: string };

export function normalizeStructuredKbSources(sources: StructuredKbSource[]): {
  normalized: StructuredKbSource[];
  sourceIdSet: Set<string>;
  error?: string;
} {
  const shortSeen = new Set<string>();
  const normalized: StructuredKbSource[] = [];
  const sourceIdSet = new Set<string>();

  for (const raw of sources) {
    const shortId = raw.id.trim().replace(/^source-/, "");
    if (!shortId) {
      return { normalized: [], sourceIdSet: new Set(), error: "sources 含空 id" };
    }
    if (shortSeen.has(shortId)) {
      return {
        normalized: [],
        sourceIdSet: new Set(),
        error: `duplicate source id: ${shortId}`,
      };
    }
    shortSeen.add(shortId);
    const anchorId = normalizeSourceId(shortId);
    sourceIdSet.add(anchorId);
    normalized.push({ ...raw, id: shortId });
  }

  return { normalized, sourceIdSet };
}

function parseStructuredKbDataObject(raw: unknown): StructuredKbData | null {
  if (!isRecord(raw)) return null;
  if (raw.type !== STRUCTURED_KB_DATA_TYPE) return null;
  if (raw.schemaVersion !== STRUCTURED_KB_DATA_SCHEMA_VERSION) return null;
  const mode = String(raw.mode ?? "").trim();
  if (mode !== "initial" && mode !== "full") return null;
  if (!isRecord(raw.config)) return null;
  if (!isRecord(raw.meta)) return null;
  if (!isRecord(raw.maturity)) return null;
  if (!isRecord(raw.slots)) return null;
  if (!Array.isArray(raw.sources)) return null;
  if ("versionLedger" in raw || "version-ledger" in raw) return null;

  const meta = raw.meta;
  if (typeof meta.title !== "string" || !meta.title.trim()) return null;
  if (typeof meta.autoSummary !== "string" || !meta.autoSummary.trim()) return null;

  const maturity = raw.maturity;
  if (typeof maturity.factorA !== "string") return null;
  if (typeof maturity.factorB !== "string") return null;
  if (typeof maturity.combined !== "string") return null;

  const slots = raw.slots as Record<string, unknown>;
  for (const slot of CANONICAL_KB_SLOTS) {
    if (!(slot in slots)) return null;
  }

  const sources: StructuredKbSource[] = [];
  for (const item of raw.sources) {
    if (!isRecord(item)) return null;
    if (typeof item.id !== "string" || !item.id.trim()) return null;
    if (typeof item.type !== "string" || !item.type.trim()) return null;
    if (typeof item.title !== "string" || !item.title.trim()) return null;
    sources.push({
      id: item.id.trim(),
      type: item.type.trim(),
      title: item.title.trim(),
      author: typeof item.author === "string" ? item.author.trim() : undefined,
      excerpt: typeof item.excerpt === "string" ? item.excerpt.trim() : undefined,
      usedIn: Array.isArray(item.usedIn)
        ? (item.usedIn.filter((s) => typeof s === "string") as CanonicalKbSlot[])
        : undefined,
    });
  }

  const terms = Array.isArray(raw.terms)
    ? raw.terms
        .filter(isRecord)
        .map((t) => ({
          term: String(t.term ?? "").trim(),
          definition: String(t.definition ?? "").trim(),
          context: typeof t.context === "string" ? t.context.trim() : undefined,
        }))
        .filter((t) => t.term && t.definition)
    : undefined;

  const dataDictionary = Array.isArray(raw.dataDictionary)
    ? raw.dataDictionary
        .filter(isRecord)
        .map((d) => ({
          field: String(d.field ?? "").trim(),
          definition: typeof d.definition === "string" ? d.definition.trim() : undefined,
          formula: typeof d.formula === "string" ? d.formula.trim() : undefined,
          sample: typeof d.sample === "string" ? d.sample.trim() : undefined,
          caveat: typeof d.caveat === "string" ? d.caveat.trim() : undefined,
        }))
        .filter((d) => d.field)
    : undefined;

  const summary =
    typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : undefined;

  return {
    type: STRUCTURED_KB_DATA_TYPE,
    schemaVersion: STRUCTURED_KB_DATA_SCHEMA_VERSION,
    mode: mode as "initial" | "full",
    summary,
    config: {
      displayOrder: Array.isArray(raw.config.displayOrder)
        ? (raw.config.displayOrder.filter((s) => typeof s === "string") as CanonicalKbSlot[])
        : undefined,
      projectType:
        typeof raw.config.projectType === "string" ? raw.config.projectType.trim() : undefined,
      renderingMode:
        raw.config.renderingMode === "bilingual" ? "bilingual" : "chinese-only",
      multiAsset: raw.config.multiAsset === true,
      configVersion:
        typeof raw.config.configVersion === "number" ? raw.config.configVersion : undefined,
    },
    meta: {
      title: meta.title.trim(),
      subtitle: typeof meta.subtitle === "string" ? meta.subtitle.trim() : undefined,
      mastheadSubtitle:
        typeof meta.mastheadSubtitle === "string" ? meta.mastheadSubtitle.trim() : undefined,
      lead: typeof meta.lead === "string" ? meta.lead.trim() : undefined,
      autoSummary: meta.autoSummary.trim(),
      navTitle: typeof meta.navTitle === "string" ? meta.navTitle.trim() : undefined,
      status: typeof meta.status === "string" ? meta.status.trim() : undefined,
      stage: typeof meta.stage === "string" ? meta.stage.trim() : undefined,
      footerBrand: typeof meta.footerBrand === "string" ? meta.footerBrand.trim() : undefined,
      version: typeof meta.version === "string" ? meta.version.trim() : undefined,
      date: typeof meta.date === "string" ? meta.date.trim() : undefined,
    },
    maturity: {
      factorA: maturity.factorA.trim(),
      factorANote:
        typeof maturity.factorANote === "string" ? maturity.factorANote.trim() : undefined,
      factorB: maturity.factorB.trim(),
      factorBNote:
        typeof maturity.factorBNote === "string" ? maturity.factorBNote.trim() : undefined,
      combined: maturity.combined.trim(),
      tier: typeof maturity.tier === "string" ? maturity.tier.trim() : undefined,
    },
    slots: slots as StructuredKbData["slots"],
    sources,
    terms,
    dataDictionary,
  };
}

export function validateStructuredKbData(data: StructuredKbData): StructuredKbDataValidateResult {
  if (data.sources.length === 0) {
    return { ok: false, reason: "sources 不能为空" };
  }

  const srcNorm = normalizeStructuredKbSources(data.sources);
  if (srcNorm.error) {
    const err = srcNorm.error;
    if (err.includes("重复 id")) {
      return { ok: false, reason: formatStructuredKbDataError(err) };
    }
    return { ok: false, reason: formatStructuredKbDataError(err) };
  }

  const topHtmlErr = rejectHtmlOrScriptInPayload(data);
  if (topHtmlErr) return { ok: false, reason: topHtmlErr };

  for (const slot of CANONICAL_KB_SLOTS) {
    const payload = data.slots[slot];
    const slotErr = validateSlotPayload(slot, payload);
    if (slotErr) {
      return { ok: false, reason: formatStructuredKbDataError(`${slot}: ${slotErr}`) };
    }

    const evidenceErr = validateEvidenceSourceIdsAgainstSourceSet(srcNorm.sourceIdSet, payload);
    if (evidenceErr) {
      return {
        ok: false,
        reason: formatStructuredKbDataError(
          `unknown evidenceSourceIds: ${evidenceErr.replace(/^payload 引用未知来源 /u, "")}`,
        ),
      };
    }
  }

  if (data.terms) {
    const termErr = rejectHtmlOrScriptInPayload(data.terms, "terms");
    if (termErr) return { ok: false, reason: termErr };
  }
  if (data.dataDictionary) {
    const dictErr = rejectHtmlOrScriptInPayload(data.dataDictionary, "dataDictionary");
    if (dictErr) return { ok: false, reason: dictErr };
  }

  return {
    ok: true,
    data: { ...data, sources: srcNorm.normalized },
    sourceIdSet: srcNorm.sourceIdSet,
  };
}

export function extractStructuredKbDataFromAnswer(answer: string): StructuredKbDataExtractResult {
  const blocks = extractFencedJsonBlocks(answer);
  let lastReason = "未找到 structured-kb-data JSON 代码块";
  let foundType = false;

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      if (isRecord(parsed) && parsed.type === STRUCTURED_KB_DATA_TYPE) {
        foundType = true;
      }
      const data = parseStructuredKbDataObject(parsed);
      if (!data) {
        if (isRecord(parsed) && parsed.type === STRUCTURED_KB_DATA_TYPE) {
          lastReason = diagnoseStructuredKbDataBlock(parsed) ?? lastReason;
        }
        continue;
      }
      const validated = validateStructuredKbData(data);
      if (validated.ok) return { ok: true, data: validated.data };
      lastReason = formatStructuredKbDataError(validated.reason);
    } catch {
      lastReason = "JSON parse failed";
    }
  }

  return { ok: false, reason: lastReason, notFound: !foundType };
}

export function extractStructuredKbDataFromJson(jsonText: string): StructuredKbDataExtractResult {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const data = parseStructuredKbDataObject(parsed);
    if (!data) {
      const reason =
        diagnoseStructuredKbDataBlock(parsed) ?? "structured-kb-data JSON 无效";
      return { ok: false, reason: formatStructuredKbDataError(reason) };
    }
    const validated = validateStructuredKbData(data);
    if (!validated.ok) return { ok: false, reason: formatStructuredKbDataError(validated.reason) };
    return { ok: true, data: validated.data };
  } catch {
    return { ok: false, reason: "JSON parse failed" };
  }
}

/** validate + deterministic maturity + render（不阻断 quality gate，供诊断/预览） */
export function renderStructuredKbDataToHtml(
  data: StructuredKbData,
  options?: { versionDisplay?: string },
): { ok: true; html: string; quality: FullKbQualityResult } | { ok: false; reason: string } {
  const validated = validateStructuredKbData(data);
  if (!validated.ok) return { ok: false, reason: validated.reason };
  const quality = validateFullStructuredKbQuality(validated.data);
  const prepared = applyDeterministicMaturity(validated.data);
  return {
    ok: true,
    html: renderFullStructuredKnowledgeNetwork(prepared, {
      structureCoverageDebug: quality.structureCoverage,
      versionDisplay: options?.versionDisplay,
      schemaVersion: validated.data.schemaVersion,
    }),
    quality,
  };
}

export type StructuredKbPublishGateResult =
  | { ok: true; quality: FullKbQualityResult }
  | { ok: false; repairNeeded: true; quality: FullKbQualityResult; message: string }
  | {
      ok: false;
      qualityBlocked: true;
      quality: FullKbQualityResult;
      message: string;
      previousScore: number;
      nextScore: number;
    };

/** full/initial 发布前：quality contract + 相对旧 KB 的 coverage 对比 */
export function evaluateStructuredKbPublishGate(
  data: StructuredKbData,
  previousHtml?: string | null,
): StructuredKbPublishGateResult {
  const normalized = adaptStructuredKbDataFromCodexKeys(data);
  const validated = validateStructuredKbData(normalized);
  if (!validated.ok) {
    return {
      ok: false,
      repairNeeded: true,
      quality: validateFullStructuredKbQuality(normalized),
      message: validated.reason,
    };
  }

  const quality = validateFullStructuredKbQuality(validated.data);
  if (!quality.hardGateOk) {
    return {
      ok: false,
      repairNeeded: true,
      quality,
      message: buildStructuredKbRepairMessage(quality),
    };
  }

  return { ok: true, quality };
}

export { validateFullStructuredKbQuality, buildStructuredKbRepairMessage } from "./knowledge-network-full-quality-contract";
export { computeDeterministicMaturity, applyDeterministicMaturity } from "./knowledge-network-deterministic-maturity";

export function shouldUseStructuredKbDataMode(mode: KnowledgeNetworkUpdateMode): boolean {
  return mode === "initial" || mode === "full";
}

export {
  STRUCTURED_KB_DATA_SCHEMA_VERSION,
  STRUCTURED_KB_DATA_TYPE,
} from "./knowledge-network-structured-kb-data-types";
