import { describe, expect, it } from "vitest";
import { knSlotBatchSessionR2Key } from "./knowledge-network-slot-batch-types";

describe("knSlotBatchSessionR2Key", () => {
  it("uses project and job id", () => {
    expect(knSlotBatchSessionR2Key("proj-1", "job-1")).toBe(
      "projects/proj-1/kn-slot-batch/job-1.json",
    );
  });
});
