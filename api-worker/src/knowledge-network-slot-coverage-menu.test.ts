import { describe, expect, it } from "vitest";
import { buildBatch2StructuredExampleBlock } from "./knowledge-network-slot-batch-batch2-protocol";
import { buildBatch3StructuredExampleBlock } from "./knowledge-network-slot-batch-batch3-protocol";
import { buildHermesSlotBatchWorkflow } from "./hermes-knowledge-network";
import {
  evaluateBusinessOperationsLayers,
  evaluateIndustryMarketLayers,
  evaluateRisksMitigationLayers,
} from "./knowledge-network-slot-coverage";
import { evaluateValuationReturnsLayers } from "./knowledge-network-batch3-coverage";
import { isHardSlotIssueCode } from "./knowledge-network-hard-issue-codes";

describe("menu-aligned coverage · business-operations", () => {
  it("passes with single revenueTree + operationalGaps without journeyMap", () => {
    const layers = evaluateBusinessOperationsLayers({
      revenueTree: [
        { "应用/产品场景": "贸易", "价值主张": "撮合", "证据/缺口": "A-1" },
      ],
      operationalGaps: [
        {
          issue: "缺 KPI",
          whyItMatters: "无法验证单位经济",
          requiredEvidence: "报表",
          owner: "CFO",
          decisionImpact: "保守假设",
          riskLevel: "中",
        },
      ],
    });
    expect(layers.pass).toBe(true);
    expect(layers.issues.some((i) => i.code === "journey")).toBe(false);
  });

  it("gap-first with operationalGaps only", () => {
    const layers = evaluateBusinessOperationsLayers({
      operationalGaps: [
        {
          issue: "缺 KPI",
          whyItMatters: "无法验证单位经济",
          requiredEvidence: "报表",
          owner: "CFO",
          decisionImpact: "保守假设",
          riskLevel: "中",
        },
      ],
    });
    expect(layers.pass).toBe(true);
    expect(layers.gapFirstMode).toBe(true);
  });

  it("passes with journeyMap only (no revenueTree/customerBuyer)", () => {
    const layers = evaluateBusinessOperationsLayers({
      journeyMap: { stages: ["获客", "交付"], lanes: [] },
    });
    expect(layers.pass).toBe(true);
    expect(layers.issues.some((i) => i.code === "journey")).toBe(false);
  });

  it("coverage issues are soft, not hard codes", () => {
    const layers = evaluateBusinessOperationsLayers({
      revenueTree: [
        { "应用/产品场景": "场景甲", "价值主张": "价值乙", "证据/缺口": "待确认" },
      ],
    });
    expect(layers.pass).toBe(true);
    for (const issue of layers.issues) {
      expect(isHardSlotIssueCode(issue.code)).toBe(false);
    }
  });
});

describe("menu-aligned coverage · industry-market", () => {
  it("passes with valueChain only (no policyContext)", () => {
    const layers = evaluateIndustryMarketLayers({
      valueChain: [
        { "价值链环节": "采购", "描述": "货源", "壁垒/机会": "—", "证据/缺口": "A-1" },
      ],
    });
    expect(layers.pass).toBe(true);
    expect(layers.issues.some((i) => i.code === "policy")).toBe(false);
  });
});

describe("menu-aligned coverage · risks-mitigation", () => {
  it("passes without stopConditions when riskRows present", () => {
    const layers = evaluateRisksMitigationLayers({
      riskRows: [
        { 风险: "汇率", 类别: "市场", 严重性: "中", 缓释: "对冲待确认", 证据: "缺口" },
        { 风险: "合规", 类别: "监管", 严重性: "高", 缓释: "法律意见", 证据: "缺口" },
      ],
    });
    expect(layers.pass).toBe(true);
    expect(layers.issues.some((i) => i.code === "stop")).toBe(false);
  });
});

describe("menu-aligned coverage · valuation-returns", () => {
  it("passes gap-first cashflowGaps without fabricated irr", () => {
    const layers = evaluateValuationReturnsLayers({
      cashflowGaps: [
        { 缺口: "缺投资额", 原因: "无 term sheet", 所需资料: "TS", 下一步: "DD", 对回报影响: "无法算 IRR" },
        { 缺口: "缺估值", 原因: "未披露", 所需资料: "估值 memo", 下一步: "访谈", 对回报影响: "倍数待定" },
      ],
    });
    expect(layers.pass).toBe(true);
    expect(layers.issues.some((i) => i.code === "valuation_scenarios")).toBe(false);
  });
});

describe("slim batch2/3 protocol examples", () => {
  it("batch2 example JSON is envelope + fragments, not full combo plate", () => {
    const block = buildBatch2StructuredExampleBlock();
    expect(block).toContain("菜单");
    expect(block).toContain('"revenueTree"');
    expect(block).not.toMatch(/"customerBuyer"\s*:/);
    expect(block).not.toMatch(/"journeyMap"\s*:/);
    expect(block.length).toBeLessThan(3500);
  });

  it("batch3 example JSON is envelope + fragments", () => {
    const block = buildBatch3StructuredExampleBlock();
    expect(block).toContain("菜单");
    expect(block).toContain('"resourceGaps"');
    expect(block).not.toMatch(/"parties"\s*:/);
    expect(block).not.toMatch(/"benchmarkMetrics"\s*:/);
    expect(block.length).toBeLessThan(2500);
  });

  it("v1 batch2 workflow references fragment example not full plate", () => {
    const workflow = buildHermesSlotBatchWorkflow({
      mode: "full",
      projectTitle: "T",
      batchIndex: 1,
      totalBatches: 4,
      slots: ["business-operations", "legal-ownership", "regulatory-compliance"],
      priorSlots: [],
    });
    expect(workflow).toContain("组件片段");
    expect(workflow).not.toContain("须达到同等密度");
    expect(workflow).not.toMatch(/"customerBuyer"\s*:/);
  });
});
