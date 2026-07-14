import { describe, expect, it } from "vitest";
import {
  batchRunElapsedMs,
  DEFAULT_BATCH_RUN_TIMEOUT_MS,
  isBatchRunTimedOut,
  resolveBatchRunTimeoutMs,
} from "./knowledge-network-slot-batch-run-timeout";

describe("batch run timeout", () => {
  it("defaults to 20 minutes", () => {
    expect(resolveBatchRunTimeoutMs({})).toBe(DEFAULT_BATCH_RUN_TIMEOUT_MS);
  });

  it("reads KN_SLOT_BATCH_RUN_TIMEOUT_MS", () => {
    expect(resolveBatchRunTimeoutMs({ KN_SLOT_BATCH_RUN_TIMEOUT_MS: "900000" })).toBe(900_000);
  });

  it("detects timeout from startedAt", () => {
    const now = Date.parse("2026-06-03T12:30:00.000Z");
    const startedAt = "2026-06-03T12:00:00.000Z";
    expect(batchRunElapsedMs(startedAt, now)).toBe(30 * 60_000);
    expect(isBatchRunTimedOut(startedAt, 20 * 60_000, now)).toBe(true);
    expect(isBatchRunTimedOut(startedAt, 35 * 60_000, now)).toBe(false);
  });
});
