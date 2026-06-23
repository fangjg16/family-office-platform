import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentJobRow } from "./agent-jobs";
import * as chatSync from "./chat-sync";
import { advanceKnSlotBatchJob } from "./knowledge-network-slot-batch-orchestrator";
import * as sessionMod from "./knowledge-network-slot-batch-session";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

function makeRow(overrides: Partial<AgentJobRow> = {}): AgentJobRow {
  return {
    id: "686b998d-b511-4854-ac66-7e5aac15d0b1",
    project_id: "proj-87c4b0718f58",
    user_id: "jensen-fang",
    conversation_id: "proj-87c4b0718f58-main",
    skill_intent: "knowledge_network",
    status: "running",
    hermes_run_id: "run_test",
    answer: null,
    knowledge_network_html: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeFailedSession(): KnSlotBatchSession {
  return {
    version: 2,
    architectureVersion: 2,
    parallelMode: true,
    jobId: "686b998d-b511-4854-ac66-7e5aac15d0b1",
    projectId: "proj-87c4b0718f58",
    userId: "jensen-fang",
    conversationId: "proj-87c4b0718f58-main",
    mode: "full",
    phase: "failed",
    currentBatchIndex: 5,
    batchRepairAttempts: {},
    slots: {},
    shell: { sources: [] },
    publishError: "rendering_html: gaps.map is not a function",
    currentPublishStep: "failed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("advanceKnSlotBatchJob session failed reconcile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks D1 job failed and syncs chat when session failed but job still running", async () => {
    const row = makeRow();
    const session = makeFailedSession();
    vi.spyOn(sessionMod, "readKnSlotBatchSession").mockResolvedValue(session);

    const runs: { sql: string; args: unknown[] }[] = [];
    const env = {
      DB: {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            run: async () => {
              runs.push({ sql, args });
              return {};
            },
            first: async () => ({
              ...row,
              status: "failed",
              error: "KN_RENDER_GAP_TYPE: rendering_html: gaps.map is not a function",
              answer: "知识网络生成未完成：发布阶段遇到格式问题，旧版本已保留。",
            }),
          }),
        }),
      },
    } as never;

    const syncSpy = vi
      .spyOn(chatSync, "syncAgentJobTerminalToChat")
      .mockResolvedValue(undefined);

    const result = await advanceKnSlotBatchJob(env, row);

    expect(result.action).toBe("failed");
    expect(runs.some((r) => r.sql.includes("status = 'failed'"))).toBe(true);
    const failRun = runs.find((r) => r.sql.includes("status = 'failed'"));
    expect(String(failRun?.args[0])).toContain("KN_RENDER_GAP_TYPE");
    expect(failRun?.args[1]).toBe("知识网络生成未完成：发布阶段遇到格式问题，旧版本已保留。");
    expect(syncSpy).toHaveBeenCalled();
  });
});
