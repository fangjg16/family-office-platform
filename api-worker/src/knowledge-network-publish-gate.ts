import type { FullKbQualityResult, SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import {
  HARD_SLOT_ISSUE_CODE_SET,
  isHardSlotIssueCode,
} from "./knowledge-network-hard-issue-codes";

/** 阻断发布 / 必须 repair 的 issue code */
export const HARD_PUBLISH_ISSUE_CODES = HARD_SLOT_ISSUE_CODE_SET;

export function isHardPublishIssue(issue: SlotQualityIssue): boolean {
  return isHardSlotIssueCode(issue.code);
}

export function evaluateHardPublishGate(quality: FullKbQualityResult): {
  hardGateOk: boolean;
  hardIssues: SlotQualityIssue[];
  softWarnings: string[];
} {
  const hardIssues = quality.issues.filter(isHardPublishIssue);
  const thinRows = quality.emptyRowIssues.filter((e) => e.fillRatio > 0);

  const hardGateOk =
    quality.unmappedRowIssues.length === 0 &&
    hardIssues.length === 0 &&
    quality.emptyRowIssues.filter((e) => e.fillRatio === 0).length === 0;

  const softWarnings: string[] = [];

  if (thinRows.length > 0) {
    softWarnings.push(
      `${thinRows.length} 处 table row 填充率偏低（非 hard gate；建议补全或转 gap row）`,
    );
  }

  if (quality.gapFirstSlots.length > 0) {
    softWarnings.push(
      `gap-first / 资料不足 slot（${quality.gapFirstSlots.join(", ")}）— 不提高 Evidence Maturity，可发布`,
    );
  }
  if (!quality.richContractMet) {
    softWarnings.push(
      `结构深度未达 rich contract（structure-coverage-debug ${quality.structureCoverage}%）— 不阻止发布`,
    );
  }
  if (quality.structureCoverage < 62) {
    softWarnings.push(`结构覆盖度偏低（${quality.structureCoverage}%）— 仅 debug，不映射 Factor A`);
  }
  for (const issue of quality.issues) {
    if (!isHardPublishIssue(issue) && !softWarnings.some((w) => w.includes(issue.code))) {
      softWarnings.push(`${issue.slot}: ${issue.message}`);
    }
  }

  return { hardGateOk, hardIssues, softWarnings };
}
