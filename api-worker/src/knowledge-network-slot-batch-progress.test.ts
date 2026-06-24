import { describe, expect, it } from "vitest";
import {
  buildKnSlotBatchProgressView,
  buildKnSlotBatchUserProgressLabel,
  listCompletedCanonicalSlots,
} from "./knowledge-network-slot-batch-progress";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

function baseSession(overrides: Partial<KnSlotBatchSession> = {}): KnSlotBatchSession {
  return {
    jobId: "j1",
    projectId: "p1",
    userId: "u1",
    projectTitle: "测试",
    mode: "full",
    phase: "waiting_hermes",
    currentBatchIndex: 0,
    generationMode: "fragment",
    fragments: { snapshot: "<section id=\"snapshot\"></section>" },
    slots: {},
    slotQuality: {},
    shell: {},
    batchSummaries: [],
    batchTimings: [],
    batchRepairAttempts: {},
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("kn slot-batch progress D4", () => {
  it("lists completedFragments as canonical slots only", () => {
    const session = baseSession({
      fragments: {
        snapshot: "<section id=\"snapshot\"></section>",
        glossary: "<section id=\"glossary\"></section>",
      },
    });
    expect(listCompletedCanonicalSlots(session)).toEqual(["snapshot"]);
  });

  it("maps preprocessing phase label", () => {
    const view = buildKnSlotBatchProgressView(baseSession({ phase: "preprocessing" }));
    expect(buildKnSlotBatchUserProgressLabel(view)).toBe("正在整理项目资料…");
  });

  it("maps batch 5 appendix label", () => {
    const view = buildKnSlotBatchProgressView(
      baseSession({ phase: "waiting_hermes", currentBatchIndex: 5 }),
    );
    expect(buildKnSlotBatchUserProgressLabel(view)).toContain("正在整理附录");
  });

  it("maps publishing validating_html step", () => {
    const view = buildKnSlotBatchProgressView(
      baseSession({
        phase: "publishing",
        currentPublishStep: "validating_html",
        currentBatchIndex: 5,
      }),
    );
    expect(buildKnSlotBatchUserProgressLabel(view)).toBe("正在终审知识网络…");
  });

  it("maps repair in progress", () => {
    const view = buildKnSlotBatchProgressView(
      baseSession({
        phase: "waiting_hermes",
        currentBatchIndex: 2,
        batchRepairAttempts: { 2: 1 },
      }),
    );
    expect(view.repairInProgress).toBe(true);
    expect(buildKnSlotBatchUserProgressLabel(view)).toContain("正在修正第 3 部分");
  });
});
