import { isRecord } from "./knowledge-network-coverage-target";
import type { GapCallout } from "./knowledge-network-structured-patch-types";

/** gaps 字段 canonical 形态：array of { text, confidence } */
export function normalizeGapCallouts(raw: unknown): GapCallout[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? [{ text, confidence: "gap" }] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): GapCallout | null => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text, confidence: "gap" } : null;
      }
      if (!isRecord(item)) return null;
      const text = String(item.text ?? item.message ?? item.note ?? item.缺口 ?? "").trim();
      if (!text) return null;
      const conf = item.confidence;
      const confidence: GapCallout["confidence"] =
        conf === "low" || conf === "note" || conf === "gap" ? conf : "gap";
      return { text, confidence };
    })
    .filter((g): g is GapCallout => g !== null);
}

export const KN_RENDER_GAP_TYPE_ERROR_CODE = "KN_RENDER_GAP_TYPE";

export const KN_PUBLISH_GAP_TYPE_FRIENDLY_MESSAGE =
  "知识网络生成未完成：发布阶段遇到格式问题，旧版本已保留。";

export function isKnRenderGapTypeError(error: string | null | undefined): boolean {
  const e = (error ?? "").trim();
  return (
    e.includes(KN_RENDER_GAP_TYPE_ERROR_CODE) ||
    /gaps\.map is not a function/i.test(e)
  );
}

export function knPublishFailedAnswer(error: string | null | undefined): string {
  if (isKnRenderGapTypeError(error)) return KN_PUBLISH_GAP_TYPE_FRIENDLY_MESSAGE;
  const detail = (error ?? "").trim();
  return detail ? `深度分析失败：${detail}` : "深度分析失败";
}

export function knPublishFailedStoredError(
  errorDetail: string,
  errorCode = KN_RENDER_GAP_TYPE_ERROR_CODE,
): string {
  const detail = errorDetail.trim();
  if (!detail) return errorCode;
  if (detail.startsWith(`${errorCode}:`)) return detail;
  return `${errorCode}: ${detail}`;
}
