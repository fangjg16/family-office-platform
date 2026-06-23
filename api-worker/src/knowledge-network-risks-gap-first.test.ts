import { describe, expect, it } from "vitest";
import {
  detectFabricatedRiskEvidence,
  evaluateRisksMitigationHardIssues,
  isGapFirstRiskRow,
} from "./knowledge-network-risks-gap-first";
import { evaluateSlotQuality } from "./knowledge-network-full-quality-contract";
import { isHardSlotIssueCode } from "./knowledge-network-hard-issue-codes";
import { buildMinimalSlotBatchRepairPrompt } from "./knowledge-network-slot-batch-minimal-repair";

function gapRisk(i: number) {
  return {
    level: "中",
    risk: `待验证：监管路径 ${i}`,
    cause: `缺许可/合规清单，无法判断 ${i}`,
    impact: `影响是否可推进交割 ${i}`,
    mitigation: `向项目方索取清单；法务跟进 ${i}`,
    evidenceSourceIds: [] as string[],
  };
}

describe("risks-mitigation gap-first hard gate", () => {
  it("accepts gap-first riskRows when evidence insufficient", () => {
    const payload = { riskRows: [1, 2, 3, 4].map(gapRisk) };
    for (const row of payload.riskRows) {
      expect(isGapFirstRiskRow(row)).toBe(true);
    }
    const hard = evaluateRisksMitigationHardIssues(payload);
    expect(hard.some((i) => i.code === "risk_rows_missing")).toBe(false);

    const q = evaluateSlotQuality("risks-mitigation", payload);
    expect(q.hardOk).toBe(true);
    expect(isHardSlotIssueCode("risk_rows_missing")).toBe(true);
  });

  it("hard fails empty riskRows at merge quality", () => {
    const hard = evaluateRisksMitigationHardIssues({ riskRows: [] });
    expect(hard.some((i) => i.code === "risk_rows_missing")).toBe(true);

    const q = evaluateSlotQuality("risks-mitigation", { riskRows: [] });
    expect(q.hardOk).toBe(false);
    expect(q.issues.some((i) => i.code === "risk_rows_missing")).toBe(true);
  });

  it("hard fails fabricated risk evidence", () => {
    const payload = {
      riskRows: [
        {
          level: "高",
          risk: "客户流失",
          cause: "已签约核心客户终止合作",
          impact: "收入下滑",
          mitigation: "—",
          evidenceSourceIds: [],
        },
      ],
    };
    const fabricated = detectFabricatedRiskEvidence(payload);
    expect(fabricated.some((i) => i.code === "fabricated_risk")).toBe(true);

    const q = evaluateSlotQuality("risks-mitigation", payload);
    expect(q.hardOk).toBe(false);
  });

  it("minimal repair prompt is short and gap-first for riskRows", () => {
    const prompt = buildMinimalSlotBatchRepairPrompt({
      repairMessage: "risk_rows_missing",
      failedSlots: ["risks-mitigation"],
      batchIndex: 4,
      mode: "full",
      issueCodes: ["risk_rows_missing"],
    });
    expect(prompt.length).toBeLessThan(1200);
    expect(prompt).toContain("gap-first");
    expect(prompt).not.toContain("完整示例");
    expect(prompt).toContain("batchIndex\":4");
  });
});
