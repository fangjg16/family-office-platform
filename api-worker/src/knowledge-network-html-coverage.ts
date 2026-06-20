import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

export type HtmlCoverageMetrics = {
  totalSectionChars: number;
  totalTableRows: number;
  totalCallouts: number;
  totalCiteRefs: number;
  perSlot: Record<CanonicalKbSlot, { sectionChars: number; tableRows: number; callouts: number }>;
  score: number;
};

function extractSection(html: string, slot: string): string {
  const re = new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>([\\s\\S]*?)<\\/section>`,
    "i",
  );
  return html.match(re)?.[1] ?? "";
}

/** 0–100 综合覆盖分（用于 old/new KB 对比） */
export function scoreKnowledgeNetworkHtmlCoverage(html: string): HtmlCoverageMetrics {
  const perSlot = {} as HtmlCoverageMetrics["perSlot"];
  let totalSectionChars = 0;
  let totalTableRows = 0;
  let totalCallouts = 0;

  for (const slot of CANONICAL_KB_SLOTS) {
    const section = extractSection(html, slot);
    const tableRows = (section.match(/<tr[\s>]/gi) ?? []).length;
    const callouts = (section.match(/class=["'][^"']*callout/gi) ?? []).length;
    perSlot[slot] = { sectionChars: section.length, tableRows, callouts };
    totalSectionChars += section.length;
    totalTableRows += tableRows;
    totalCallouts += callouts;
  }

  const totalCiteRefs = (html.match(/href=["']#source-/gi) ?? []).length;

  // 加权：正文量 50%、表格 35%、callout 15%
  const charScore = Math.min(100, (totalSectionChars / 24000) * 100);
  const rowScore = Math.min(100, (totalTableRows / 120) * 100);
  const calloutScore = Math.min(100, (totalCallouts / 16) * 100);
  const score = Math.round(charScore * 0.5 + rowScore * 0.35 + calloutScore * 0.15);

  return {
    totalSectionChars,
    totalTableRows,
    totalCallouts,
    totalCiteRefs,
    perSlot,
    score,
  };
}

/** 旧版 KB 是否由 Worker structured-kb-data 确定性渲染（用于 regression gate） */
export function isWorkerStructuredRenderedKb(html: string): boolean {
  return /quality-coverage:\s*\d+/i.test(html) ||
    /Worker deterministic render|structured-full/i.test(html);
}

/** 从 KB-CONFIG 读取上次 structured 发布的 quality coverage */
export function extractKbQualityCoverageFromHtml(html: string): number | null {
  const m = html.match(/quality-coverage:\s*(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/** structured JSON quality 回归：仅对比旧版同为 Worker structured 时的 coverageScore */
export function isStructuredQualityRegressed(
  previousHtml: string,
  newCoverageScore: number,
  minRetainRatio = 0.85,
): { regressed: boolean; previousScore: number | null; nextScore: number; reason: string } {
  if (!isWorkerStructuredRenderedKb(previousHtml)) {
    return {
      regressed: false,
      previousScore: null,
      nextScore: newCoverageScore,
      reason: "旧版非 Worker structured 渲染，跳过 quality 回归（仅验新 JSON contract）",
    };
  }
  const previousScore = extractKbQualityCoverageFromHtml(previousHtml);
  if (previousScore == null) {
    return {
      regressed: false,
      previousScore: null,
      nextScore: newCoverageScore,
      reason: "旧版无 quality-coverage 标记，跳过回归",
    };
  }
  const regressed = newCoverageScore < previousScore * minRetainRatio;
  return {
    regressed,
    previousScore,
    nextScore: newCoverageScore,
    reason: regressed
      ? `structured quality ${newCoverageScore} < ${previousScore}×${minRetainRatio}`
      : "structured quality 回归通过",
  };
}

/** @deprecated 仅诊断用；发布门槛请用 isStructuredQualityRegressed */
export function isNewCoverageRegressed(
  previousHtml: string,
  nextHtml: string,
  minRetainRatio = 0.85,
): { regressed: boolean; previousScore: number; nextScore: number } {
  const previousScore = scoreKnowledgeNetworkHtmlCoverage(previousHtml).score;
  const nextScore = scoreKnowledgeNetworkHtmlCoverage(nextHtml).score;
  return {
    regressed: nextScore < previousScore * minRetainRatio,
    previousScore,
    nextScore,
  };
}
