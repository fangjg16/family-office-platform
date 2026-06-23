import { describe, expect, it } from "vitest";
import {
  evaluateCompsBenchmarkLayers,
  evaluateResourceNetworkLayers,
  evaluateValuationReturnsLayers,
} from "./knowledge-network-batch3-coverage";
import { hasFabricatedReturnMetrics } from "./knowledge-network-coverage-target";
import { computeDeterministicMaturity } from "./knowledge-network-deterministic-maturity";
import { evaluateSlotQuality } from "./knowledge-network-full-quality-contract";
import { buildHermesSlotBatchRepairPrompt } from "./hermes-knowledge-network";
import { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";

function resourceGap(i: number) {
  return {
    party: `主体 ${i}`,
    role: `角色 ${i}`,
    evidence: "未提供",
    dependency: `依赖 ${i}`,
    gap: `缺口 ${i}`,
    nextAction: `下一步 ${i}`,
  };
}

function comparableGap(i: number) {
  return {
    缺口: `可比缺口 ${i}`,
    原因: "无披露",
    所需资料: `资料 ${i}`,
    对估值启示: "倍数法暂不可用",
    nextAction: `检索 ${i}`,
  };
}

function cashflowGap(i: number) {
  return {
    缺口: `现金流缺口 ${i}`,
    原因: "缺 term sheet",
    所需资料: `输入 ${i}`,
    下一步: `DD ${i}`,
    对回报影响: "无法算 IRR",
  };
}

describe("coverage target · fact-rich resource-network", () => {
  it("passes with high factCoverage", () => {
    const payload = {
      parties: [1, 2, 3, 4].map((i) => ({
        "主体/资源": `主体 ${i}`,
        "关系与作用": "供应",
        "强度/可验证性": `A-${i}`,
        "依赖与风险": "低",
      })),
      capabilities: [1, 2, 3, 4].map((i) => ({
        能力: `能力 ${i}`,
        来源: "团队",
        缺口: "—",
      })),
      relationshipEdges: [1, 2, 3, 4].map((i) => ({
        relation: "合作",
        from: `A${i}`,
        to: "平台",
        status: `A-${i}`,
        risk: "低",
      })),
      resourceGaps: [1, 2, 3].map(resourceGap),
    };
    const layers = evaluateResourceNetworkLayers(payload);
    expect(layers.pass).toBe(true);
    expect(layers.factCoverage).toBeGreaterThanOrEqual(75);
    expect(layers.gapFirstMode).toBe(false);

    const q = evaluateSlotQuality("resource-network", payload);
    expect(q.ok).toBe(true);
    expect(q.factCoverage).toBeGreaterThan(50);
  });
});

describe("coverage target · sparse gap-first batch 3", () => {
  it("passes resource-network with low fact and high gap", () => {
    const payload = {
      parties: [
        {
          "主体/资源": "待确认供应商",
          "关系与作用": "货源",
          "强度/可验证性": "缺口",
          "依赖与风险": "断供",
        },
      ],
      capabilities: [1, 2, 3, 4].map((i) => ({
        能力: `待验证 ${i}`,
        来源: "—",
        缺口: `缺口 ${i}`,
      })),
      relationshipEdges: [1, 2, 3, 4].map((i) => ({
        relation: "合作",
        from: `X${i}`,
        to: "平台",
        status: "缺口",
        risk: "高",
      })),
      resourceGaps: [1, 2, 3, 4].map(resourceGap),
    };
    const layers = evaluateResourceNetworkLayers(payload);
    expect(layers.gapFirstMode).toBe(true);
    expect(layers.pass).toBe(true);
    expect(layers.factCoverage).toBeLessThan(50);
    expect(layers.gapCoverage).toBeGreaterThanOrEqual(75);
  });

  it("passes comps-benchmark with comparableGaps only", () => {
    const payload = {
      compsRows: [1, 2, 3, 4].map((i) => ({
        可比对象: `待补充 ${i}`,
        可比逻辑: "—",
        "指标/倍数": "—",
        "可借鉴/差异": "见 comparableGaps",
      })),
      comparableGaps: [1, 2, 3, 4].map(comparableGap),
      transactionCasesNote: "无 verified 交易；禁止编造。",
    };
    const layers = evaluateCompsBenchmarkLayers(payload);
    expect(layers.pass).toBe(true);
    expect(layers.gapFirstMode).toBe(true);

    const html = renderSlotPayloadByCanonicalSlot("comps-benchmark", payload);
    expect(html).toContain("可比缺口 / 待验证");
    expect(html).toContain("gap-coverage-table");
    expect(html).not.toContain("市场对标：暂无有效数据");
  });
});

describe("batch 3 no-comps / no-valuation", () => {
  it("rejects fabricated IRR without investment inputs", () => {
    const payload = {
      scenarios: [
        { label: "Base", value: "25% IRR", detail: "假设毛利 20%" },
        { label: "Downside", value: "12% MOIC", detail: "—" },
        { label: "Upside", value: "40%", detail: "—" },
      ],
      cashflowGaps: [1, 2, 3].map(cashflowGap),
    };
    expect(hasFabricatedReturnMetrics(payload)).toBe(true);
    const layers = evaluateValuationReturnsLayers(payload);
    expect(layers.pass).toBe(false);
    expect(layers.issues.some((i) => i.code === "fabricated_irr")).toBe(true);
  });

  it("accepts gap-first valuation without IRR", () => {
    const payload = {
      scenarios: [
        { label: "Downside", value: "无法量化 IRR/MOIC", detail: "缺投资金额" },
        { label: "Base", value: "待建模", detail: "见 cashflowGaps" },
        { label: "Upside", value: "待建模", detail: "需渠道验证" },
      ],
      cashflowGaps: [1, 2, 3].map(cashflowGap),
      sensitivityItems: [1, 2, 3, 4].map((i) => ({
        敏感变量: `变量 ${i}`,
        影响方向: "下行",
        "阈值/区间": "±10%",
        观察方式: "合同",
      })),
    };
    const layers = evaluateValuationReturnsLayers(payload);
    expect(layers.pass).toBe(true);
    expect(layers.gapFirstMode).toBe(true);

    const html = renderSlotPayloadByCanonicalSlot("valuation-returns", payload);
    expect(html).toContain("现金流缺口 / 待建模");
    expect(html).toContain("sc-gap");
  });
});

describe("maturity with gap-first slots", () => {
  it("Factor A reflects evidence not structure coverage", () => {
    const data = minimalKbFromCoverageTest();
    const m = computeDeterministicMaturity(data);
    expect(m.factorA).toBeLessThan(55);
    expect(m.factorANote).toContain("Evidence Maturity");
  });
});

function minimalKbFromCoverageTest(): StructuredKbData {
  return {
    schemaVersion: "2.91",
    meta: { title: "T", autoSummary: "s", version: "3" },
    config: { projectType: "trade", renderingMode: "chinese-only" },
    sources: [{ id: "source-1", type: "BP", title: "用户上传 BP", author: "卖方" }],
    maturity: { factorA: "95%", factorB: "80%", combined: "90%", tier: "Mature" },
    slots: {
      snapshot: {
        stage: "早期",
        status: "内部讨论",
        oneLineJudgment: "资料不足但结构完整",
        keyFacts: [1, 2, 3, 4, 5, 6].map((i) => ({
          项目项: `项 ${i}`,
          内容: `内容 ${i}`,
          "证据/来源": "缺口",
        })),
        gaps: [{ text: "缺口", confidence: "gap" }],
      },
    },
  } as unknown as StructuredKbData;
}

describe("repair prompt envelope", () => {
  it("minimal repair requires structured-slot-batch not full batch3 example", () => {
    const prompt = buildHermesSlotBatchRepairPrompt(
      "risk_rows_missing",
      ["risks-mitigation"],
      { batchIndex: 4, mode: "full" },
    );
    expect(prompt).toContain("structured-slot-batch");
    expect(prompt).toContain("batchIndex\":4");
    expect(prompt).toContain("gap-first");
    expect(prompt.length).toBeLessThan(1500);
    expect(prompt).not.toMatch(/```json/);
  });
});
