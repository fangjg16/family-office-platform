import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import {
  mergeHardIssuesFromNormalized,
  normalizeSlotPayload,
} from "./knowledge-network-slot-normalizer";

/**
 * merge / publish 一致的 hard gate：
 * - full-empty placeholder → normalizer drop（soft warning，不 repair）
 * - 有内容但列名无法映射 / 组件类型错误 → hard repair
 */
export function evaluateSlotPayloadMergeHardIssues(
  slot: CanonicalKbSlot,
  payload: unknown,
): SlotQualityIssue[] {
  const normalized = normalizeSlotPayload(slot, payload);
  return mergeHardIssuesFromNormalized(slot, normalized);
}

/** merge 用：归一化 + hard issues + soft warnings */
export function normalizeSlotForMerge(slot: CanonicalKbSlot, payload: unknown) {
  return normalizeSlotPayload(slot, payload);
}

export function buildMergeRowRepairHint(slot: CanonicalKbSlot, issues: SlotQualityIssue[]): string {
  const lines = issues.slice(0, 6).map((i) => i.message);
  if (slot === "business-operations") {
    return (
      "business-operations：revenueTree/customerBuyer 无事实时用 operationalGaps 或 gap 标注行；" +
      "禁止 unmapped 列名。canonical 列见 revenueTree（应用/产品场景、价值主张、证据/缺口）与 customerBuyer。\n" +
      lines.join("\n")
    );
  }
  if (slot === "regulatory-compliance") {
    return (
      "regulatory-compliance：jurisdictionRows 须可映射到 canonical 列，或改 regulatoryGaps（jurisdiction/requirement/gap/nextAction）。\n" +
      lines.join("\n")
    );
  }
  if (slot === "valuation-returns") {
    return (
      "valuation-returns：cashflowGaps 用 canonical 列（缺口/原因/所需资料/下一步/对回报影响）或 gap-first scenarios；禁止 unmapped 列名。\n" +
      lines.join("\n")
    );
  }
  return lines.join("\n");
}
