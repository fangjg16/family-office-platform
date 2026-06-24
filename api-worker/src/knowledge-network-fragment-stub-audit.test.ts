import { describe, expect, it } from "vitest";
import { prepareSessionFragmentsForAssemble } from "./knowledge-network-fragment-assembler";
import {
  formatWorkerStubAuditAnswerBlock,
  hasWorkerStubAudit,
} from "./knowledge-network-fragment-stub-audit";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

function baseSession(): KnSlotBatchSession {
  return {
    jobId: "j1",
    projectId: "p1",
    userId: "u1",
    projectTitle: "测试项目",
    mode: "full",
    phase: "assembling",
    currentBatchIndex: 5,
    generationMode: "fragment",
    fragments: { snapshot: '<section id="snapshot"></section>' },
    appendixFragments: {},
    fragmentDelivery: {},
    slots: {},
    slotQuality: {},
    shell: {},
    batchSummaries: [],
    batchTimings: [],
    batchRepairAttempts: {},
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

describe("workerStubSlots audit", () => {
  it("persists workerStubSlots and appendix on session at assemble prep", () => {
    const session = baseSession();
    const prep = prepareSessionFragmentsForAssemble(session);
    expect(prep.workerStubSlots.length).toBe(12);
    expect(prep.workerStubAppendix).toEqual(["glossary", "data-dictionary"]);
    expect(session.workerStubSlots?.length).toBe(12);
    expect(session.workerStubAppendix).toEqual(["glossary", "data-dictionary"]);
    expect(session.fragmentDelivery?.["target-overview"]?.delivery).toBe("worker-stub");
    expect(session.fragmentDelivery?.glossary?.delivery).toBe("worker-stub");
  });

  it("formats explicit audit block in answer", () => {
    const session = baseSession();
    prepareSessionFragmentsForAssemble(session);
    expect(hasWorkerStubAudit(session)).toBe(true);
    const block = formatWorkerStubAuditAnswerBlock(session);
    expect(block).toContain("Worker gap stub");
    expect(block).toContain("target-overview");
    expect(block).toContain("glossary");
    expect(block).not.toContain("snapshot");
  });

  it("returns empty audit block when no stubs", () => {
    const session = baseSession();
    session.fragments = { snapshot: '<section id="snapshot"></section>' };
    expect(formatWorkerStubAuditAnswerBlock(session)).toBe("");
  });
});
