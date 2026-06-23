import { describe, expect, it } from "vitest";
import { buildAgentJobProgressLabel } from "./agent-job-progress";

const baseRow = {
  status: "running" as const,
  skill_intent: "knowledge_network",
  created_at: new Date().toISOString(),
  hermes_run_id: "run_test",
};

describe("buildAgentJobProgressLabel slot-batch failed", () => {
  it("prefers failed label over 13/13 completed slots", () => {
    const { progressLabel, jobStage } = buildAgentJobProgressLabel({
      row: baseRow,
      hermesStatus: "completed",
      elapsedSec: 600,
      slotBatchProgress: {
        batchIndex: 5,
        totalBatches: 6,
        phase: "failed",
        completedSlots: Array.from({ length: 13 }, (_, i) => `slot-${i}`),
        publishError: "rendering_html: gaps.map is not a function",
      },
    });
    expect(progressLabel).toBe("知识网络生成未完成");
    expect(jobStage).toBe("failed");
  });

  it("shows failed when publishError exists even if phase not failed", () => {
    const { progressLabel } = buildAgentJobProgressLabel({
      row: baseRow,
      hermesStatus: null,
      elapsedSec: 120,
      slotBatchProgress: {
        batchIndex: 5,
        totalBatches: 6,
        phase: "publishing",
        completedSlots: Array.from({ length: 13 }, (_, i) => `slot-${i}`),
        publishError: "rendering_html: timeout",
      },
    });
    expect(progressLabel).toBe("知识网络生成未完成");
  });
});
