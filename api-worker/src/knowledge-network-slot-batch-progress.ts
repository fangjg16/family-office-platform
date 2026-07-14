import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { isFragmentGenerationSession } from "./knowledge-network-generation-mode";
import {
  formatSlotChineseJoined,
  formatSlotChineseList,
  resolveGeneratingBatchSlots,
} from "./knowledge-network-slot-batch-slot-progress";
import {
  KN_SLOT_BATCH_PLAN,
  type KnPublishStep,
  type KnSlotBatchRunState,
  type KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";

export const KN_SLOT_BATCH_TOTAL_PARTS = KN_SLOT_BATCH_PLAN.length;

export const KN_BATCH_USER_LABELS: readonly string[] = [
  "项目快照与市场概览",
  "运营与合规",
  "资源与对标",
  "估值与回报",
  "尽调与风险",
  "时间线与决策及附录",
] as const;

export type KnSlotBatchProgressView = {
  batchIndex: number;
  totalBatches: number;
  phase: string;
  completedSlots: string[];
  completedFragments: CanonicalKbSlot[];
  currentBatchLabel: string;
  repairInProgress: boolean;
  generationMode?: KnSlotBatchSession["generationMode"];
  currentPublishStep?: KnPublishStep;
  publishError?: string;
  lastError?: string;
  parallelMode?: boolean;
  batchRuns?: KnSlotBatchRunState[];
  generatingSlots?: CanonicalKbSlot[];
  generatingSlotTitles?: string[];
  completedSlotTitles?: string[];
};

const BATCH_RUN_STATUS_ZH: Record<KnSlotBatchRunState["status"], string> = {
  queued: "排队",
  pending: "等待",
  running: "生成中",
  completed: "收尾",
  failed: "失败",
  cancelled: "已取消",
};

function truncateProgressError(error: string, max = 120): string {
  const t = error.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildKnFailedProgressLabel(view: KnSlotBatchProgressView): string {
  const err = (view.publishError ?? view.lastError ?? "").trim();
  if (!err) return "知识网络生成未完成";
  return `知识网络生成未完成：${truncateProgressError(err)}`;
}

function batchRunStatusLabel(run: KnSlotBatchRunState): string {
  if (run.merged) return "已合并";
  return BATCH_RUN_STATUS_ZH[run.status] ?? run.status;
}

/** 并行模式下标出当前在飞的 batch（如「批次 1+2 并行中（1·生成中，2·排队）」） */
function formatParallelBatchProgress(
  view: KnSlotBatchProgressView,
  elapsedSec?: number,
): string | null {
  if (!view.parallelMode || !view.batchRuns?.length) return null;
  const active = view.batchRuns.filter(
    (run) =>
      !run.merged &&
      (run.status === "queued" ||
        run.status === "pending" ||
        run.status === "running" ||
        run.status === "completed"),
  );
  if (active.length < 2) return null;
  const waited = formatWaited(elapsedSec);
  const nums = active.map((run) => run.batchIndex + 1).join("+");
  const statuses = active
    .map((run) => `${run.batchIndex + 1}·${batchRunStatusLabel(run)}`)
    .join("，");
  const done = view.completedFragments.length;
  return `正在撰写批次 ${nums} 并行中（${statuses}；已完成 ${done}/13 个板块）${formatSlotProgressDetail(view)}…${waited}`;
}

/** 生成中 / 已完成板块中文名（批次计划 + session 实存） */
export function formatSlotProgressDetail(view: KnSlotBatchProgressView): string {
  const parts: string[] = [];
  const generating =
    view.generatingSlotTitles?.length
      ? view.generatingSlotTitles
      : view.generatingSlots?.length
        ? formatSlotChineseList(view.generatingSlots)
        : [];
  if (generating.length) {
    parts.push(`生成：${formatSlotChineseJoined(generating)}`);
  }
  const completed =
    view.completedSlotTitles?.length
      ? view.completedSlotTitles
      : view.completedFragments.length
        ? formatSlotChineseList(view.completedFragments)
        : [];
  if (completed.length) {
    parts.push(`已完成：${formatSlotChineseJoined(completed)}`);
  }
  return parts.length ? ` · ${parts.join("；")}` : "";
}

export function listCompletedCanonicalSlots(session: KnSlotBatchSession): CanonicalKbSlot[] {
  if (isFragmentGenerationSession(session)) {
    return CANONICAL_KB_SLOTS.filter((slot) => Boolean(session.fragments?.[slot]?.trim()));
  }
  return CANONICAL_KB_SLOTS.filter((slot) => Boolean(session.slots[slot]));
}

export function resolveKnBatchUserLabel(batchIndex: number): string {
  return KN_BATCH_USER_LABELS[batchIndex] ?? `第 ${batchIndex + 1} 部分`;
}

export function isKnSlotBatchRepairInProgress(session: KnSlotBatchSession): boolean {
  if (session.phase === "failed" || session.phase === "done") return false;

  for (const run of session.batchRuns ?? []) {
    const attempts = session.batchRepairAttempts[run.batchIndex] ?? 0;
    if (attempts > 0 && !run.merged && (run.status === "running" || run.status === "queued")) {
      return true;
    }
  }

  const idx = session.currentBatchIndex;
  const attempts = session.batchRepairAttempts[idx] ?? 0;
  if (attempts === 0) return false;
  return (
    session.phase === "waiting_hermes" ||
    session.phase === "processing" ||
    session.phase === "waiting_batches"
  );
}

function formatWaited(elapsedSec?: number): string {
  if (elapsedSec == null || elapsedSec < 0) return "";
  if (elapsedSec < 60) return `（已等待 ${elapsedSec} 秒）`;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return s > 0 ? `（已等待 ${m} 分 ${s} 秒）` : `（已等待 ${m} 分钟）`;
}

/** D0 §8 用户可见进度文案 */
export function buildKnSlotBatchUserProgressLabel(
  view: KnSlotBatchProgressView,
  elapsedSec?: number,
): string {
  const waited = formatWaited(elapsedSec);

  if (view.phase === "failed" || (view.publishError && view.publishError.trim())) {
    return buildKnFailedProgressLabel(view);
  }

  const batchNo = view.batchIndex + 1;
  const total = view.totalBatches;
  const done = view.completedFragments.length;

  if (view.repairInProgress) {
    return `正在修正第 ${batchNo} 部分…${waited}`;
  }

  if (view.phase === "preprocessing") {
    return `正在整理项目资料…${waited}`;
  }

  if (view.phase === "appendix_wrapup") {
    return `正在全文收尾附录 B/C…${waited}`;
  }

  if (view.phase === "between_batches") {
    return `正在准备下一部分…${waited}`;
  }

  if (view.phase === "assembling") {
    return `正在合并各板块…${waited}`;
  }

  if (view.phase === "publishing") {
    switch (view.currentPublishStep) {
      case "quality_gate":
        return `正在核对引用与板块结构…${waited}`;
      case "validating_html":
        return `正在终审知识网络…${waited}`;
      case "writing_r2":
      case "updating_d1":
        return `正在保存知识网络…${waited}`;
      case "syncing_chat":
        return `正在更新对话…${waited}`;
      case "assembling":
        return `正在合并各板块…${waited}`;
      case "rendering_html":
        return `正在生成页面…${waited}`;
      default:
        return `正在保存知识网络…${waited}`;
    }
  }

  const waitingPhases = new Set([
    "waiting_hermes",
    "processing",
    "waiting_batches",
    "waiting_capacity",
  ]);
  if (waitingPhases.has(view.phase)) {
    const parallelLabel = formatParallelBatchProgress(view, elapsedSec);
    if (parallelLabel) return parallelLabel;
    if (view.batchIndex === KN_SLOT_BATCH_TOTAL_PARTS - 1) {
      return `正在整理附录${formatSlotProgressDetail(view)}…${waited}`;
    }
    return (
      `正在撰写第 ${batchNo} 部分，共 ${total} 部分（已完成 ${done}/13 个板块）` +
      `${formatSlotProgressDetail(view)}…${waited}`
    );
  }

  return (
    `正在撰写第 ${batchNo} 部分，共 ${total} 部分（已完成 ${done}/13 个板块）` +
    `${formatSlotProgressDetail(view)}…${waited}`
  );
}

export function buildKnSlotBatchProgressView(session: KnSlotBatchSession): KnSlotBatchProgressView {
  const completedFragments = listCompletedCanonicalSlots(session);
  const generatingSlots = resolveGeneratingBatchSlots(session);
  return {
    batchIndex: session.currentBatchIndex,
    totalBatches: KN_SLOT_BATCH_PLAN.length,
    phase: session.phase,
    completedSlots: isFragmentGenerationSession(session)
      ? Object.keys(session.fragments ?? {})
      : Object.keys(session.slots),
    completedFragments,
    currentBatchLabel: resolveKnBatchUserLabel(session.currentBatchIndex),
    repairInProgress: isKnSlotBatchRepairInProgress(session),
    generationMode: session.generationMode,
    currentPublishStep: session.currentPublishStep,
    publishError: session.publishError,
    lastError: session.lastError,
    parallelMode: session.parallelMode,
    batchRuns: session.batchRuns,
    generatingSlots,
    generatingSlotTitles: formatSlotChineseList(generatingSlots),
    completedSlotTitles: formatSlotChineseList(completedFragments),
  };
}
