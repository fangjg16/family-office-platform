import { computeSlotEvidenceMaturity } from "./knowledge-network-slot-evidence-maturity";
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
const PROFESSIONAL_SOURCE_RE =
  /审计|法律意见|估值报告|政府登记|监管|法院|audited|legal opinion|valuation report|registry/i;
const PRESS_SOURCE_RE = /新闻|媒体|press|报道|outlet/i;

function pct(n: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return `${clamped}%`;
}

function countAuthoringParties(sources: StructuredKbSource[]): {
  sellerOnly: boolean;
  partyCount: number;
  thirdPartyCount: number;
  professionalCount: number;
  pressCount: number;
} {
  const parties = new Set<string>();
  let sellerCount = 0;
  let thirdPartyCount = 0;
  let professionalCount = 0;
  let pressCount = 0;

  for (const s of sources) {
    const key = `${s.type}::${s.author ?? s.title}`.toLowerCase();
    parties.add(key);
    const blob = `${s.type} ${s.title} ${s.author ?? ""}`;
    if (SELLER_SOURCE_RE.test(blob)) sellerCount += 1;
    if (THIRD_PARTY_SOURCE_RE.test(blob)) thirdPartyCount += 1;
    if (PROFESSIONAL_SOURCE_RE.test(blob)) professionalCount += 1;
    if (PRESS_SOURCE_RE.test(blob)) pressCount += 1;
  }

  const sellerOnly = parties.size <= 1 && sellerCount >= 1 && thirdPartyCount === 0;
  return {
    sellerOnly,
    partyCount: parties.size,
    thirdPartyCount,
    professionalCount,
    pressCount: Math.min(pressCount, 3),
  };
}

/** Factor B · Source Diversity（按独立来源主体，非文件数） */
export function computeFactorBFromSources(
  sources: StructuredKbSource[],
): { score: number; note: string } {
  return computeFactorB(sources);
}

function computeFactorB(sources: StructuredKbSource[]): { score: number; note: string } {
  const { sellerOnly, partyCount, thirdPartyCount, professionalCount, pressCount } =
    countAuthoringParties(sources);

  if (professionalCount >= 2 && partyCount >= 3) {
    return {
      score: 80,
      note: "多主体 + 专业/权威来源三角验证（审计/法律/政府登记等）",
    };
  }
  if (professionalCount >= 1 && thirdPartyCount >= 2) {
    return { score: 75, note: "含专业/权威来源且第三方主体多样" };
  }
  if (partyCount >= 4 || thirdPartyCount >= 3) {
    return {
      score: 60,
      note: `多方来源（${partyCount} 个独立主体；新闻类最多计 3）`,
    };
  }
  if (partyCount === 3 || thirdPartyCount >= 2) {
    return { score: 55, note: "多方来源，多样性中等" };
  }
  if (partyCount === 2) {
    return { score: 35, note: "两来源；仍缺第三方尽调/审计/法律文件" };
  }
  if (sellerOnly || (partyCount <= 1 && thirdPartyCount === 0)) {
    return {
      score: 20,
      note: "单一来源（项目 BP/卖方材料），Source Diversity 约 0–25%",
    };
  }
  if (thirdPartyCount >= 1) {
    return { score: 40, note: "含第三方来源，但仍偏少" };
  }
  if (pressCount >= 1) {
    return { score: 30, note: "以新闻/媒体为主，独立交易资料仍不足" };
  }
  return { score: 25, note: "来源多样性不足" };
}

export function pctMaturity(n: number): string {
  return pct(n);
}

export function inferMaturityTier(
  combined: number,
  factorA: number,
  factorB: number,
  sellerOnly: boolean,
): string {
  return inferTier(combined, factorA, factorB, sellerOnly);
}

function inferTier(
  combined: number,
  factorA: number,
  factorB: number,
  sellerOnly: boolean,
): string {
  if (factorA >= 60 && factorB < 30) {
    return "Early — 结构看似完整但来源单一，需多源验证";
  }
  if (factorB >= 50 && factorA < 35) {
    return "Early — 来源较多但交易硬证据仍不完整";
  }
  if (sellerOnly && combined > 40) return "Early — 证据链偏单来源，需多源验证";
  if (combined < 25) return "Lead — 资料与证据均不足";
  if (combined < 40) return "Early — 需补齐第三方证据";
  if (combined < 55) return "Active Diligence";
  if (combined < 70) return "Mid — 仍有关键缺口";
  return "Mature";
}

function buildFactorANote(
  evidence: ReturnType<typeof computeSlotEvidenceMaturity>,
  quality: ReturnType<typeof validateFullStructuredKbQuality>,
  sellerOnly: boolean,
): string {
  const segments: string[] = [evidence.note];

  if (evidence.capsApplied.length > 0) {
    segments.push(evidence.capsApplied.slice(0, 3).join("；"));
  }
  if (sellerOnly) {
    segments.push("单一 BP/卖方来源须第三方审计/法律/尽调验证后方可提高 Evidence Maturity");
  }
  if (quality.gapFirstSlots.length > 0) {
    segments.push(
      `${quality.gapFirstSlots.length} 个 slot 为 gap-first（缺口已标注，不抬高证据成熟度）`,
    );
  }
  return segments.join("。");
}

/**
 * Worker 确定性成熟度（轻量、payload 形成后一次扫描）。
 * Factor A = 13 slot evidence maturity 均值（v2.93）；gap rows 不抬高 Factor A。
 * 分数仅展示/风险提示，不作 repair 目标或 publish hard gate。
 */
export function computeDeterministicMaturity(data: StructuredKbData): DeterministicMaturity {
  const quality = validateFullStructuredKbQuality(data);
  const evidence = computeSlotEvidenceMaturity(data);
  const factorA = evidence.score;
  const b = computeFactorB(data.sources);
  let factorB = b.score;

  const { sellerOnly } = countAuthoringParties(data.sources);
  if (sellerOnly) {
    factorB = Math.min(factorB, 25);
  }

  const combined = Math.round(factorA * 0.6 + factorB * 0.4);
  const cappedCombined = sellerOnly ? Math.min(combined, 45) : combined;

  const factorANote = buildFactorANote(evidence, quality, sellerOnly);

  return {
    factorA,
    factorB,
    combined: cappedCombined,
    factorANote,
    factorBNote: b.note,
    tier: inferTier(cappedCombined, factorA, factorB, sellerOnly),
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
