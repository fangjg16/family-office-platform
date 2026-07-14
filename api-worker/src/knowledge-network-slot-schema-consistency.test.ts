import { describe, expect, it } from "vitest";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import {
  allowedComponentFields,
  getSlotModuleSchema,
} from "./knowledge-network-slot-module-schema";
import {
  findUnknownComponentsInPayload,
  listSchemaRendererRegistry,
} from "./knowledge-network-slot-schema-consistency";
import { normalizeSlotPayload } from "./knowledge-network-slot-normalizer";

describe("schema registry as menu (not package)", () => {
  it("business-operations allows many components but none are merge-required", () => {
    const schema = getSlotModuleSchema("business-operations");
    const fields = allowedComponentFields("business-operations");
    expect(fields).toContain("journeyMap");
    expect(fields).toContain("revenueTree");
    expect(fields).toContain("flywheel");
    expect(fields).toContain("canvas");
    expect(fields).toContain("operationalGaps");
    expect(schema.allowedComponents.every((c) => c.role === "allowed" || c.role === "fallback")).toBe(
      true,
    );
    const empty = normalizeSlotPayload("business-operations", {
      operationalGaps: [
        { 待验证假设: "a", 为什么关键: "b", 验证方式: "c" },
        { 待验证假设: "d", 为什么关键: "e", 验证方式: "f" },
      ],
    });
    expect(empty.hardIssues).toHaveLength(0);
  });

  it("optional component absence is not a consistency failure", () => {
    const norm = normalizeSlotPayload("industry-market", {
      gaps: [{ text: "市场数据不足", confidence: "gap" }],
    });
    expect(findUnknownComponentsInPayload("industry-market", norm.payload)).toHaveLength(0);
    expect(norm.hardIssues).toHaveLength(0);
  });

  it("unknown top-level fields are flagged (lightweight)", () => {
    const issues = findUnknownComponentsInPayload("business-operations", {
      revenueTree: [],
      inventedField: true,
    });
    expect(issues.some((i) => i.field === "inventedField")).toBe(true);
    expect(issues.some((i) => i.field === "revenueTree")).toBe(false);
  });

  it("every slot has an allowedComponents menu", () => {
    for (const slot of CANONICAL_KB_SLOTS) {
      expect(getSlotModuleSchema(slot).allowedComponents.length).toBeGreaterThan(0);
    }
  });

  it("schema renderer registry is documentation-only, not a requirement set", () => {
    const reg = listSchemaRendererRegistry();
    expect(reg["business-operations"]).toContain("journeyMap");
    expect(reg["risks-mitigation"]).toContain("riskRows");
    expect(reg["business-operations"].length).toBeLessThan(
      allowedComponentFields("business-operations").length,
    );
  });
});
