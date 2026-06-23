import { describe, expect, it } from "vitest";
import {
  resolveSlotBatchArchitecture,
  resolveParallelBatchLimit,
  userMessageRequestsSlotBatchV1,
} from "./knowledge-network-slot-batch-config";
import { rejectInventedFinalSourceIds } from "./knowledge-network-source-ref-resolve";

describe("slot-batch config guards", () => {
  it("defaults to v2 when enabled", () => {
    expect(resolveSlotBatchArchitecture({ KN_SLOT_BATCH_V2_ENABLED: "1" })).toBe("v2");
  });

  it("falls back to v1 when disabled or forced", () => {
    expect(resolveSlotBatchArchitecture({ KN_SLOT_BATCH_V2_ENABLED: "0" })).toBe("v1");
    expect(resolveSlotBatchArchitecture({ KN_SLOT_BATCH_FORCE_V1: "1" })).toBe("v1");
    expect(
      resolveSlotBatchArchitecture(
        { KN_SLOT_BATCH_V2_ENABLED: "1" },
        { userMessage: "请 slot-batch-v1 串行重做" },
      ),
    ).toBe("v1");
  });

  it("clamps parallel limit 1-4", () => {
    expect(resolveParallelBatchLimit({ KN_SLOT_BATCH_PARALLEL_LIMIT: "2" })).toBe(2);
    expect(resolveParallelBatchLimit({ KN_SLOT_BATCH_PARALLEL_LIMIT: "9" })).toBe(4);
  });

  it("detects user v1 request", () => {
    expect(userMessageRequestsSlotBatchV1("全量 slot-batch-v1")).toBe(true);
  });
});

describe("sourceProposals guard", () => {
  it("rejects invented final U-N id", () => {
    const err = rejectInventedFinalSourceIds(
      [{ id: "U-99", title: "假来源" }],
      [{ id: "U-1", type: "用户上传", title: "已有" }],
    );
    expect(err).toMatch(/不得自行指定最终 id/);
  });
});
