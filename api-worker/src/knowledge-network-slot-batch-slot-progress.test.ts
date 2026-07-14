import { describe, expect, it } from "vitest";
import { resolveGeneratingBatchSlots } from "./knowledge-network-slot-batch-slot-progress";
import {
  buildKnSlotBatchProgressView,
  buildKnSlotBatchUserProgressLabel,
  formatSlotProgressDetail,
} from "./knowledge-network-slot-batch-progress";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

function baseSession(overrides: Partial<KnSlotBatchSession> = {}): KnSlotBatchSession {
  return {
    jobId: "j1",
    projectId: "p1",
    userId: "u1",
    projectTitle: "测试",
    mode: "full",
    phase: "waiting_batches",
    currentBatchIndex: 0,
    generationMode: "fragment",
    fragments: {
      snapshot: "<section id=\"snapshot\"></section>",
      "target-overview": "<section id=\"target-overview\"></section>",
    },
    slots: {},
    slotQuality: {},
    shell: {},
    batchSummaries: [],
    batchTimings: [],
    batchRepairAttempts: {},
    batchRunTimeoutRetries: {},
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("resolveGeneratingBatchSlots", () => {
  it("unions slots from active parallel batchRuns", () => {
    const session = baseSession({
      parallelMode: true,
      batchRuns: [
        { batchIndex: 0, status: "running" },
        { batchIndex: 1, status: "queued" },
      ],
    });
    const slots = resolveGeneratingBatchSlots(session);
    expect(slots).toEqual([
      "snapshot",
      "target-overview",
      "industry-market",
      "business-operations",
      "legal-ownership",
      "regulatory-compliance",
    ]);
  });

  it("falls back to current batch plan in serial mode", () => {
    const session = baseSession({
      parallelMode: false,
      phase: "waiting_hermes",
      currentBatchIndex: 2,
    });
    expect(resolveGeneratingBatchSlots(session)).toEqual(["resource-network", "comps-benchmark"]);
  });
});

describe("slot progress labels", () => {
  it("includes generating and completed Chinese slot titles", () => {
    const view = buildKnSlotBatchProgressView(
      baseSession({
        parallelMode: true,
        batchRuns: [
          { batchIndex: 0, status: "running" },
          { batchIndex: 1, status: "running" },
        ],
      }),
    );
    expect(view.generatingSlotTitles).toContain("项目快照");
    expect(view.generatingSlotTitles).toContain("业务模式与运营假设");
    expect(view.completedSlotTitles).toEqual(["项目快照", "资产构成 / 标的概况"]);

    const detail = formatSlotProgressDetail(view);
    expect(detail).toContain("生成：");
    expect(detail).toContain("已完成：项目快照");

    const label = buildKnSlotBatchUserProgressLabel(view);
    expect(label).toContain("批次 1+2 并行中");
    expect(label).toContain("生成：");
    expect(label).toContain("已完成：");
  });
});
