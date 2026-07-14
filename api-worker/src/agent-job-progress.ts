import type { AgentJobRow } from "./agent-jobs";
import {
  buildKnSlotBatchUserProgressLabel,
  type KnSlotBatchProgressView,
} from "./knowledge-network-slot-batch-progress";

export type AgentJobStage =
  | "pending"
  | "preparing_materials"
  | "reading_manifest"
  | "reading_materials"
  | "generating_kb"
  | "validating_html"
  | "putting_html"
  | "fallback_extracting_html"
  | "completed"
  | "failed"
  | "running_generic";

const STAGE_LABEL_ZH: Record<AgentJobStage, string> = {
  pending: "任务排队中",
  preparing_materials: "准备任务与指令",
  reading_manifest: "读取资料 manifest",
  reading_materials: "按需读取项目资料",
  generating_kb: "生成知识网络 HTML",
  validating_html: "校验 HTML 并入库",
  putting_html: "已收到 PUT，等待收尾",
  fallback_extracting_html: "从回复提取 HTML",
  completed: "已完成",
  failed: "失败",
  running_generic: "引擎执行中",
};

export function agentJobStageLabel(stage: AgentJobStage): string {
  return STAGE_LABEL_ZH[stage] ?? stage;
}

export function inferKnowledgeNetworkJobStage(
  row: Pick<AgentJobRow, "status" | "skill_intent" | "created_at" | "hermes_run_id">,
  hermesStatus: string | null,
  knPutReceived: boolean,
): AgentJobStage {
  if (row.status === "completed") return "completed";
  if (row.status === "failed") return "failed";
  if (row.status === "pending") return "pending";

  const runId = row.hermes_run_id || "";
  const hs = (hermesStatus || "").toLowerCase();
  const elapsedMs = Math.max(0, Date.now() - Date.parse(row.created_at));

  if (runId.startsWith("chat-fallback-")) {
    return elapsedMs < 90_000 ? "preparing_materials" : "generating_kb";
  }

  if (hs === "completed") {
    return knPutReceived ? "validating_html" : "fallback_extracting_html";
  }

  if (knPutReceived) return "putting_html";

  if (elapsedMs < 45_000) return "preparing_materials";
  if (elapsedMs < 120_000) return "reading_manifest";
  if (elapsedMs < 240_000) return "reading_materials";
  return "generating_kb";
}

export function buildAgentJobProgressLabel(params: {
  row: Pick<AgentJobRow, "status" | "skill_intent" | "created_at" | "hermes_run_id">;
  hermesStatus: string | null;
  knPutReceived?: boolean;
  elapsedSec: number;
  slotBatchProgress?: (KnSlotBatchProgressView & {
    batchTimings?: { batchIndex: number; durationMs?: number; slots: string[] }[];
  }) | null;
}): { progressLabel: string; jobStage: AgentJobStage } {
  const { row, hermesStatus, elapsedSec, slotBatchProgress } = params;
  const knPutReceived = params.knPutReceived ?? false;
  const waited = formatJobElapsedLabel(elapsedSec);

  if (row.status === "completed") {
    return { progressLabel: "已完成", jobStage: "completed" };
  }
  if (row.status === "failed") {
    return { progressLabel: "失败", jobStage: "failed" };
  }
  if (row.status === "pending") {
    return {
      progressLabel: `任务排队中（已等待 ${waited}）`,
      jobStage: "pending",
    };
  }

  const runId = row.hermes_run_id || "";
  if (runId.startsWith("chat-fallback-")) {
    const stage: AgentJobStage =
      elapsedSec < 90 ? "preparing_materials" : "generating_kb";
    return {
      progressLabel: `${agentJobStageLabel(stage)}（兼容模式，已等待 ${waited}）`,
      jobStage: stage,
    };
  }

  const hs = (hermesStatus || "").toLowerCase();
  if (hs === "waiting_for_approval") {
    return {
      progressLabel: `工具命令已自动放行，继续执行（已等待 ${waited}）`,
      jobStage: "reading_materials",
    };
  }

  if (row.skill_intent === "knowledge_network") {
    if (slotBatchProgress?.completedFragments) {
      const phase = slotBatchProgress.phase;
      const publishError = slotBatchProgress.publishError;
      if (phase === "failed" || (publishError && publishError.trim())) {
        return {
          progressLabel: buildKnSlotBatchUserProgressLabel(slotBatchProgress, elapsedSec),
          jobStage: "failed",
        };
      }
      let stage: AgentJobStage = "generating_kb";
      if (phase === "preprocessing") stage = "preparing_materials";
      if (phase === "appendix_wrapup") stage = "reading_materials";
      if (phase === "assembling" || phase === "publishing") stage = "validating_html";
      if (phase === "between_batches") stage = "reading_materials";
      return {
        progressLabel: buildKnSlotBatchUserProgressLabel(slotBatchProgress, elapsedSec),
        jobStage: stage,
      };
    }
    if (slotBatchProgress) {
      const phase = slotBatchProgress.phase;
      const publishError = slotBatchProgress.publishError;
      if (phase === "failed" || (publishError && publishError.trim())) {
        return {
          progressLabel: buildKnSlotBatchUserProgressLabel(slotBatchProgress, elapsedSec),
          jobStage: "failed",
        };
      }
      const batchNo = slotBatchProgress.batchIndex + 1;
      const total = slotBatchProgress.totalBatches;
      const slotsDone = slotBatchProgress.completedSlots.length;
      let stage: AgentJobStage = "generating_kb";
      if (phase === "assembling" || phase === "publishing") stage = "validating_html";
      if (phase === "between_batches") stage = "reading_materials";
      let label = `slot-batched 批次 ${batchNo}/${total}（已完成 ${slotsDone}/13 slot）（已等待 ${waited}）`;
      if (phase === "waiting_hermes" || phase === "processing") {
        label = `slot-batched 生成批次 ${batchNo}/${total}（已等待 ${waited}）`;
      }
      if (phase === "assembling" || phase === "publishing") {
        const pubStep = (slotBatchProgress as { currentPublishStep?: string }).currentPublishStep;
        label = pubStep
          ? `slot-batched 入库 · ${pubStep}（已等待 ${waited}）`
          : `slot-batched 组装与入库（已等待 ${waited}）`;
      }
      return { progressLabel: label, jobStage: stage };
    }
    const stage = inferKnowledgeNetworkJobStage(row, hermesStatus, knPutReceived);
    let label = `${agentJobStageLabel(stage)}（已等待 ${waited}）`;
    if (stage === "generating_kb" && elapsedSec >= 900) {
      label += " — 生成时间较长，请耐心等待";
    }
    if (stage === "generating_kb" && elapsedSec >= 1200) {
      label += "；超过 20 分钟可能即将超时";
    }
    return { progressLabel: label, jobStage: stage };
  }

  if (hs === "queued") {
    return {
      progressLabel: `已排队，等待引擎启动（已等待 ${waited}）`,
      jobStage: "pending",
    };
  }
  if (hs === "running" || hs === "started") {
    return {
      progressLabel: `引擎执行中（已等待 ${waited}）`,
      jobStage: "running_generic",
    };
  }
  if (hs === "completed") {
    return {
      progressLabel: `引擎已完成，正在写入对话结果（已等待 ${waited}）`,
      jobStage: "validating_html",
    };
  }
  if (hs === "failed" || hs === "cancelled") {
    return {
      progressLabel: `引擎已结束：${hs}（已等待 ${waited}）`,
      jobStage: "failed",
    };
  }
  if (hs) {
    return {
      progressLabel: `后台处理中 · ${hs}（已等待 ${waited}）`,
      jobStage: "running_generic",
    };
  }
  return {
    progressLabel: `后台处理中（已等待 ${waited}）`,
    jobStage: "running_generic",
  };
}

function formatJobElapsedLabel(elapsedSec: number): string {
  if (elapsedSec < 60) return `${elapsedSec} 秒`;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}
