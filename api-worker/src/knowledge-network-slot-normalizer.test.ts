import { describe, expect, it } from "vitest";
import { buildCoverageLayers } from "./knowledge-network-coverage-target";
import { isHardSlotIssueCode } from "./knowledge-network-hard-issue-codes";
import { evaluateSlotPayloadMergeHardIssues } from "./knowledge-network-slot-merge-validation";
import { getSlotModuleSchema } from "./knowledge-network-slot-module-schema";
import {
  findResidualEmptyRowsInNormalized,
  findResidualUnmappedInNormalized,
  isFullEmptyPlaceholderRow,
  normalizeFlywheelValue,
  normalizeSlotPayload,
} from "./knowledge-network-slot-normalizer";
import { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";

describe("empty row policy", () => {
  it("drops full-empty placeholder rows without triggering hard repair", () => {
    const raw = {
      revenueTree: [{}, { "应用/产品场景": "—", 价值主张: "—", "证据/缺口": "—" }],
      operationalGaps: [
        { 待验证假设: "收入结构", 为什么关键: "估值", 验证方式: "索取分拆" },
      ],
    };
    const norm = normalizeSlotPayload("business-operations", raw);
    expect(norm.droppedEmptyCount).toBeGreaterThan(0);
    expect(norm.hardIssues).toHaveLength(0);
    expect(evaluateSlotPayloadMergeHardIssues("business-operations", raw)).toHaveLength(0);
    expect(norm.payload.revenueTree).toBeUndefined();
    expect(isHardSlotIssueCode("empty_row")).toBe(false);
  });

  it("treats gap-marked rows as non-empty", () => {
    const row = {
      gap: true,
      "应用/产品场景": "待确认",
      价值主张: "缺口",
      "证据/缺口": "未提供",
    };
    expect(isFullEmptyPlaceholderRow(row)).toBe(false);
    const norm = normalizeSlotPayload("business-operations", { revenueTree: [row] });
    expect(norm.hardIssues).toHaveLength(0);
    expect(norm.payload.revenueTree?.length).toBe(1);
  });

  it("adds component gap callout when all table rows dropped", () => {
    const norm = normalizeSlotPayload("business-operations", {
      revenueTree: [{}],
    });
    expect(norm.warnings.some((w) => w.code === "component_gap_callout")).toBe(true);
    const gaps = norm.payload.gaps as { text: string }[] | undefined;
    expect(gaps?.some((g) => g.text.includes("收入结构"))).toBe(true);
  });

  it("hard repairs meaningful cells with unmapped keys", () => {
    const issues = evaluateSlotPayloadMergeHardIssues("regulatory-compliance", {
      jurisdictionRows: [{ foo: "bar", baz: "qux" }],
    });
    expect(issues.some((i) => i.code === "unmapped_row_keys")).toBe(true);
    expect(isHardSlotIssueCode("unmapped_row_keys")).toBe(true);
  });
});

describe("centralized normalizer parity", () => {
  it("normalizes Codex legacy keys before validator scan", () => {
    const raw = { facts: [{ 项目项: "阶段", 内容: "尽调中", 证据: "材料" }] };
    const norm = normalizeSlotPayload("snapshot", raw);
    expect(norm.payload.keyFacts?.length).toBe(1);
    expect(findResidualUnmappedInNormalized("snapshot", norm.payload)).toHaveLength(0);
  });

  it("renderer and validator see same normalized payload", () => {
    const raw = {
      regulatoryGaps: [
        {
          jurisdiction: "哈",
          requirement: "许可",
          currentEvidence: "未提供",
          gap: "待确认",
          nextAction: "律师",
          riskLevel: "高",
        },
      ],
    };
    const norm = normalizeSlotPayload("regulatory-compliance", raw);
    const html = renderSlotPayloadByCanonicalSlot("regulatory-compliance", raw);
    expect(findResidualUnmappedInNormalized("regulatory-compliance", norm.payload)).toHaveLength(
      0,
    );
    expect(findResidualEmptyRowsInNormalized("regulatory-compliance", norm.payload)).toHaveLength(0);
    expect(html).not.toContain("flywheel.every");
  });
});

describe("component type normalization", () => {
  it("coerces flywheel string to narrative array", () => {
    const r = normalizeFlywheelValue("飞轮增强机制说明");
    expect(Array.isArray(r.value)).toBe(true);
    expect(r.hardIssue).toBeUndefined();
  });

  it("hard repairs flywheel invalid object", () => {
    const r = normalizeFlywheelValue({ unknown: true });
    expect(r.hardIssue?.code).toBe("invalid_component_type");
  });

  it("guards flywheel non-array in renderer after normalization", () => {
    const html = renderSlotPayloadByCanonicalSlot("business-operations", {
      flywheel: { length: 1, 0: { step: "x" } } as never,
      operationalGaps: [
        { 待验证假设: "a", 为什么关键: "b", 验证方式: "c" },
        { 待验证假设: "d", 为什么关键: "e", 验证方式: "f" },
      ],
    });
    expect(html).not.toMatch(/every is not a function/);
  });
});

describe("coverage target semantics", () => {
  it("counts fact + gap rows toward target, not facts only", () => {
    const layers = buildCoverageLayers({
      slot: "risks-mitigation",
      target: 4,
      factCount: 0,
      gapCount: 4,
    });
    expect(layers.totalCoverage).toBe(100);
    expect(layers.gapFirstMode).toBe(true);
    expect(layers.issues.some((i) => i.code === "coverage_target")).toBe(false);
  });

  it("does not require 4 real facts when gap rows satisfy target", () => {
    const layers = buildCoverageLayers({
      slot: "risks-mitigation",
      target: 4,
      factCount: 1,
      gapCount: 3,
    });
    expect(layers.totalCoverage).toBe(100);
  });
});

describe("module schema coverage", () => {
  it("defines schema for priority slots", () => {
    const priority = [
      "snapshot",
      "target-overview",
      "industry-market",
      "business-operations",
      "regulatory-compliance",
      "valuation-returns",
      "risks-mitigation",
      "timeline-milestones",
      "decision-framework",
    ] as const;
    for (const slot of priority) {
      expect(getSlotModuleSchema(slot).allowedComponents.length).toBeGreaterThan(0);
    }
  });
});
