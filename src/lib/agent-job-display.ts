/** 将 Worker / 轮询 API 的工程字段映射为对话 UI 文案（仅展示层，不改后端）。 */

export const KN_TOTAL_SECTIONS = 13;

export type SlotBatchProgressLike = {
  batchIndex?: number;
  totalBatches?: number;
  phase?: string;
  completedSlots?: string[];
  publishError?: string | null;
  currentPublishStep?: string | null;
};

const KN_ERROR_FRIENDLY: Record<string, string> = {
  KN_RENDER_GAP_TYPE: "知识网络生成未完成，发布阶段遇到格式问题，旧版本已保留。",
  KN_CAPACITY_LIMIT: "知识网络生成未完成，请稍后重试。",
  KN_PUBLISH_FAILED: "知识网络生成未完成，请稍后重试。",
};

const TECHNICAL_SUBMIT_RE =
  /\bslot-batched\b|hard\s*gate|\bWorker\b|\bbatch\b|\bslot\b|Hermes|\bR2\b|\bD1\b|knGenerationMode|structured-slot|预处理\s*\+|并行\s*batch/i;

export function extractKnErrorCode(error: string | null | undefined): string | null {
  const trimmed = (error ?? "").trim();
  const head = trimmed.match(/^(KN_[A-Z0-9_]+)/);
  if (head?.[1]) return head[1];
  if (/gaps\.map is not a function/i.test(trimmed)) return "KN_RENDER_GAP_TYPE";
  if (/Too many concurrent runs|concurrent runs/i.test(trimmed)) return "KN_CAPACITY_LIMIT";
  return null;
}

function formatWaited(elapsedSec?: number): string {
  if (elapsedSec == null || elapsedSec < 0) return "";
  if (elapsedSec < 60) return `${elapsedSec} 秒`;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

function withWaited(base: string, elapsedSec?: number): string {
  const waited = formatWaited(elapsedSec);
  return waited ? `${base}（已等待 ${waited}）` : base;
}

const TECHNICAL_PROGRESS_RE =
  /\bslot-batched\b|批次\s*\d+\s*\/\s*\d+|已完成\s*\d+\s*\/\s*\d+\s*slot|入库\s*·|组装与入库/i;

export function isTechnicalAgentJobCopy(text: string): boolean {
  return TECHNICAL_SUBMIT_RE.test(text) || TECHNICAL_PROGRESS_RE.test(text);
}

/** 展示层：助手气泡正文（含 D1 存量、刷新恢复） */
export function productizeAssistantBubbleContent(
  content: string,
  opts?: { pendingJobId?: string | null },
): string {
  const t = content.trim();
  if (!t) {
    return opts?.pendingJobId
      ? "已开始生成项目知识网络，完成后将自动更新本对话。"
      : "";
  }
  if (opts?.pendingJobId || isTechnicalAgentJobCopy(t)) {
    return productizeKnJobSubmitContent(t);
  }
  return t;
}

/** 展示层：进度条文案（兜底旧 bundle / 未轮询前的内存态） */
export function productizeJobProgressLabelForDisplay(
  label: string | undefined,
  fallback = "正在生成，请稍候…",
): string {
  const t = (label ?? "").trim();
  if (!t) return fallback;
  if (t === "知识网络生成未完成") return t;
  if (isTechnicalAgentJobCopy(t) || TECHNICAL_PROGRESS_RE.test(t)) {
    return productizeRawProgressLabel(t);
  }
  return t;
}

export function productizeLiveChatMessageForDisplay(m: {
  role: string;
  content: string;
  pendingJobId?: string | null;
  jobProgressLabel?: string;
}): { content: string; jobProgressLabel?: string } {
  if (m.role !== "assistant") return { content: m.content, jobProgressLabel: m.jobProgressLabel };
  const content = productizeAssistantBubbleContent(m.content, {
    pendingJobId: m.pendingJobId,
  });
  const jobProgressLabel = m.pendingJobId
    ? productizeJobProgressLabelForDisplay(m.jobProgressLabel)
    : m.jobProgressLabel;
  return { content, jobProgressLabel };
}

/** 任务提交后助手气泡首段（API answer / D1 存量） */
export function productizeKnJobSubmitContent(content: string): string {
  const t = content.trim();
  if (!t) return "已开始生成项目知识网络，完成后将自动更新本对话。";
  if (TECHNICAL_SUBMIT_RE.test(t)) {
    return "已开始生成项目知识网络，将分多个阶段完成全部 13 个板块，校验通过后自动写入。";
  }
  if (/^已提交深度分析|^深度分析已提交|后台引擎|兼容模式/i.test(t)) {
    return "已开始深度分析，完成后将自动更新本对话。";
  }
  if (/^正在深度分析|^深度分析进行中/i.test(t)) return "正在生成，请稍候…";
  return t;
}

/** 轮询 progressLabel 兜底解析（无 slotBatchProgress 时） */
export function productizeRawProgressLabel(
  raw: string,
  elapsedSec?: number,
): string {
  const t = raw.trim();
  if (!t) return withWaited("正在生成，请稍候…", elapsedSec);
  if (t === "知识网络生成未完成" || /生成未完成|publishError/i.test(t)) {
    return "知识网络生成未完成";
  }
  if (/slot-batched|批次\s*(\d+)\s*\/\s*(\d+)/i.test(t)) {
    const m = t.match(/批次\s*(\d+)\s*\/\s*(\d+)/i);
    const batchNo = m?.[1] ?? "?";
    const total = m?.[2] ?? "?";
    const slots = t.match(/已完成\s*(\d+)\s*\/\s*(\d+)\s*slot/i);
    if (slots) {
      return withWaited(
        `正在生成第 ${batchNo} 部分，共 ${total} 部分（已完成 ${slots[1]}/${slots[2]} 个板块）`,
        elapsedSec,
      );
    }
    return withWaited(`正在生成第 ${batchNo} 部分，共 ${total} 部分`, elapsedSec);
  }
  if (/入库|组装|validating|publishing|assembling/i.test(t)) {
    return withWaited("正在汇总并写入知识网络", elapsedSec);
  }
  if (/整理|preparing|reading_manifest|reading_materials/i.test(t)) {
    return withWaited("正在整理资料", elapsedSec);
  }
  if (/引擎|Hermes|queued|running/i.test(t)) {
    return withWaited("正在生成，请稍候…", elapsedSec);
  }
  if (TECHNICAL_SUBMIT_RE.test(t)) {
    return withWaited("正在生成，请稍候…", elapsedSec);
  }
  return withWaited(t, elapsedSec);
}

/** 轮询进行中：优先用结构化 slotBatchProgress */
export function buildProductizedJobProgressLabel(data: {
  status?: string;
  progressLabel?: string;
  jobStage?: string;
  skillIntent?: string;
  slotBatchProgress?: SlotBatchProgressLike | null;
  elapsedSec?: number;
}): string {
  if (data.status === "pending") {
    return withWaited("任务排队中", data.elapsedSec);
  }

  const sb = data.slotBatchProgress;
  if (sb) {
    const phase = (sb.phase ?? "").trim();
    const batchNo = (sb.batchIndex ?? 0) + 1;
    const total = sb.totalBatches ?? 6;
    const slotsDone = sb.completedSlots?.length ?? 0;

    if (phase === "failed" || (sb.publishError && String(sb.publishError).trim())) {
      return "知识网络生成未完成";
    }
    if (phase === "preprocessing") {
      return withWaited("正在整理资料", data.elapsedSec);
    }
    if (phase === "assembling" || phase === "publishing") {
      return withWaited("正在汇总并写入知识网络", data.elapsedSec);
    }
    if (
      phase === "waiting_hermes" ||
      phase === "processing" ||
      phase === "waiting_batches" ||
      phase === "waiting_capacity"
    ) {
      return withWaited(`正在生成第 ${batchNo} 部分，共 ${total} 部分`, data.elapsedSec);
    }
    return withWaited(
      `正在生成第 ${batchNo} 部分，共 ${total} 部分（已完成 ${slotsDone}/${KN_TOTAL_SECTIONS} 个板块）`,
      data.elapsedSec,
    );
  }

  if (data.progressLabel?.trim()) {
    return productizeRawProgressLabel(data.progressLabel, data.elapsedSec);
  }

  if (data.jobStage === "preparing_materials" || data.jobStage === "reading_manifest") {
    return withWaited("正在整理资料", data.elapsedSec);
  }
  if (data.jobStage === "validating_html" || data.jobStage === "putting_html") {
    return withWaited("正在汇总并写入知识网络", data.elapsedSec);
  }
  if (data.skillIntent === "knowledge_network") {
    return withWaited("正在生成项目知识网络", data.elapsedSec);
  }
  return withWaited("正在处理，请稍候…", data.elapsedSec);
}

/** 任务失败：用户说明 + 错误代码 */
export function formatAgentJobFailureDisplay(
  error: string | null | undefined,
  answer?: string | null,
): string {
  const ans = (answer ?? "").trim();
  const code = extractKnErrorCode(error) ?? extractKnErrorCode(ans);
  const friendlyFromCode = code ? KN_ERROR_FRIENDLY[code] : undefined;

  if (
    ans &&
    !ans.startsWith("深度分析失败") &&
    !TECHNICAL_SUBMIT_RE.test(ans) &&
    /生成未完成|已保留|请稍后重试/i.test(ans)
  ) {
    if (code && !ans.includes("错误代码")) {
      return `${ans}\n\n错误代码：${code}`;
    }
    return ans;
  }

  const friendly =
    friendlyFromCode ??
    (ans && !ans.startsWith("深度分析失败") && !TECHNICAL_SUBMIT_RE.test(ans)
      ? ans
      : "知识网络生成未完成，请稍后重试。");

  return code ? `${friendly}\n\n错误代码：${code}` : friendly;
}

export function productizeStreamStatusLabel(label: string | undefined): string {
  const t = (label ?? "").trim();
  if (!t) return "正在处理，请稍候…";
  if (/引擎|Hermes|Worker|slot|batch/i.test(t)) return "正在处理，请稍候…";
  return t;
}
