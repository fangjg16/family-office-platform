import { describe, expect, it } from "vitest";
import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";
import {
  buildFragmentBatchRequiredReads,
  resolveFragmentBatchExampleFiles,
} from "./knowledge-network-fragment-batch-reads";

describe("knowledge-network-fragment-batch-reads", () => {
  it("batch 0 includes kb-config, public search policy, and public-info-search deep ref (not Hermes self-maturity)", () => {
    const text = buildFragmentBatchRequiredReads({
      mode: "full",
      batchIndex: 0,
      batchSlots: [...KN_SLOT_BATCH_PLAN[0]!],
    });
    expect(text).toContain("content-rules.md");
    expect(text).toContain("kb-config.md");
    expect(text).not.toContain("maturity-scoring.md");
    expect(text).toContain("Worker");
    expect(text).toContain("公开检索政策");
    expect(text).toContain("public-info-search.md");
  });

  it("batch 3 includes valuation example and returns-analysis deep ref", () => {
    const text = buildFragmentBatchRequiredReads({
      mode: "full",
      batchIndex: 3,
      batchSlots: [...KN_SLOT_BATCH_PLAN[3]!],
    });
    expect(text).toContain("examples-kb-fragment-batch-valuation.json");
    expect(text).toContain("returns-analysis.md");
  });

  it("resolves example files per batch slots", () => {
    expect(resolveFragmentBatchExampleFiles([...KN_SLOT_BATCH_PLAN[2]!])).toContain(
      "examples-kb-fragment-batch-resource-comps.json",
    );
  });

  it("compact and override paths share deep refs and examples", () => {
    const slots = [...KN_SLOT_BATCH_PLAN[4]!];
    const compact = buildFragmentBatchRequiredReads({
      mode: "full",
      batchIndex: 4,
      batchSlots: slots,
      compact: true,
    });
    const full = buildFragmentBatchRequiredReads({
      mode: "full",
      batchIndex: 4,
      batchSlots: slots,
      compact: false,
    });
    expect(compact).toContain("risk-matrix.md");
    expect(full).toContain("risk-matrix.md");
    expect(compact).toContain("examples-kb-fragment-batch-risks-diligence.json");
    expect(full).toContain("examples-kb-fragment-batch-risks-diligence.json");
  });
});
