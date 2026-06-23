import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  countRichRowsForSpec,
  countValidRows,
  countValidRowsForColumns,
  isMeaningfulCell,
  pickRowCell,
} from "./knowledge-network-content-row-quality";
import { ROW_SPECS } from "./knowledge-network-row-columns";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";

const LEGAL_GAP_MIN = 4;
const REGULATORY_GAP_MIN = 4;

const FABRICATED_LICENSE_RE =
  /^(?:已(?:取得|获批|发放|备案|通过)|有效|持证|approved|granted|issued)$/i;

function pickRawCell(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return "";
}

function isRiskLevelCell(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return isMeaningfulCell(v) || /^(高|中|低|critical|high|medium|low)$/i.test(s);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function asRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord);
}

/** 结构化法律缺口行 */
export function isStructuredLegalGapRow(row: Record<string, unknown>): boolean {
  const issue = pickRowCell(row, [
    "issue",
    "问题",
    "issueTitle",
    "缺口",
    "legalIssue",
    "待确认事项",
  ]);
  const why = pickRowCell(row, ["whyItMatters", "为何重要", "impact", "重要性", "why"]);
  const evidence = pickRowCell(row, [
    "requiredEvidence",
    "所需证据",
    "所需资料",
    "evidenceNeeded",
    "待补资料",
  ]);
  const owner = pickRowCell(row, ["owner", "party", "责任方", "提供方", "ownerParty"]);
  const decision = pickRowCell(row, [
    "decisionImpact",
    "决策影响",
    "investmentImpact",
    "对投资的影响",
  ]);
  return (
    isMeaningfulCell(issue) &&
    isMeaningfulCell(why) &&
    isMeaningfulCell(evidence) &&
    isMeaningfulCell(owner) &&
    isMeaningfulCell(decision)
  );
}

/** 结构化监管缺口行 */
export function isStructuredRegulatoryGapRow(row: Record<string, unknown>): boolean {
  const jurisdiction = pickRowCell(row, ["jurisdiction", "辖区", "监管辖区", "地区"]);
  const requirement = pickRowCell(row, ["requirement", "监管要求", "许可要求", "规则"]);
  const evidence = pickRowCell(row, [
    "currentEvidence",
    "现有证据",
    "当前证据",
    "已有资料",
    "evidence",
  ]);
  const gap = pickRowCell(row, ["gap", "缺口", "缺失", "待确认", "unknown"]);
  const next = pickRowCell(row, ["nextAction", "下一步", "验证路径", "nextStep", "action"]);
  const risk = pickRawCell(row, ["riskLevel", "风险级别", "risk", "风险"]);
  return (
    isMeaningfulCell(jurisdiction) &&
    isMeaningfulCell(requirement) &&
    isMeaningfulCell(gap) &&
    isMeaningfulCell(next) &&
    isRiskLevelCell(risk) &&
    (isMeaningfulCell(evidence) || /待确认|需法律|缺口|未提供/i.test(gap))
  );
}

function countStructuredLegalGaps(payload: Record<string, unknown>): number {
  const rows = [
    ...asRows(payload.unresolvedLegalIssues),
    ...asRows(payload.legalGapRows),
  ];
  return rows.filter(isStructuredLegalGapRow).length;
}

function countStructuredRegulatoryGaps(payload: Record<string, unknown>): number {
  const rows = [
    ...asRows(payload.regulatoryGaps),
    ...asRows(payload.approvalPath),
    ...asRows(payload.gaps),
  ];
  return rows.filter(isStructuredRegulatoryGapRow).length;
}

function hasFabricatedLicenseClaims(payload: Record<string, unknown>): boolean {
  for (const field of ["licenseRequirements", "jurisdictionRows", "complianceRisks"] as const) {
    for (const row of asRows(payload[field])) {
      const status = pickRowCell(row, [
        "status",
        "状态",
        "状态/许可",
        "licenseStatus",
        "许可状态",
      ]);
      if (!isMeaningfulCell(status)) continue;
      if (FABRICATED_LICENSE_RE.test(status.trim())) {
        const gapCell = pickRowCell(row, ["缺口", "gap", "证据", "evidence", "source"]);
        const hasEvidence =
          arrLen(row.evidenceSourceIds) > 0 ||
          (isMeaningfulCell(gapCell) && !/待确认|缺口|未知|需法律/i.test(gapCell));
        if (!hasEvidence) return true;
      }
    }
  }
  return false;
}

export type SlotCoverageLayers = {
  factCoverage: number;
  gapCoverage: number;
  gapFirstMode: boolean;
  pass: boolean;
  score: number;
  issues: SlotQualityIssue[];
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function evaluateLegalOwnershipLayers(
  payload: Record<string, unknown>,
): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "legal-ownership";
  const issues: SlotQualityIssue[] = [];

  const entityRows = Math.max(
    countValidRowsForColumns(payload.entities, ROW_SPECS.entities.columns),
    countValidRowsForColumns(payload.ownershipClaims, ROW_SPECS.entities.columns),
  );
  const contractRich = countRichRowsForSpec(payload.contractRights, ROW_SPECS.contractRights);
  const licenseRows = countValidRows(payload.licenseRights);
  const edgeCount = arrLen(payload.relationshipEdges);

  let factPts = 0;
  if (entityRows >= 2) factPts += 35;
  else if (entityRows >= 1) factPts += 15;
  if (contractRich >= 1) factPts += 30;
  else if (licenseRows >= 1) factPts += 20;
  else if (edgeCount >= 1) factPts += 15;

  const factCoverage = clampPct((factPts / 65) * 100);

  const structuredGaps = countStructuredLegalGaps(payload);
  const gapCoverage = clampPct((structuredGaps / LEGAL_GAP_MIN) * 100);

  const factSufficient = contractRich >= 1 || licenseRows >= 1 || edgeCount >= 1;
  const gapFirstMode = !factSufficient && structuredGaps >= LEGAL_GAP_MIN;

  if (gapFirstMode) {
    if (structuredGaps < LEGAL_GAP_MIN) {
      issues.push({
        slot,
        code: "legal_gaps",
        message: `资料不足：须 unresolvedLegalIssues 至少 ${LEGAL_GAP_MIN} 条结构化缺口（issue/whyItMatters/requiredEvidence/owner/decisionImpact）`,
      });
    }
    if (entityRows < 1) {
      issues.push({
        slot,
        code: "entities",
        message: "gap-first 模式下仍须至少 1 条法律主体/权属行（可标注待确认）",
      });
    }
  } else {
    if (entityRows < 2) {
      issues.push({
        slot,
        code: "entities",
        message: "entities 至少 2 条有效行，或改走 gap-first（≥4 条 unresolvedLegalIssues）",
      });
    }
    if (!factSufficient) {
      issues.push({
        slot,
        code: "contracts",
        message:
          "缺少 contractRights/许可/关系边；若资料不足请改输出 ≥4 条 unresolvedLegalIssues 缺口行，勿编造事实",
      });
    }
  }

  const pass =
    issues.length === 0 &&
    ((factSufficient && entityRows >= 2 && factCoverage >= 50) ||
      (gapFirstMode && gapCoverage >= 75 && structuredGaps >= LEGAL_GAP_MIN));

  let score: number;
  if (gapFirstMode) {
    score = clampPct(gapCoverage * 0.75 + factCoverage * 0.25);
    score = Math.min(score, 72);
  } else {
    score = clampPct(factCoverage * 0.7 + gapCoverage * 0.3);
  }

  return { factCoverage, gapCoverage, gapFirstMode, pass, score, issues };
}

export function evaluateRegulatoryComplianceLayers(
  payload: Record<string, unknown>,
): SlotCoverageLayers {
  const slot: CanonicalKbSlot = "regulatory-compliance";
  const issues: SlotQualityIssue[] = [];

  if (hasFabricatedLicenseClaims(payload)) {
    issues.push({
      slot,
      code: "fabricated_license",
      message: "禁止无证据断言「已取得/有效」许可；请改为待确认/需法律意见 + gap 行",
    });
  }

  const jurisdictionRows = Math.max(
    countValidRowsForColumns(payload.jurisdictionRows, ROW_SPECS.jurisdictionRows.columns),
    countValidRowsForColumns(payload.complianceRisks, ROW_SPECS.jurisdictionRows.columns),
  );
  const licenseRich = countRichRowsForSpec(
    payload.licenseRequirements,
    ROW_SPECS.licenseRequirements,
  );
  const approvalValid = countValidRowsForColumns(
    payload.approvalPath,
    ROW_SPECS.approvalPath.columns,
  );

  let factPts = 0;
  if (jurisdictionRows >= 2) factPts += 40;
  else if (jurisdictionRows >= 1) factPts += 20;
  if (licenseRich >= 1) factPts += 35;
  else if (approvalValid >= 1) factPts += 20;

  const factCoverage = clampPct((factPts / 75) * 100);
  const structuredGaps = countStructuredRegulatoryGaps(payload);
  const gapCoverage = clampPct((structuredGaps / REGULATORY_GAP_MIN) * 100);

  const factSufficient = jurisdictionRows >= 2 && (licenseRich >= 1 || approvalValid >= 1);
  const gapFirstMode = !factSufficient && structuredGaps >= REGULATORY_GAP_MIN;

  if (gapFirstMode) {
    if (structuredGaps < REGULATORY_GAP_MIN) {
      issues.push({
        slot,
        code: "reg_gaps",
        message: `须 regulatoryGaps/approvalPath 至少 ${REGULATORY_GAP_MIN} 条结构化缺口（jurisdiction/requirement/gap/nextAction/riskLevel）`,
      });
    }
  } else {
    if (jurisdictionRows < 2) {
      issues.push({
        slot,
        code: "jurisdiction",
        message: "jurisdictionRows 不足；资料缺失时请用 ≥4 条 regulatoryGaps，勿编造许可状态",
      });
    }
    if (licenseRich < 1 && approvalValid < 1) {
      issues.push({
        slot,
        code: "license",
        message: "缺少 licenseRequirements/审批路径；或改 gap-first regulatoryGaps",
      });
    }
  }

  const pass =
    issues.length === 0 &&
    ((factSufficient && factCoverage >= 50) ||
      (gapFirstMode && gapCoverage >= 75 && structuredGaps >= REGULATORY_GAP_MIN));

  let score: number;
  if (gapFirstMode) {
    score = clampPct(gapCoverage * 0.75 + factCoverage * 0.25);
    score = Math.min(score, 72);
  } else {
    score = clampPct(factCoverage * 0.7 + gapCoverage * 0.3);
  }

  return { factCoverage, gapCoverage, gapFirstMode, pass, score, issues };
}

export function buildGapFirstRepairHint(slot: CanonicalKbSlot, layers: SlotCoverageLayers): string {
  if (slot === "legal-ownership") {
    return (
      `legal-ownership · gap-first repair：勿编造合同/许可事实。` +
      `补 unresolvedLegalIssues ≥${LEGAL_GAP_MIN} 条（issue / whyItMatters / requiredEvidence / owner / decisionImpact / riskLevel）。` +
      `coverage target 可由 gap rows 满足；不以提高 Evidence Maturity 为目标。`
    );
  }
  if (slot === "regulatory-compliance") {
    return (
      `regulatory-compliance · gap-first repair：勿断言已取得许可。` +
      `补 regulatoryGaps ≥${REGULATORY_GAP_MIN} 条（jurisdiction / requirement / currentEvidence / gap / nextAction / riskLevel）。` +
      `状态用「待确认/需法律意见」；gap rows 可帮助结构通过，不抬高 Factor A。`
    );
  }
  return "";
}

export { LEGAL_GAP_MIN, REGULATORY_GAP_MIN };
