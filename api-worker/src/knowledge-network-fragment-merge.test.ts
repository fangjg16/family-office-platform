import { describe, expect, it } from "vitest";
import { KB_FRAGMENT_BATCH_TYPE } from "./knowledge-network-fragment-types";
import { buildKbFragmentFixtureFromCodexParity } from "./fixtures/kb-fragment-fixture";
import {
  listUndeliveredCanonicalFragments,
  mergeFragmentBatchIntoSession,
} from "./knowledge-network-fragment-merge";
import { KN_SLOT_BATCH_PLAN, type KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

function baseFragmentSession(): KnSlotBatchSession {
  return {
    jobId: "job-1",
    projectId: "proj-1",
    userId: "user-1",
    projectTitle: "测试项目",
    mode: "full",
    phase: "waiting_hermes",
    currentBatchIndex: 0,
    generationMode: "fragment",
    fragments: {},
    appendixFragments: {},
    fragmentDelivery: {},
    slots: {},
    slotQuality: {},
    shell: { sources: [] },
    batchSummaries: [],
    batchTimings: [],
    batchRepairAttempts: {},
    updatedAt: new Date().toISOString(),
  };
}

describe("mergeFragmentBatchIntoSession", () => {
  const { input } = buildKbFragmentFixtureFromCodexParity();

  it("merges batch 0 canonical fragments into session", () => {
    const session = baseFragmentSession();
    const batchSlots = KN_SLOT_BATCH_PLAN[0]!;
    const answer = [
      "```json",
      JSON.stringify({
        type: KB_FRAGMENT_BATCH_TYPE,
        schemaVersion: "2.91",
        mode: "full",
        batchIndex: 0,
        fragments: Object.fromEntries(
          batchSlots.map((slot) => [slot, input.fragments[slot]]),
        ),
        sourceProposals: [],
      }),
      "```",
    ].join("\n");

    const merged = mergeFragmentBatchIntoSession(session, 0, answer);
    expect(merged.ok, merged.ok ? "" : merged.error).toBe(true);
    for (const slot of batchSlots) {
      expect(session.fragments?.[slot]?.trim()).toBeTruthy();
      expect(["delivered", "gap-first"]).toContain(session.fragmentDelivery?.[slot]?.delivery);
    }
  });

  it("fails when expected batch slot is missing", () => {
    const session = baseFragmentSession();
    const batchSlots = KN_SLOT_BATCH_PLAN[0]!;
    const onlyFirst = batchSlots[0]!;
    const answer = [
      "```json",
      JSON.stringify({
        type: KB_FRAGMENT_BATCH_TYPE,
        schemaVersion: "2.91",
        mode: "full",
        batchIndex: 0,
        fragments: { [onlyFirst]: input.fragments[onlyFirst] },
      }),
      "```",
    ].join("\n");

    const merged = mergeFragmentBatchIntoSession(session, 0, answer);
    expect(merged.ok).toBe(false);
    if (merged.ok) return;
    expect(merged.failedSlots.length).toBeGreaterThan(0);
    expect(merged.hardOnly).toBe(true);
  });

  it("listUndeliveredCanonicalFragments reports missing slots", () => {
    const session = baseFragmentSession();
    session.fragments = { snapshot: input.fragments.snapshot };
    const missing = listUndeliveredCanonicalFragments(session);
    expect(missing).not.toContain("snapshot");
    expect(missing.length).toBe(12);
  });
});
