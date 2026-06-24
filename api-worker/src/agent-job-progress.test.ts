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
        completedFragments: Array.from({ length: 13 }, (_, i) => `slot-${i}`),
        currentBatchLabel: "时间线与决策及附录",
        repairInProgress: false,
        publishError: "rendering_html: timeout",
      },
    });
    expect(progressLabel).toBe("知识网络生成未完成");
  });

  it("uses D4 user-facing label when completedFragments present", () => {
    const { progressLabel } = buildAgentJobProgressLabel({
      row: baseRow,
      hermesStatus: "running",
      elapsedSec: 45,
      slotBatchProgress: {
        batchIndex: 1,
        totalBatches: 6,
        phase: "waiting_hermes",
        completedSlots: ["snapshot", "target-overview", "industry-market"],
        completedFragments: ["snapshot", "target-overview", "industry-market"],
        currentBatchLabel: "运营与合规",
        repairInProgress: false,
      },
    });
    expect(progressLabel).toContain("正在撰写第 2 部分");
    expect(progressLabel).toContain("已完成 3/13 个板块");
  });
});
