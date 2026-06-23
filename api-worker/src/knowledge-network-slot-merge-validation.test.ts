import { describe, expect, it } from "vitest";
import { validateFullStructuredKbQuality } from "./knowledge-network-full-quality-contract";
import { isHardSlotIssueCode } from "./knowledge-network-hard-issue-codes";
import { evaluateSlotPayloadMergeHardIssues } from "./knowledge-network-slot-merge-validation";
import { normalizeSlotPayload } from "./knowledge-network-slot-normalizer";

describe("batch merge row hard validation (normalized)", () => {
  it("drops business-operations revenueTree empty rows without hard repair", () => {
    const payload = {
      revenueTree: [
        { 收入层级: "—", 收入项: "—", 定价基础: "—", "证据/来源": "—" },
        {},
      ],
      customerBuyer: [{ "客户/付费方": "待确认", 客户类型: "缺口", "证据/来源": "未提供" }],
      operationalGaps: [{ 待验证假设: "收入结构", 为什么关键: "估值", 验证方式: "索取分拆" }],
    };
    const norm = normalizeSlotPayload("business-operations", payload);
    expect(norm.droppedEmptyCount).toBeGreaterThan(0);
    expect(evaluateSlotPayloadMergeHardIssues("business-operations", payload)).toHaveLength(0);
    expect(isHardSlotIssueCode("empty_row")).toBe(false);
  });

  it("hard fails regulatory jurisdictionRows with unmapped keys", () => {
    const mapped = {
      jurisdictionRows: [
        {
          "规则/要求": "进出口许可",
          适用机关: "海关",
          当前状态: "待确认",
          "依据/来源": "未提供",
        },
      ],
    };
    expect(evaluateSlotPayloadMergeHardIssues("regulatory-compliance", mapped)).toHaveLength(0);

    const badPayload = {
      jurisdictionRows: [{ foo: "bar", baz: "qux" }],
    };
    const badIssues = evaluateSlotPayloadMergeHardIssues("regulatory-compliance", badPayload);
    expect(badIssues.some((i) => i.code === "unmapped_row_keys")).toBe(true);
  });

  it("passes gap-first regulatoryGaps", () => {
    const payload = {
      regulatoryGaps: [
        {
          jurisdiction: "哈萨克斯坦",
          requirement: "进出口许可",
          currentEvidence: "未提供",
          gap: "待确认/需法律意见",
          nextAction: "当地律师清单",
          riskLevel: "高",
        },
        {
          jurisdiction: "跨境结算",
          requirement: "外汇合规",
          currentEvidence: "未提供",
          gap: "缺银行函",
          nextAction: "确认结算结构",
          riskLevel: "中",
        },
        {
          jurisdiction: "产品合规",
          requirement: "质检认证",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "按 SKU 列清单",
          riskLevel: "中",
        },
        {
          jurisdiction: "口岸政策",
          requirement: "独立交付",
          currentEvidence: "资料提及",
          gap: "需核实有效期",
          nextAction: "索取批复",
          riskLevel: "中",
        },
      ],
    };
    expect(evaluateSlotPayloadMergeHardIssues("regulatory-compliance", payload)).toHaveLength(0);
  });

  it("publish gate uses normalized payload without residual empty/unmapped", () => {
    const biz = {
      operationalGaps: [
        { 待验证假设: "a", 为什么关键: "b", 验证方式: "c" },
        { 待验证假设: "d", 为什么关键: "e", 验证方式: "f" },
      ],
    };
    const reg = {
      regulatoryGaps: [
        {
          jurisdiction: "哈",
          requirement: "许可",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "律师",
          riskLevel: "高",
        },
        {
          jurisdiction: "b",
          requirement: "r2",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "n",
          riskLevel: "中",
        },
        {
          jurisdiction: "c",
          requirement: "r3",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "n",
          riskLevel: "中",
        },
        {
          jurisdiction: "d",
          requirement: "r4",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "n",
          riskLevel: "中",
        },
      ],
    };
    const q = validateFullStructuredKbQuality({
      type: "structured-kb-data",
      schemaVersion: "2.91",
      mode: "full",
      summary: "t",
      config: { displayOrder: [], projectType: "trade" },
      meta: { title: "T", autoSummary: "s" },
      maturity: { factorA: "—", factorB: "—", combined: "—", tier: "Early" },
      sources: [],
      slots: {
        "business-operations": biz,
        "regulatory-compliance": reg,
      },
    } as never);
    expect(q.emptyRowIssues.filter((e) => e.fillRatio === 0).length).toBe(0);
    expect(q.unmappedRowIssues.length).toBe(0);
  });
});
