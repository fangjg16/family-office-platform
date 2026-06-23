import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import { isMeaningfulCell, pickRowCell } from "./knowledge-network-content-row-quality";

const SLOT = "risks-mitigation" as CanonicalKbSlot;

const FABRICATED_LICENSE_RE =
  /^(?:已(?:取得|获批|发放|备案|通过)|有效|持证|approved|granted|issued)$/i;

function asRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (r): r is Record<string, unknown> =>
      typeof r === "object" && r !== null && !Array.isArray(r),
  );
}

/** 资料不足时的结构化 gap-first 风险行 */
export function isGapFirstRiskRow(row: Record<string, unknown>): boolean {
  const risk = pickRowCell(row, ["risk", "title", "风险", "风险项", "riskTitle"]);
  const cause = pickRowCell(row, ["cause", "trigger", "原因", "触发因素", "根因"]);
  const impact = pickRowCell(row, ["impact", "影响", "investmentImpact", "对投资的影响"]);
  const mitigation = pickRowCell(row, [
    "mitigation",
    "nextAction",
    "缓释",
    "下一步",
    "缓解措施",
  ]);
  const evidence = pickRowCell(row, ["evidence", "source", "证据", "来源"]);
  const hasEvidenceIds =
    Array.isArray(row.evidenceSourceIds) && row.evidenceSourceIds.length > 0;
  const gapMarked =
    /待确认|待验证|缺口|资料不足|未提供|需项目方|待补充|gap|unknown/i.test(risk) ||
    /待确认|缺口|无法判断|缺.*资料|未提供|无法/i.test(cause) ||
    /待确认|缺口|未提供|待项目方/i.test(evidence);

  return (
    isMeaningfulCell(risk) &&
    isMeaningfulCell(cause) &&
    isMeaningfulCell(impact) &&
    isMeaningfulCell(mitigation) &&
    (hasEvidenceIds || isMeaningfulCell(evidence) || gapMarked)
  );
}

export function detectFabricatedRiskEvidence(
  payload: Record<string, unknown>,
): SlotQualityIssue[] {
  const issues: SlotQualityIssue[] = [];
  for (const row of asRows(payload.riskRows)) {
    const risk = pickRowCell(row, ["risk", "title", "风险"]);
    const cause = pickRowCell(row, ["cause", "trigger"]);
    const evidence = pickRowCell(row, ["evidence", "source", "证据"]);
    const hasIds = Array.isArray(row.evidenceSourceIds) && row.evidenceSourceIds.length > 0;
    const blob = `${risk} ${cause} ${evidence}`;

    if (
      (FABRICATED_LICENSE_RE.test(evidence.trim()) || FABRICATED_LICENSE_RE.test(cause.trim())) &&
      !hasIds
    ) {
      issues.push({
        slot: SLOT,
        code: "fabricated_risk",
        message: `风险「${risk}」含无证据许可断言，须改为 gap-first 待验证表述`,
      });
      continue;
    }

    if (
      /IRR\s*[\d.]+%?|MOIC\s*[\d.]+|已签(?:约|订)|核心客户|战略合作|已发生/i.test(blob) &&
      !hasIds &&
      !/待确认|缺口|待验证|gap|可能|或需/i.test(blob)
    ) {
      issues.push({
        slot: SLOT,
        code: "fabricated_risk",
        message: `风险行含未证实合同/客户/回报/事件断言，不得编造：${risk.slice(0, 48)}`,
      });
    }
  }
  return issues;
}

/** merge / publish hard gate：空 riskRows 与编造风险证据 */
export function evaluateRisksMitigationHardIssues(
  payload: Record<string, unknown> | undefined,
): SlotQualityIssue[] {
  if (!payload || typeof payload !== "object") {
    return [{ slot: SLOT, code: "payload_missing", message: "risks-mitigation payload 缺失" }];
  }
  const rows = payload.riskRows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      {
        slot: SLOT,
        code: "risk_rows_missing",
        message:
          "risks-mitigation.payload.riskRows 不能为空；须 risk register 或 gap-first risk register（资料不足写待验证风险，勿留空段落）",
      },
    ];
  }
  return detectFabricatedRiskEvidence(payload);
}

export function buildRisksGapFirstRepairHint(): string {
  return (
    "risks-mitigation：riskRows 不能为空。资料不足时用 gap-first 行：risk（待验证风险）、cause/trigger（缺什么资料）、impact、mitigation/nextAction、evidence/待项目方补充、owner/status=待确认。禁止编造许可证/合同/客户/IRR/已发生事件。"
  );
}
