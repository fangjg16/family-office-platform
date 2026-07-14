import { describe, expect, it } from "vitest";
import { adaptStructuredKbDataFromCodexKeys } from "./knowledge-network-codex-payload-adapter";
import { buildCodexParityFixture } from "./fixtures/codex-parity-structured-kb";
import { computeDeterministicMaturity } from "./knowledge-network-deterministic-maturity";
import { computeSlotEvidenceMaturity } from "./knowledge-network-slot-evidence-maturity";
import { evaluateSlotQuality } from "./knowledge-network-full-quality-contract";
import { evaluateHardPublishGate } from "./knowledge-network-publish-gate";
import { evaluateStructuredKbPublishGate, validateStructuredKbData } from "./knowledge-network-structured-kb-data";
import { validateFullStructuredKbQuality } from "./knowledge-network-full-quality-contract";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";

function minimalKb(overrides?: Partial<StructuredKbData["slots"]>): StructuredKbData {
  const baseSlots = {
    snapshot: {
      stage: "早期",
      status: "讨论",
      oneLineJudgment: "测试",
      keyFacts: [
        { 项目项: "A", 内容: "有引用", "证据/来源": "U-1" },
        { 项目项: "B", 内容: "缺口项", "证据/来源": "缺口" },
      ],
      gaps: [{ text: "缺合同", confidence: "gap" }],
    },
    "target-overview": { assetSummary: [], keyClaims: [], gaps: [{ text: "g", confidence: "gap" }] },
    "industry-market": { marketDrivers: [], gaps: [{ text: "g", confidence: "gap" }] },
    "business-operations": {
      journeyMap: { stages: ["a", "b"] },
      revenueTree: [],
      customerBuyer: [],
      gaps: [{ text: "g", confidence: "gap" }],
    },
    "resource-network": {
      parties: [],
      capabilities: [1, 2, 3, 4].map((i) => ({ 能力: `g${i}`, 来源: "—", 缺口: `缺口${i}` })),
      relationshipEdges: [1, 2, 3, 4].map(() => ({
        relation: "r",
        from: "a",
        to: "b",
        status: "缺口",
        risk: "高",
      })),
      resourceGaps: [1, 2, 3, 4].map((i) => ({
        party: `p${i}`,
        role: "r",
        evidence: "未提供",
        dependency: "d",
        gap: "g",
        nextAction: "n",
      })),
    },
    "legal-ownership": {
      entities: [],
      unresolvedLegalIssues: [1, 2, 3, 4].map((i) => ({
        issue: `i${i}`,
        whyItMatters: "w",
        requiredEvidence: "e",
        owner: "o",
        decisionImpact: "d",
        riskLevel: "中",
      })),
    },
    "regulatory-compliance": {
      regulatoryGaps: [1, 2, 3, 4].map((i) => ({
        jurisdiction: "KZ",
        requirement: `r${i}`,
        currentEvidence: "未提供",
        gap: "待确认",
        nextAction: "律师",
        riskLevel: "高",
      })),
    },
    "comps-benchmark": {
      compsRows: [],
      comparableGaps: [1, 2, 3, 4].map((i) => ({
        缺口: `g${i}`,
        原因: "无",
        所需资料: "d",
        对估值启示: "n",
        nextAction: "s",
      })),
      transactionCasesNote: "无交易",
    },
    "valuation-returns": {
      scenarios: [
        { label: "Base", value: "待建模", detail: "gap" },
        { label: "Downside", value: "无法量化", detail: "—" },
        { label: "Upside", value: "待建模", detail: "—" },
      ],
      cashflowGaps: [1, 2, 3].map((i) => ({
        缺口: `g${i}`,
        原因: "r",
        所需资料: "i",
        下一步: "n",
        对回报影响: "x",
      })),
      sensitivityItems: [],
    },
    "diligence-gaps": {
      questionGroups: [
        {
          group: "P1",
          questions: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
            question: `Q${i}?`,
            strength: "低",
            owner: "DD",
            urgency: "高",
            action: "索取",
          })),
        },
      ],
    },
    "risks-mitigation": {
      riskRows: [1, 2, 3, 4].map((i) => ({
        level: "高",
        risk: `r${i}`,
        cause: "c",
        impact: "i",
        mitigation: "m",
        evidenceSourceIds: ["U-1"],
      })),
    },
    "timeline-milestones": {
      gaps: [{ text: "暂无节点", confidence: "gap" }],
    },
    "decision-framework": {
      recommendation: "条件式推进",
      decisionTable: [
        { 选项: "A", 好处: "b", "代价/风险": "r", 适用条件: "c" },
        { 选项: "B", 好处: "b", "代价/风险": "r", 适用条件: "c" },
      ],
      nextActions: [
        { 下一步: "法务", Owner: "X", 时间: "T", 交付物: "memo" },
        { 下一步: "财务", Owner: "Y", 时间: "T", 交付物: "model" },
      ],
      goNoGoConditions: [{ 条件: "许可清晰", 否则: "暂停" }],
    },
  };
  return {
    schemaVersion: "2.91",
    type: "structured-kb-data",
    mode: "full",
    summary: "test",
    meta: { title: "T", autoSummary: "s" },
    config: { projectType: "trade", renderingMode: "chinese-only" },
    sources: [{ id: "U-1", type: "用户上传", title: "BP", author: "卖方" }],
    maturity: { factorA: "99%", factorB: "99%", combined: "99%", tier: "Mature" },
    slots: { ...baseSlots, ...overrides },
  } as unknown as StructuredKbData;
}

describe("Evidence Maturity (Factor A · v2.93)", () => {
  it("uses 13-slot mean with hard-evidence caps, not row citation rate", () => {
    const data = minimalKb();
    const ev = computeSlotEvidenceMaturity(data);
    expect(ev.score).toBeLessThan(55);
    expect(ev.capsApplied.length).toBeGreaterThan(0);

    const m = computeDeterministicMaturity(data);
    expect(m.factorA).toBe(ev.score);
    expect(m.factorANote).toContain("Evidence Maturity");
  });

  it("does not rise when only adding more gap/coverage rows", () => {
    const sparse = computeSlotEvidenceMaturity(minimalKb()).score;
    const withMoreGaps = computeSlotEvidenceMaturity(
      minimalKb({
        snapshot: {
          stage: "早期",
          status: "讨论",
          oneLineJudgment: "测试",
          keyFacts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({
            项目项: `K${i}`,
            内容: "缺口项",
            "证据/来源": "缺口",
          })),
          gaps: [{ text: "缺价格", confidence: "gap" }],
        },
      }),
    ).score;
    expect(withMoreGaps).toBeLessThanOrEqual(sparse + 2);
  });

  it("valuation slot stays ≤5% without investment amount or quantified return", () => {
    const data = minimalKb();
    const ev = computeSlotEvidenceMaturity(data);
    expect(ev.slotScores["valuation-returns"]).toBeLessThanOrEqual(5);
    expect(ev.slotScores["comps-benchmark"]).toBe(0);
  });
});

describe("Factor A isolation (v2.93)", () => {
  it("does not use structureCoverage, row targets, citation ratio, or gap row count", () => {
    const normalized = adaptStructuredKbDataFromCodexKeys(buildCodexParityFixture());
    const ev = computeSlotEvidenceMaturity(normalized);
    const quality = validateFullStructuredKbQuality(normalized);

    expect(quality.structureCoverage).toBeGreaterThan(0);
    expect(ev.score).toBeLessThan(45);
    expect(ev.score).not.toBe(quality.structureCoverage);

    const sparse = computeSlotEvidenceMaturity(normalized).score;
    const denseGaps = computeSlotEvidenceMaturity({
      ...normalized,
      slots: {
        ...normalized.slots,
        "diligence-gaps": {
          questionGroups: [
            {
              priority: "P1",
              questions: Array.from({ length: 20 }, (_, i) => ({
                question: `Q${i}?`,
                owner: "DD",
                requiredEvidence: "缺口",
              })),
            },
          ],
        },
      },
    }).score;
    expect(Math.abs(denseGaps - sparse)).toBeLessThanOrEqual(3);
  });
});

describe("publish hard gate non-blocking conditions", () => {
  it("allows low Factor A, gap-first, low structureCoverage, uncovered coverage target", () => {
    const data = minimalKb();
    const gate = evaluateStructuredKbPublishGate(data);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;

    const m = computeDeterministicMaturity(data);
    expect(m.factorA).toBeLessThan(55);
    expect(gate.quality.structureCoverage).toBeLessThan(85);
    expect(gate.quality.gapFirstSlots.length).toBeGreaterThan(0);
    expect(gate.quality.hardGateOk).toBe(true);

    const { hardGateOk, softWarnings } = evaluateHardPublishGate(gate.quality);
    expect(hardGateOk).toBe(true);
    expect(softWarnings.some((w) => w.includes("gap-first") || w.includes("structure"))).toBe(true);
  });
});

describe("publish gate hard vs soft", () => {
  it("allows gap-first KB through hard gate", () => {
    const data = minimalKb();
    const validated = validateStructuredKbData(data);
    expect(validated.ok, validated.ok ? "" : validated.reason).toBe(true);
    if (!validated.ok) return;
    const quality = validateFullStructuredKbQuality(validated.data);
    const { hardGateOk, softWarnings } = evaluateHardPublishGate(quality);
    expect(hardGateOk).toBe(true);
    expect(softWarnings.length).toBeGreaterThan(0);

    const gate = evaluateStructuredKbPublishGate(validated.data);
    expect(gate.ok).toBe(true);
  });

  it("blocks fabricated IRR (hard)", () => {
    const data = minimalKb({
      "valuation-returns": {
        scenarios: [{ label: "Base", value: "25% IRR", detail: "假" }],
        cashflowGaps: [],
        sensitivityItems: [],
      },
    });
    const q = evaluateSlotQuality("valuation-returns", data.slots["valuation-returns"]);
    expect(q.hardOk).toBe(false);
  });

  it("hard gate fails on empty row issues", () => {
    const data = minimalKb();
    const quality = evaluateStructuredKbPublishGate(data);
    if (!quality.ok) return;
    const gate = evaluateHardPublishGate(quality.quality);
    expect(gate.hardGateOk).toBe(true);
  });
});
