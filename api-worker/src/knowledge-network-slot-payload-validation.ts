import {
  extractAppendixASourceIdSet,
  validateAppendixASourceIdUniqueness,
} from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type {
  TimelineMilestonesPayload,
  TimelineItem,
} from "./knowledge-network-structured-patch-types";

const HTML_IN_TEXT_RE = /<[a-z!/][\s\S]*?>/i;
const SCRIPT_IN_TEXT_RE = /\b<script\b|javascript:/i;

const INDUSTRY_TIMELINE_RE =
  /行业(动态|趋势|新闻|报告)|市场(趋势|新闻|动态)|研报|宏观|sector news|industry (trend|news|report)/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeSourceId(id: string): string {
  const t = id.trim();
  return t.startsWith("source-") ? t : `source-${t}`;
}

/** 遍历 payload 中所有字符串，拒绝 HTML / script */
export function rejectHtmlOrScriptInPayload(payload: unknown, path = "payload"): string | null {
  if (typeof payload === "string") {
    if (HTML_IN_TEXT_RE.test(payload)) {
      return `${path} 含 HTML 标签（Hermes 应只输出纯文本）`;
    }
    if (SCRIPT_IN_TEXT_RE.test(payload)) {
      return `${path} 含 script/javascript`;
    }
    return null;
  }
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i += 1) {
      const err = rejectHtmlOrScriptInPayload(payload[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (isRecord(payload)) {
    for (const [k, v] of Object.entries(payload)) {
      const err = rejectHtmlOrScriptInPayload(v, `${path}.${k}`);
      if (err) return err;
    }
  }
  return null;
}

export function collectEvidenceSourceIds(payload: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(payload)) {
    for (const item of payload) collectEvidenceSourceIds(item, out);
    return out;
  }
  if (isRecord(payload)) {
    if (Array.isArray(payload.evidenceSourceIds)) {
      for (const id of payload.evidenceSourceIds) {
        if (typeof id === "string" && id.trim()) out.add(normalizeSourceId(id));
      }
    }
    if (Array.isArray(payload.evidenceRefs)) {
      for (const id of payload.evidenceRefs) {
        if (typeof id === "string" && id.trim()) out.add(normalizeSourceId(id));
      }
    }
    for (const v of Object.values(payload)) collectEvidenceSourceIds(v, out);
  }
  return out;
}

/** incremental：evidenceSourceIds 必须存在于当前 Appendix A HTML */
export function validateEvidenceSourceIdsAgainstAppendixA(
  previousHtml: string,
  payload: unknown,
): string | null {
  const dupErr = validateAppendixASourceIdUniqueness(previousHtml);
  if (dupErr) return dupErr;

  const existing = extractAppendixASourceIdSet(previousHtml);
  return validateEvidenceSourceIdsAgainstSourceSet(existing, payload);
}

/** full structured：evidenceSourceIds 必须存在于 sources 归一化后的 id 集合 */
export function validateEvidenceSourceIdsAgainstSourceSet(
  sourceIdSet: Set<string>,
  payload: unknown,
): string | null {
  const cited = collectEvidenceSourceIds(payload);
  const unknown = [...cited].filter((id) => !sourceIdSet.has(id));
  if (unknown.length > 0) {
    return `payload 引用未知来源 ${unknown.join(", ")}；sources 中须先声明对应 id`;
  }
  return null;
}

function validateTimelinePayload(payload: TimelineMilestonesPayload): string | null {
  const all: TimelineItem[] = [
    ...(payload.occurred ?? []),
    ...(payload.inProgress ?? []),
    ...(payload.future ?? []),
  ];
  for (const item of all) {
    const text = `${item.title} ${item.detail}`;
    if (INDUSTRY_TIMELINE_RE.test(text)) {
      return `timeline 含行业/市场类事件（非项目级节点）：${item.title}`;
    }
  }
  return null;
}

export function validateSlotPayload(slot: CanonicalKbSlot, payload: unknown): string | null {
  if (!isRecord(payload)) return "payload 须为对象";

  const htmlErr = rejectHtmlOrScriptInPayload(payload);
  if (htmlErr) return htmlErr;

  switch (slot) {
    case "diligence-gaps": {
      const groups = payload.questionGroups;
      if (!Array.isArray(groups) || groups.length === 0) {
        return "diligence-gaps.payload.questionGroups 不能为空";
      }
      break;
    }
    case "risks-mitigation": {
      const rows = payload.riskRows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return "risks-mitigation.payload.riskRows 不能为空";
      }
      break;
    }
    case "timeline-milestones": {
      const tl = payload as TimelineMilestonesPayload;
      const err = validateTimelinePayload(tl);
      if (err) return err;
      break;
    }
    default:
      break;
  }
  return null;
}
