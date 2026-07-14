import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { DeterministicMaturity } from "./knowledge-network-deterministic-maturity";
import {
  computeFactorBFromSources,
  inferMaturityTier,
  pctMaturity,
} from "./knowledge-network-deterministic-maturity";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";

const QUANT_RE =
  /\d+(?:\.\d+)?\s*(?:%|万|亿|m|b|k)?|\$|¥|￥|million|billion|moic|dpi|irr|npv/i;
const GAP_HEAVY_RE =
  /缺乏资料|待确认|待核实|gap-first|worker-gap-stub|data-worker-stub|资料不足/i;
const CITATION_RE = /(?:source-|#source-)[AU]-\d+/i;

function clamp(n: number, max = 85): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** 对单个 slot HTML 做保守证据成熟度打分（非完整 structured 公式的替代近似） */
export function scoreFragmentHtmlEvidence(html: string | undefined): number {
  const text = (html ?? "").trim();
  if (!text) return 0;
  if (/worker-gap-stub|data-worker-stub/i.test(text) && text.length < 1200) {
    return 8;
  }

  let score = 12;
  if (/<table/i.test(text)) score += 14;
  if (CITATION_RE.test(text)) score += 14;
  if (QUANT_RE.test(text)) score += 18;
  if (/journey-wrap|process-flow|scenario-cards|valuation-grid|risk-matrix/i.test(text)) {
    score += 10;
  }
  if (text.length > 1800) score += 8;
  if (text.length > 3500) score += 8;

  const gapHeavy = GAP_HEAVY_RE.test(text);
  if (gapHeavy) {
    // gap 可见有价值，但不抬高到「证据成熟」
    score = Math.min(score, 32);
  }

  return clamp(score);
}

export function computeFragmentEvidenceMaturity(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
): {
  score: number;
  slotScores: Record<CanonicalKbSlot, number>;
  note: string;
} {
  const slotScores = {} as Record<CanonicalKbSlot, number>;
  for (const slot of CANONICAL_KB_SLOTS) {
    slotScores[slot] = scoreFragmentHtmlEvidence(fragments[slot]);
  }
  const sum = CANONICAL_KB_SLOTS.reduce((acc, s) => acc + slotScores[s], 0);
  const score = Math.round(sum / CANONICAL_KB_SLOTS.length);
  const low = CANONICAL_KB_SLOTS.filter((s) => slotScores[s] <= 15).length;
  return {
    score,
    slotScores,
    note: `Fragment Evidence Maturity ${score}/100（13 slot HTML 信号均值；${low} 个 ≤15%）`,
  };
}

/** Worker 对 fragment 路径确定性 maturity（Hermes 不再自评） */
export function computeDeterministicMaturityFromFragments(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
  sources: StructuredKbSource[],
): DeterministicMaturity {
  const evidence = computeFragmentEvidenceMaturity(fragments);
  const factorA = evidence.score;
  const b = computeFactorBFromSources(sources);
  let factorB = b.score;
  const sellerOnly =
    b.score <= 25 &&
    (/单一来源|卖方材料|BP/.test(b.note) || sources.length <= 1);
  if (sellerOnly) {
    factorB = Math.min(factorB, 25);
  }

  const combined = Math.round(factorA * 0.6 + factorB * 0.4);
  const cappedCombined = sellerOnly ? Math.min(combined, 45) : combined;
  const tier = inferMaturityTier(cappedCombined, factorA, factorB, sellerOnly);

  return {
    factorA,
    factorB,
    combined: cappedCombined,
    factorANote: evidence.note,
    factorBNote: b.note,
    tier,
    factorADisplay: pctMaturity(factorA),
    factorBDisplay: pctMaturity(factorB),
    combinedDisplay: pctMaturity(cappedCombined),
  };
}
