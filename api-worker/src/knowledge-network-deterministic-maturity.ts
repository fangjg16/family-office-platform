import { validateFullStructuredKbQuality } from "./knowledge-network-full-quality-contract";
import type { StructuredKbData, StructuredKbSource } from "./knowledge-network-structured-kb-data-types";

export type DeterministicMaturity = {
  factorA: number;
  factorB: number;
  combined: number;
  factorANote: string;
  factorBNote: string;
  tier: string;
  factorADisplay: string;
  factorBDisplay: string;
  combinedDisplay: string;
};

const SELLER_SOURCE_RE =
  /用户上传|项目方|bp|商业计划|seller|pitch|项目资料|内部讨论/i;
const THIRD_PARTY_SOURCE_RE =
  /公开|第三方|审计|法律|财务|监管|政府|行业|研报|合同|尽调|counterparty|authority/i;

function pct(n: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return `${clamped}%`;
}

function countAuthoringParties(sources: StructuredKbSource[]): {
  sellerOnly: boolean;
  partyCount: number;
  thirdPartyCount: number;
} {
  const parties = new Set<string>();
  let sellerCount = 0;
  let thirdPartyCount = 0;

  for (const s of sources) {
    const key = `${s.type}::${s.author ?? s.title}`.toLowerCase();
    parties.add(key);
    const blob = `${s.type} ${s.title} ${s.author ?? ""}`;
    if (SELLER_SOURCE_RE.test(blob)) sellerCount += 1;
    if (THIRD_PARTY_SOURCE_RE.test(blob)) thirdPartyCount += 1;
  }

  const sellerOnly = parties.size <= 1 && sellerCount >= 1 && thirdPartyCount === 0;
  return { sellerOnly, partyCount: parties.size, thirdPartyCount };
}

function computeFactorB(sources: StructuredKbSource[]): { score: number; note: string } {
  const { sellerOnly, partyCount, thirdPartyCount } = countAuthoringParties(sources);

  if (sellerOnly || (partyCount <= 1 && thirdPartyCount === 0)) {
    return {
      score: 20,
      note: "单一来源（项目 BP/卖方材料），Factor B 上限 20–25%",
    };
  }
  if (partyCount === 2) {
    return { score: 35, note: "两来源；仍缺第三方尽调/审计/法律文件" };
  }
  if (thirdPartyCount >= 2) {
    return { score: 55, note: `${thirdPartyCount} 类第三方/公开来源，多样性中等` };
  }
  if (thirdPartyCount >= 1) {
    return { score: 40, note: "含第三方来源，但仍偏少" };
  }
  return { score: 25, note: "来源多样性不足" };
}

function inferTier(combined: number, sellerOnly: boolean): string {
  if (sellerOnly && combined > 40) return "Early — 结构较完整但来源单一，需多源验证";
  if (combined < 25) return "Lead — 资料与证据均不足";
  if (combined < 40) return "Early — 需补齐第三方证据";
  if (combined < 55) return "Active Diligence";
  if (combined < 70) return "Mid — 仍有关键缺口";
  return "Mature";
}

/** Worker 确定性成熟度：忽略 Hermes 自填 factorA/B/combined */
export function computeDeterministicMaturity(data: StructuredKbData): DeterministicMaturity {
  const quality = validateFullStructuredKbQuality(data);
  let factorA = quality.coverageScore;
  const b = computeFactorB(data.sources);
  let factorB = b.score;

  const { sellerOnly } = countAuthoringParties(data.sources);
  if (sellerOnly) {
    factorB = Math.min(factorB, 25);
    factorA = Math.min(factorA, 50);
  }
  if (quality.emptyRowIssues.length > 0) {
    factorA = Math.min(factorA, 75);
  }
  if (!quality.richContractMet) {
    factorA = Math.min(factorA, 85);
  }

  const combined = Math.round(factorA * 0.6 + factorB * 0.4);
  const cappedCombined = sellerOnly ? Math.min(combined, 45) : combined;

  const gapCount = quality.issues.length + quality.emptyRowIssues.length;
  const factorANote =
    gapCount > 0
      ? `Content Completeness ${factorA}/100；${gapCount} 项未达 Quality Contract 2.0`
      : sellerOnly
        ? `Content Completeness ${factorA}/100；单一来源上限 50%（须多源验证）`
        : `Content Completeness ${factorA}/100（rich contract）`;

  return {
    factorA,
    factorB,
    combined: cappedCombined,
    factorANote,
    factorBNote: b.note,
    tier: inferTier(cappedCombined, sellerOnly),
    factorADisplay: pct(factorA),
    factorBDisplay: pct(factorB),
    combinedDisplay: pct(cappedCombined),
  };
}

export function applyDeterministicMaturity(data: StructuredKbData): StructuredKbData {
  const m = computeDeterministicMaturity(data);
  return {
    ...data,
    maturity: {
      ...data.maturity,
      factorA: m.factorADisplay,
      factorANote: m.factorANote,
      factorB: m.factorBDisplay,
      factorBNote: m.factorBNote,
      combined: m.combinedDisplay,
      tier: m.tier,
    },
  };
}
