import { describe, expect, it } from "vitest";
import { computeSlotEvidenceMaturity } from "./knowledge-network-slot-evidence-maturity";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";

describe("computeSlotEvidenceMaturity (v2.93)", () => {
  it("averages exactly 13 slots with fixed denominator", () => {
    const data = {
      schemaVersion: "2.91",
      type: "structured-kb-data",
      mode: "full",
      meta: { title: "T", autoSummary: "s" },
      config: { projectType: "trade", renderingMode: "chinese-only" },
      sources: [],
      maturity: { factorA: "0%", factorB: "0%", combined: "0%" },
      slots: {
        snapshot: { stage: "早期", status: "讨论", oneLineJudgment: "无价格", keyFacts: [] },
        "target-overview": { assetSummary: [], keyClaims: [] },
        "industry-market": { marketDrivers: [{ driver: "观点", evidence: "—" }] },
        "business-operations": { journeyMap: { stages: ["a"] }, revenueTree: [] },
        "resource-network": { parties: [], capabilities: [] },
        "legal-ownership": { entities: [], unresolvedLegalIssues: [{ issue: "权属待定" }] },
        "regulatory-compliance": { regulatoryGaps: [{ jurisdiction: "KZ", gap: "待确认" }] },
        "comps-benchmark": { compsRows: [], comparableGaps: [{ 缺口: "无" }] },
        "valuation-returns": {
          scenarios: [{ label: "Base", value: "待建模", detail: "gap" }],
          cashflowGaps: [],
        },
        "diligence-gaps": {
          questionGroups: [{ priority: "P1", questions: [{ question: "泛化问题?" }] }],
        },
        "risks-mitigation": { riskRows: [{ level: "高", risk: "市场风险" }] },
        "timeline-milestones": { gaps: [{ text: "暂无节点", confidence: "gap" }] },
        "decision-framework": { recommendation: "观望", decisionTable: [] },
      },
    } as unknown as StructuredKbData;

    const result = computeSlotEvidenceMaturity(data);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(30);
    expect(Object.keys(result.slotScores)).toHaveLength(13);
    expect(result.slotScores["comps-benchmark"]).toBe(0);
    expect(result.slotScores["valuation-returns"]).toBeLessThanOrEqual(5);
    expect(result.capsApplied.length).toBeGreaterThan(5);
  });
});
