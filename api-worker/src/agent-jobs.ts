import type { SkillIntent } from "./chat-modes";
import { extractKnowledgeNetworkHtmlLoose } from "./chat-modes";
import { syncAgentJobTerminalToChat } from "./chat-sync";
import {
  cancelHermesRun,
  finalizeHermesOutput,
  isHermesAgentConfigured,
  pollHermesRun,
  startHermesRun,
  waitForHermesRunComplete,
  isHermesCapacityError,
  type HermesAgentEnv,
} from "./hermes-agent";
import { buildHermesStructuredKbRepairPrompt } from "./hermes-knowledge-network";
import { validateKnowledgeNetworkHtmlForWrite } from "./knowledge-network-html-validation";
import {
  applySlotHtmlPatchToKnowledgeNetworkHtml,
  extractSlotHtmlPatchFromAnswer,
  shouldUseSlotHtmlPatchMode,
  slotHtmlPatchSummaryForJob,
  validateMergedKnowledgeNetworkAfterSlotPatch,
} from "./knowledge-network-slot-patch";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  detectKnowledgeNetworkUpdateMode,
} from "./knowledge-network-mode";
import {
  applyStructuredSlotPatchToKnowledgeNetworkHtml,
  extractStructuredSlotPatchFromAnswer,
  isStructuredPatchBlocked,
  shouldUseStructuredSlotPatchMode,
  structuredSlotPatchSummaryForJob,
  validateEvidenceSourceIdsAgainstAppendixA,
  validateMergedKnowledgeNetworkAfterStructuredPatch,
  validateStructuredSlotPatch,
} from "./knowledge-network-structured-patch";
import {
  applyKbFragmentIncrementalToKnowledgeNetworkHtml,
  extractKbFragmentIncrementalFromAnswer,
  kbFragmentIncrementalSummaryForJob,
  shouldUseKbFragmentIncrementalMode,
  validateMergedKnowledgeNetworkAfterFragmentIncremental,
} from "./knowledge-network-fragment-incremental";
import { resolveKnGenerationMode } from "./knowledge-network-generation-mode";
import {
  evaluateStructuredKbPublishGate,
  extractStructuredKbDataFromAnswer,
  stripStructuredKbPayloadFromDisplayAnswer,
  renderStructuredKbDataToHtml,
  shouldUseStructuredKbDataMode,
} from "./knowledge-network-structured-kb-data";
import { formatKnVersionDisplay, resolveKnVersionOnUpload } from "./knowledge-network-version";
import { resolveKnUserMessage } from "./kn-job-user-message";
import { resolveKnowledgeNetworkSlotsFromMessage, resolveKnTouchedSlotsFromMessage } from "./knowledge-network-slot-aliases";
import { resolveProjectKnSlotRegistry } from "./knowledge-network-slot-registry-store";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";
import {
  advanceKnSlotBatchJob,
  initKnSlotBatchSession,
  processKnSlotBatchHermesBackground,
  readKnSlotBatchSession,
  shouldUseSlotBatchGeneration,
  startKnSlotBatchHermesRun,
  getKnSlotBatchProgress,
  recordKnSlotBatchReconcileFailure,
} from "./knowledge-network-slot-batch-orchestrator";
import {
  recordAgentJobTokenUsage,
  parseUsageFromHermesRunRaw,
  type AgentJobTokenUsage,
} from "./token-usage";

export type AgentJobEnv = HermesAgentEnv & {
  DB: D1Database;
  FILES: R2Bucket;
  /** 用于知识网络交付说明（是否已配置 Hermes→Worker 桥接密钥） */
  JFO_INTERNAL_KEY?: string;
};

/** 路径 B（从回复提取 HTML）成功时的说明：区分「未配密钥」与「已配但未 PUT」 */
function knowledgeNetworkExtractFallbackNote(env: AgentJobEnv): string {
  const bridgeConfigured = Boolean((env.JFO_INTERNAL_KEY ?? "").trim());
  if (bridgeConfigured) {
    return (
      "（本次 Hermes 未通过 curl PUT 回传，Worker 从回复提取 HTML 入库。" +
      "搭建期请按 docs/HERMES-RAILWAY-SSH-SETUP.md 在容器内重装 skills 并复测，直至显示「文件 API 回传」；" +
      "上线后本条可作为用户侧兜底。）"
    );
  }
  return (
    "（从回复提取 HTML 入库；请在 Railway Variables 与 Worker 执行 wrangler secret put JFO_INTERNAL_KEY 配置相同密钥，" +
    "以便 Hermes 使用 curl PUT 回传。）"
  );
}

export type AgentJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export const AGENT_JOB_CANCELLED_MESSAGE = "深度分析已取消：用户取消";

export function isAgentJobActive(status: AgentJobStatus | string): boolean {
  return status === "pending" || status === "running";
}

/** 是否仍接受 Hermes/Worker 写入任务结果 */
export function shouldAcceptAgentJobCompletion(status: AgentJobStatus | string): boolean {
  return isAgentJobActive(status);
}

export type AgentJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  conversation_id: string | null;
  skill_intent: string;
  status: AgentJobStatus;
  hermes_run_id: string | null;
  answer: string | null;
  knowledge_network_html: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type JobFinalizeResult =
  | {
      status: "ok";
      answer: string;
      knowledgeNetworkHtml: string | null;
    }
  | {
      status: "failed";
      error: string;
      answer: string;
    };

function extractKnHtmlFromResult(result: {
  answer: string;
  knowledgeNetworkHtml: string | null;
}): string | null {
  const direct = (result.knowledgeNetworkHtml ?? "").trim();
  if (direct) return direct;
  return extractKnowledgeNetworkHtmlLoose(result.answer);
}

async function resolveKnModeForJob(
  env: AgentJobEnv,
  row: AgentJobRow,
): Promise<KnowledgeNetworkUpdateMode> {
  const message = await resolveKnUserMessage(env, row);
  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  const hasExistingKb = Boolean(previousHtml?.trim());
  return detectKnowledgeNetworkUpdateMode(message, hasExistingKb);
}

async function writeKnowledgeNetworkFromHtml(
  env: AgentJobEnv,
  row: AgentJobRow,
  html: string,
  answerSummary: string,
  knMode?: KnowledgeNetworkUpdateMode,
): Promise<
  | { ok: true; meta: NonNullable<Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>>; html: string }
  | { ok: false; error: string }
> {
  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  const mode =
    knMode ??
    (row.skill_intent === "knowledge_network"
      ? await resolveKnModeForJob(env, row)
      : "incremental");
  const validation = validateKnowledgeNetworkHtmlForWrite(html, {
    mode,
    previousHtml,
    strict: true,
    touchesTimeline: mode !== "reorder" && /id=["']timeline-milestones["']/i.test(html),
    browserUpload: false,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "HTML 校验失败" };
  }

  const htmlToStore = validation.html ?? html;

  await upsertProjectKnowledgeNetwork(env, {
    projectId: row.project_id,
    userId: row.user_id,
    html: htmlToStore,
    lastJobId: row.id,
    answerSummary,
  });
  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const stored = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  if (!meta || !stored) {
    return { ok: false, error: "知识网络写入后读取失败" };
  }
  return { meta, html: stored, ok: true };
}

type SlotPatchWriteResult =
  | {
      ok: true;
      meta: NonNullable<Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>>;
      html: string;
      slot: string;
      summary: string;
    }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

type StructuredPatchWriteResult =
  | {
      ok: true;
      meta: NonNullable<Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>>;
      html: string;
      slot: string;
      summary: string;
    }
  | { ok: false; skipped: true }
  | { ok: false; blocked: true; reason: string }
  | { ok: false; skipped: false; error: string };

type FragmentIncrementalWriteResult =
  | {
      ok: true;
      meta: NonNullable<Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>>;
      html: string;
      slot: string;
      summary: string;
    }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

export type StructuredKbDataWriteResult =
  | {
      ok: true;
      meta: NonNullable<Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>>;
      html: string;
      summary: string;
    }
  | { ok: false; skipped: true; notFound?: boolean }
  | { ok: false; skipped: false; error: string; repairNeeded?: boolean; qualityBlocked?: boolean };

/** full / initial：从 structured-kb-data JSON 渲染并入库（主路径） */
export async function tryWriteKnowledgeNetworkFromStructuredKbData(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
  knMode: KnowledgeNetworkUpdateMode,
): Promise<StructuredKbDataWriteResult> {
  if (!shouldUseStructuredKbDataMode(knMode)) {
    return { ok: false, skipped: true };
  }

  const extracted = extractStructuredKbDataFromAnswer(result.answer);
  if (!extracted.ok) {
    if (extracted.notFound) {
      return { ok: false, skipped: true, notFound: true };
    }
    return { ok: false, skipped: false, error: extracted.reason };
  }

  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  const gate = evaluateStructuredKbPublishGate(extracted.data, previousHtml);
  if (!gate.ok) {
    if ("repairNeeded" in gate && gate.repairNeeded) {
      return {
        ok: false,
        skipped: false,
        error: gate.message,
        repairNeeded: true,
      };
    }
    return {
      ok: false,
      skipped: false,
      error: gate.message,
      qualityBlocked: true,
    };
  }

  const prevKn = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const nextKnVersion = resolveKnVersionOnUpload(prevKn, null);
  const rendered = renderStructuredKbDataToHtml(extracted.data, {
    versionDisplay: formatKnVersionDisplay(nextKnVersion.version, nextKnVersion.versionLabel),
  });
  if (!rendered.ok) {
    return {
      ok: false,
      skipped: false,
      error: `validation failed: ${rendered.reason}`,
    };
  }

  const summary =
    extracted.data.summary?.trim() ||
    "structured-kb-data 确定性渲染入库";
  const written = await writeKnowledgeNetworkFromHtml(
    env,
    row,
    rendered.html,
    summary,
    knMode,
  );
  if (!written.ok) {
    return {
      ok: false,
      skipped: false,
      error: `validation failed: ${written.error}`,
    };
  }

  return {
    ok: true,
    meta: written.meta,
    html: written.html,
    summary,
  };
}

/** 测试注入：模拟 Hermes repair pass 返回补全 JSON */
export type StructuredKbRepairRunner = (
  repairMessage: string,
  originalAnswer: string,
  row: AgentJobRow,
) => Promise<{ ok: true; answer: string } | { ok: false; error: string }>;

async function runLiveStructuredKbRepairPass(
  env: AgentJobEnv,
  repairMessage: string,
  originalAnswer: string,
  row: AgentJobRow,
): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  if (!isHermesAgentConfigured(env)) {
    return { ok: false, error: "Hermes 未配置" };
  }
  const prompt = buildHermesStructuredKbRepairPrompt(repairMessage);
  const sessionId = (row.conversation_id ?? row.id).trim();
  const { runId, error: startErr } = await startHermesRun(env, {
    userMessage: prompt,
    sessionId,
    instructions:
      "你是联合家办 structured-kb-data repair 助手。仅补全 JSON（type=structured-kb-data），禁止 HTML/PUT。",
    history: [{ role: "assistant", content: originalAnswer.slice(0, 12000) }],
  });
  if (!runId) {
    const err = startErr ?? "Hermes repair run 启动失败";
    if (isHermesCapacityError(err)) {
      return { ok: false, error: `capacity_wait: ${err}` };
    }
    return { ok: false, error: err };
  }
  const snap = await waitForHermesRunComplete(env, runId);
  if (snap.status !== "completed" || !snap.output.trim()) {
    return {
      ok: false,
      error: snap.error || `Hermes repair 结束：${snap.status}`,
    };
  }
  return { ok: true, answer: snap.output.trim() };
}

/**
 * structured-kb-data 发布：首次失败后 repair_needed 时同一 job 内最多 repair 一次。
 * quality_blocked 不触发 repair（已 pass contract 但低于旧版 structured quality）。
 */
export async function publishStructuredKbWithOptionalRepair(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
  knMode: KnowledgeNetworkUpdateMode,
  options?: { repairRunner?: StructuredKbRepairRunner | null },
): Promise<StructuredKbDataWriteResult & { repairAttempted?: boolean }> {
  const first = await tryWriteKnowledgeNetworkFromStructuredKbData(env, row, result, knMode);
  if (first.ok || first.skipped || !first.repairNeeded) {
    return first;
  }

  const runner =
    options?.repairRunner === null
      ? null
      : (options?.repairRunner ?? runLiveStructuredKbRepairPass.bind(null, env));

  if (!runner) {
    return first;
  }

  const repaired = await runner(first.error, result.answer, row);
  if (!repaired.ok) {
    return first;
  }

  const second = await tryWriteKnowledgeNetworkFromStructuredKbData(
    env,
    row,
    { answer: repaired.answer },
    knMode,
  );
  return { ...second, repairAttempted: true };
}

async function tryAcceptHermesPutForJob(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
): Promise<JobFinalizeResult | null> {
  let meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);

  if (meta?.lastJobId === row.id) {
    const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
    if (html) {
      const note = `\n\n已同步至**项目知识网络 v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（文件 API 回传，可在项目详情预览）。`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer}${note}`;
      return { status: "ok", answer, knowledgeNetworkHtml: html };
    }
  }

  if (!meta || meta.lastJobId !== row.id) {
    await sleep(4000);
    meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
    if (meta?.lastJobId === row.id) {
      const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
      if (html) {
        const note = `\n\n已同步至**项目知识网络 v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（文件 API 回传）。`;
        return {
          status: "ok",
          answer: result.answer.includes("项目知识网络 v")
            ? result.answer
            : `${result.answer}${note}`,
          knowledgeNetworkHtml: html,
        };
      }
    }
  }

  return null;
}

async function tryWriteKnowledgeNetworkFromKbFragmentIncremental(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
  knMode: KnowledgeNetworkUpdateMode,
): Promise<FragmentIncrementalWriteResult> {
  const message = await resolveKnUserMessage(env, row);
  const generationMode = resolveKnGenerationMode(env, { userMessage: message });
  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id, {
    mergeVersionLedger: false,
  });
  const slotRegistry = await resolveProjectKnSlotRegistry(
    env,
    row.project_id,
    previousHtml,
  );
  const touchedSlots = resolveKnTouchedSlotsFromMessage(message, slotRegistry);
  if (!shouldUseKbFragmentIncrementalMode(generationMode, knMode, touchedSlots, slotRegistry)) {
    return { ok: false, skipped: true };
  }

  const expectedSlot = touchedSlots[0]!;
  const extracted = extractKbFragmentIncrementalFromAnswer(result.answer, expectedSlot);
  if (!extracted.ok) {
    if (extracted.skipped) {
      return { ok: false, skipped: true };
    }
    return { ok: false, skipped: false, error: extracted.error };
  }

  if (!previousHtml?.trim()) {
    return {
      ok: false,
      skipped: false,
      error: "无当前 KB HTML，无法 fragment incremental（请使用首次/全量）",
    };
  }

  const applied = applyKbFragmentIncrementalToKnowledgeNetworkHtml(
    previousHtml,
    extracted.batch,
    extracted.slot,
    extracted.sectionHtml,
  );
  if (!applied.ok) {
    return { ok: false, skipped: false, error: applied.error };
  }

  const validation = validateMergedKnowledgeNetworkAfterFragmentIncremental(applied.html, {
    previousHtml,
    slot: extracted.slot,
    slotRegistry,
  });
  if (!validation.ok) {
    return {
      ok: false,
      skipped: false,
      error: validation.error ?? "fragment incremental 合并后 strict 校验失败",
    };
  }

  const summary = kbFragmentIncrementalSummaryForJob(extracted.batch, extracted.slot);
  const written = await writeKnowledgeNetworkFromHtml(
    env,
    row,
    applied.html,
    summary,
    knMode,
  );
  if (!written.ok) {
    return { ok: false, skipped: false, error: written.error };
  }

  return {
    ok: true,
    meta: written.meta,
    html: written.html,
    slot: extracted.slot,
    summary,
  };
}

async function tryWriteKnowledgeNetworkFromStructuredSlotPatch(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
  knMode: KnowledgeNetworkUpdateMode,
): Promise<StructuredPatchWriteResult> {
  const message = await resolveKnUserMessage(env, row);
  const generationMode = resolveKnGenerationMode(env, { userMessage: message });
  const touchedSlots = resolveKnowledgeNetworkSlotsFromMessage(message);
  if (!shouldUseStructuredSlotPatchMode(knMode, touchedSlots, { generationMode })) {
    return { ok: false, skipped: true };
  }

  const extracted = extractStructuredSlotPatchFromAnswer(result.answer);
  if (!extracted.ok) {
    if (extracted.notFound) {
      return { ok: false, skipped: true };
    }
    return { ok: false, skipped: false, error: extracted.reason };
  }

  if (isStructuredPatchBlocked(extracted)) {
    return { ok: false, blocked: true, reason: extracted.reason };
  }

  const expectedSlot = touchedSlots[0]!;
  if (extracted.patch.slot !== expectedSlot) {
    return {
      ok: false,
      skipped: false,
      error: `patch.slot (${extracted.patch.slot}) 与用户点名 slot (${expectedSlot}) 不一致`,
    };
  }

  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id, {
    mergeVersionLedger: false,
  });
  if (!previousHtml?.trim()) {
    return {
      ok: false,
      skipped: false,
      error: "无当前 KB HTML，无法 structured patch（请使用首次/全量或整页 HTML）",
    };
  }

  const evidenceErr = validateEvidenceSourceIdsAgainstAppendixA(
    previousHtml,
    extracted.patch.payload,
  );
  if (evidenceErr) {
    return { ok: false, skipped: false, error: evidenceErr };
  }

  const validated = validateStructuredSlotPatch(extracted.patch);
  if (!validated.ok) {
    return { ok: false, skipped: false, error: validated.reason };
  }
  if (isStructuredPatchBlocked(validated)) {
    return { ok: false, blocked: true, reason: validated.reason };
  }

  const applied = applyStructuredSlotPatchToKnowledgeNetworkHtml(
    previousHtml,
    extracted.patch,
  );
  if (!applied.ok) {
    return { ok: false, skipped: false, error: applied.error };
  }

  const validation = validateMergedKnowledgeNetworkAfterStructuredPatch(applied.html, {
    previousHtml,
    touchesTimeline: extracted.patch.slot === "timeline-milestones",
  });
  if (!validation.ok) {
    return {
      ok: false,
      skipped: false,
      error: validation.error ?? "structured patch 合并后 strict 校验失败",
    };
  }

  const summary = structuredSlotPatchSummaryForJob(extracted.patch);
  const written = await writeKnowledgeNetworkFromHtml(
    env,
    row,
    applied.html,
    summary,
    knMode,
  );
  if (!written.ok) {
    return { ok: false, skipped: false, error: written.error };
  }

  return {
    ok: true,
    meta: written.meta,
    html: written.html,
    slot: extracted.patch.slot,
    summary,
  };
}

async function tryWriteKnowledgeNetworkFromSlotPatch(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string },
  knMode: KnowledgeNetworkUpdateMode,
): Promise<SlotPatchWriteResult> {
  const message = await resolveKnUserMessage(env, row);
  const touchedSlots = resolveKnowledgeNetworkSlotsFromMessage(message);
  if (!shouldUseSlotHtmlPatchMode(knMode, touchedSlots)) {
    return { ok: false, skipped: true };
  }

  const extracted = extractSlotHtmlPatchFromAnswer(result.answer);
  if (!extracted.ok) {
    return { ok: false, skipped: false, error: extracted.reason };
  }

  const expectedSlot = touchedSlots[0]!;
  if (extracted.patch.slot !== expectedSlot) {
    return {
      ok: false,
      skipped: false,
      error: `patch.slot (${extracted.patch.slot}) 与用户点名 slot (${expectedSlot}) 不一致`,
    };
  }

  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id, {
    mergeVersionLedger: false,
  });
  if (!previousHtml?.trim()) {
    return {
      ok: false,
      skipped: false,
      error: "无当前 KB HTML，无法 slot patch（请使用首次/全量或整页 HTML）",
    };
  }

  const applied = applySlotHtmlPatchToKnowledgeNetworkHtml(
    previousHtml,
    extracted.patch,
  );
  if (!applied.ok) {
    return { ok: false, skipped: false, error: applied.error };
  }

  const validation = validateMergedKnowledgeNetworkAfterSlotPatch(applied.html, {
    previousHtml,
    touchesTimeline: extracted.patch.slot === "timeline-milestones",
  });
  if (!validation.ok) {
    return {
      ok: false,
      skipped: false,
      error: validation.error ?? "slot patch 合并后 strict 校验失败",
    };
  }

  const summary = slotHtmlPatchSummaryForJob(extracted.patch);
  const written = await writeKnowledgeNetworkFromHtml(
    env,
    row,
    applied.html,
    summary,
    knMode,
  );
  if (!written.ok) {
    return { ok: false, skipped: false, error: written.error };
  }

  return {
    ok: true,
    meta: written.meta,
    html: written.html,
    slot: extracted.patch.slot,
    summary,
  };
}

export async function finalizeKnowledgeNetworkJobResult(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
  options?: { repairRunner?: StructuredKbRepairRunner | null },
): Promise<JobFinalizeResult> {
  const knMode = await resolveKnModeForJob(env, row);

  if (shouldUseStructuredKbDataMode(knMode)) {
    let structuredFallbackError: string | null = null;

    const structuredWritten = await publishStructuredKbWithOptionalRepair(
      env,
      row,
      result,
      knMode,
      options,
    );
    if (structuredWritten.ok) {
      const vDisplay = formatKnVersionDisplay(
        structuredWritten.meta.version,
        structuredWritten.meta.versionLabel,
      );
      const repairNote = structuredWritten.repairAttempted
        ? "（经一次 structured-kb-data repair pass）"
        : "";
      const note =
        `\n\n已通过 **structured-kb-data** 写入**项目知识网络 v${vDisplay}**（Worker 确定性渲染${repairNote}）。`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer.trim() || structuredWritten.summary}${note}`;
      return {
        status: "ok",
        answer,
        knowledgeNetworkHtml: structuredWritten.html,
      };
    }
    if (!structuredWritten.ok && !structuredWritten.skipped) {
      if (structuredWritten.repairNeeded || structuredWritten.qualityBlocked) {
        const label = structuredWritten.repairNeeded ? "repair_needed" : "quality_blocked";
        const repairHint =
          structuredWritten.repairNeeded && !isHermesAgentConfigured(env)
            ? "\n（Hermes 未配置，无法自动 repair；请手动补 JSON 后重试。）"
            : structuredWritten.repairNeeded && structuredWritten.repairAttempted
              ? "\n（已尝试一次自动 repair，仍未达标。）"
              : "";
        return {
          status: "failed",
          error: structuredWritten.error,
          answer:
            `${result.answer.trim() || "Hermes 已结束，但 structured-kb-data 未达发布门槛。"}\n\n` +
            `**结构化 KB ${label}**：${structuredWritten.error}\n` +
            "已保留现有知识网络，未覆盖旧版本。" +
            (structuredWritten.qualityBlocked
              ? "（quality_blocked：相对旧版 coverage 回退）"
              : structuredWritten.repairNeeded
                ? "（repair_needed：须补 JSON 或 repair pass 成功后再入库）"
                : "") +
            repairHint,
        };
      }
    }
    structuredFallbackError =
      structuredWritten.ok || structuredWritten.skipped
        ? null
        : structuredWritten.error;

    const putAccepted = await tryAcceptHermesPutForJob(env, row, result);
    if (putAccepted) {
      return putAccepted;
    }

    const extracted = extractKnHtmlFromResult(result);
    if (extracted) {
      const written = await writeKnowledgeNetworkFromHtml(
        env,
        row,
        extracted,
        "从 Hermes 回复提取 HTML（structured-kb-data fallback）",
        knMode,
      );
      if (written.ok) {
        const note = `\n\n已写入**项目知识网络 v${formatKnVersionDisplay(written.meta.version, written.meta.versionLabel)}**${knowledgeNetworkExtractFallbackNote(env)}`;
        const answer = result.answer.includes("项目知识网络 v")
          ? result.answer
          : `${result.answer}${note}`;
        return { status: "ok", answer, knowledgeNetworkHtml: written.html };
      }
      return {
        status: "failed",
        error: written.error,
        answer:
          `${result.answer.trim() || "Hermes 已结束，但知识网络未通过校验。"}\n\n` +
          `**知识网络校验未通过**：${written.error}\n` +
          (structuredFallbackError
            ? `（structured-kb-data 曾尝试但失败：${structuredFallbackError}）\n`
            : "") +
          "（Worker 不会自动多轮重写；请修正 structured JSON 或按错误重试。）",
      };
    }

    if (structuredFallbackError) {
      return {
        status: "failed",
        error: "知识网络交付失败",
        answer:
          (result.answer.trim() || "Hermes 已结束，但未返回可用知识网络。") +
          `\n\n**structured-kb-data 失败**：${structuredFallbackError}\n` +
          "也未检测到 Hermes PUT 成功或整页 ```html fallback。",
      };
    }

    const answerTrim = result.answer.trim();
    const viaChatFallback = (row.hermes_run_id ?? "").startsWith("chat-fallback-");

    if (
      answerTrim.length >= 200 &&
      !/```(?:json|html)/i.test(answerTrim) &&
      !/<html[\s>]/i.test(answerTrim)
    ) {
      return {
        status: "ok",
        answer:
          answerTrim +
          "\n\n（本条回复**未包含** structured-kb-data JSON 或 ```html 整页，因此**未写入**项目知识网络。若要首次/全量更新，请在回复末尾附 **一个** `type: structured-kb-data` 的 ```json 代码块。）" +
          (viaChatFallback
            ? "\n\n（当前为聊天兼容模式，无法 curl PUT，JSON 或 HTML 代码块为唯一交付方式。）"
            : ""),
        knowledgeNetworkHtml: null,
      };
    }

    return {
      status: "failed",
      error: "知识网络交付失败",
      answer:
        (answerTrim || "Hermes 已结束，但未返回可用知识网络。") +
        "\n\n首次/全量须在回复末尾附 **structured-kb-data** JSON（```json，`type: structured-kb-data`）；若 JSON 无法交付，可 fallback 为 Hermes PUT 或整页 ```html。" +
        (viaChatFallback
          ? "\n\n（当前为聊天兼容模式，无法 curl，代码块为唯一交付方式。）"
          : ""),
    };
  }

  // incremental / reorder：PUT 优先，再 fragment incremental / structured patch / slot-html
  const putAccepted = await tryAcceptHermesPutForJob(env, row, result);
  if (putAccepted) {
    return putAccepted;
  }

  const fragmentWritten = await tryWriteKnowledgeNetworkFromKbFragmentIncremental(
    env,
    row,
    result,
    knMode,
  );
  if (fragmentWritten.ok) {
    const vDisplay = formatKnVersionDisplay(
      fragmentWritten.meta.version,
      fragmentWritten.meta.versionLabel,
    );
    const note =
      `\n\n已通过 **kb-fragment-batch incremental** 写入**项目知识网络 v${vDisplay}**（仅更新 \`${fragmentWritten.slot}\`）。`;
    const answer = result.answer.includes("项目知识网络 v")
      ? result.answer
      : `${result.answer.trim() || fragmentWritten.summary}${note}`;
    return {
      status: "ok",
      answer,
      knowledgeNetworkHtml: fragmentWritten.html,
    };
  }
  const fragmentFallbackError =
    !fragmentWritten.ok && !fragmentWritten.skipped && "error" in fragmentWritten
      ? fragmentWritten.error
      : null;

  const structuredWritten = await tryWriteKnowledgeNetworkFromStructuredSlotPatch(
    env,
    row,
    result,
    knMode,
  );
  if (structuredWritten.ok) {
    const vDisplay = formatKnVersionDisplay(
      structuredWritten.meta.version,
      structuredWritten.meta.versionLabel,
    );
    const note =
      `\n\n已通过 **structured slot patch** 写入**项目知识网络 v${vDisplay}**（仅更新 \`${structuredWritten.slot}\`）。`;
    const answer = result.answer.includes("项目知识网络 v")
      ? result.answer
      : `${result.answer.trim() || structuredWritten.summary}${note}`;
    return {
      status: "ok",
      answer,
      knowledgeNetworkHtml: structuredWritten.html,
    };
  }
  if ("blocked" in structuredWritten && structuredWritten.blocked) {
    const existingHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
    const note = `\n\n⚠️ **未写入知识网络**：${structuredWritten.reason}`;
    return {
      status: "ok",
      answer: result.answer.includes("未写入知识网络")
        ? result.answer
        : `${result.answer.trim()}${note}`,
      knowledgeNetworkHtml: existingHtml,
    };
  }
  const structuredFallbackError =
    !structuredWritten.ok && "error" in structuredWritten && !("skipped" in structuredWritten && structuredWritten.skipped)
      ? structuredWritten.error
      : null;

  const patchWritten = await tryWriteKnowledgeNetworkFromSlotPatch(
    env,
    row,
    result,
    knMode,
  );
  if (patchWritten.ok) {
    const vDisplay = formatKnVersionDisplay(
      patchWritten.meta.version,
      patchWritten.meta.versionLabel,
    );
    const note =
      `\n\n已通过 **slot-html-patch（兼容）** 写入**项目知识网络 v${vDisplay}**（仅更新 \`${patchWritten.slot}\`）。`;
    const answer = result.answer.includes("项目知识网络 v")
      ? result.answer
      : `${result.answer.trim() || patchWritten.summary}${note}`;
    return {
      status: "ok",
      answer,
      knowledgeNetworkHtml: patchWritten.html,
    };
  }
  const patchFallbackError =
    patchWritten.skipped && !fragmentFallbackError && !structuredFallbackError
      ? null
      : patchWritten.skipped
        ? fragmentFallbackError ?? structuredFallbackError
        : patchWritten.error ?? fragmentFallbackError ?? structuredFallbackError;

  // 路径 B：从 Hermes 回复提取整页 HTML 写入（PUT / slot patch 失败时的 fallback）
  const extracted = extractKnHtmlFromResult(result);
  if (extracted) {
    const knMode =
      row.skill_intent === "knowledge_network"
        ? await resolveKnModeForJob(env, row)
        : "incremental";
    const written = await writeKnowledgeNetworkFromHtml(
      env,
      row,
      extracted,
      "从 Hermes 回复提取 HTML",
      knMode,
    );
    if (written.ok) {
      const note = `\n\n已写入**项目知识网络 v${formatKnVersionDisplay(written.meta.version, written.meta.versionLabel)}**${knowledgeNetworkExtractFallbackNote(env)}`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer}${note}`;
      return { status: "ok", answer, knowledgeNetworkHtml: written.html };
    }
    return {
      status: "failed",
      error: written.error,
      answer:
        `${result.answer.trim() || "Hermes 已结束，但知识网络未通过校验。"}\n\n` +
        `**知识网络校验未通过**：${written.error}\n` +
        (patchFallbackError
          ? `（structured/slot patch 曾尝试但失败：${patchFallbackError}）\n`
          : "") +
        "（Worker 不会自动多轮重写；请按错误修正相关 slot 后重试，勿重复整页生成。）",
    };
  }

  if (patchFallbackError) {
    return {
      status: "failed",
      error: "知识网络交付失败",
      answer:
        (result.answer.trim() || "Hermes 已结束，但未返回可用知识网络。") +
        `\n\n**structured/slot patch 失败**：${patchFallbackError}\n` +
        "也未检测到可用的整页 ```html fallback。",
    };
  }

  const answerTrim = result.answer.trim();
  const viaChatFallback = (row.hermes_run_id ?? "").startsWith("chat-fallback-");

  /** 模型只回了文字（总结/分析）未贴 HTML：勿标「交付失败」，避免与「阅读/总结」类误触发混淆 */
  if (
    answerTrim.length >= 200 &&
    !/```html|<html[\s>]/i.test(answerTrim)
  ) {
    return {
      status: "ok",
      answer:
        answerTrim +
        "\n\n（本条回复**未包含** ```html 整页，因此**未写入**项目知识网络。若你只想查看或总结已有版本，请直接问「简单总结一下知识网络内容」或到项目详情预览；若要更新 HTML，请使用「生成/按板块更新/全量重做」等明确话术。）" +
        (viaChatFallback
          ? "\n\n（当前为聊天兼容模式，无法 curl PUT，生成 HTML 时须在回复末尾附整页代码块。）"
          : ""),
      knowledgeNetworkHtml: null,
    };
  }

  return {
    status: "failed",
    error: "知识网络交付失败",
    answer:
      (answerTrim || "Hermes 已结束，但未返回可用知识网络。") +
      "\n\n本条回复须在同一次交付末尾附完整 ```html 整页（含 <!DOCTYPE），平台才能预览并写入项目知识网络。" +
      (viaChatFallback
        ? "\n\n（当前为聊天兼容模式，无法 curl，代码块为唯一交付方式。）"
        : ""),
  };
}

async function finalizeJobResult(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<JobFinalizeResult> {
  if (row.skill_intent !== "knowledge_network") {
    return {
      status: "ok",
      answer: result.answer,
      knowledgeNetworkHtml: result.knowledgeNetworkHtml,
    };
  }
  return finalizeKnowledgeNetworkJobResult(env, row, result);
}

export async function createAgentJob(
  env: AgentJobEnv,
  row: {
    id: string;
    projectId: string;
    userId: string;
    conversationId?: string;
    skillIntent: SkillIntent;
  },
): Promise<void> {
  const t = nowIso();
  await env.DB.prepare(
    `INSERT INTO agent_jobs (
      id, project_id, user_id, conversation_id, skill_intent, status,
      hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, ?)`,
  )
    .bind(
      row.id,
      row.projectId,
      row.userId,
      row.conversationId ?? null,
      row.skillIntent,
      t,
      t,
    )
    .run();
}

export async function markAgentJobRunning(
  env: AgentJobEnv,
  jobId: string,
  hermesRunId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'running', hermes_run_id = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(hermesRunId, nowIso(), jobId)
    .run();
}

export async function completeAgentJob(
  env: AgentJobEnv,
  jobId: string,
  result: { answer: string; knowledgeNetworkHtml: string | null },
  tokenUsage?: AgentJobTokenUsage,
): Promise<void> {
  const rowBefore = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();

  if (!rowBefore) return;

  if (!shouldAcceptAgentJobCompletion(rowBefore.status)) {
    return;
  }

  const finalized = await finalizeJobResult(env, rowBefore, result);

  if (finalized.status === "failed") {
    await failAgentJob(env, jobId, finalized.error, finalized.answer);
    return;
  }

  const displayAnswer = stripStructuredKbPayloadFromDisplayAnswer(finalized.answer);

  try {
    await recordAgentJobTokenUsage(env, rowBefore, displayAnswer, tokenUsage);
  } catch {
    /* 计量失败不阻断任务收尾 */
  }

  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'completed', answer = ?, knowledge_network_html = ?, error = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(displayAnswer, finalized.knowledgeNetworkHtml, nowIso(), jobId)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();
  if (row) {
    await syncAgentJobTerminalToChat(env, row, {
      answer: displayAnswer,
      knowledgeNetworkHtml: finalized.knowledgeNetworkHtml,
    });
  }
}

export async function failAgentJob(
  env: AgentJobEnv,
  jobId: string,
  error: string,
  answerForChat?: string | null,
): Promise<void> {
  const rowBefore = await getAgentJobById(env, jobId);
  if (rowBefore && !shouldAcceptAgentJobCompletion(rowBefore.status)) {
    return;
  }

  const rawAnswer = (answerForChat ?? "").trim() || `深度分析失败：${error}`;
  const answer = stripStructuredKbPayloadFromDisplayAnswer(rawAnswer);

  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'failed', error = ?, answer = ?, knowledge_network_html = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(error, answer, nowIso(), jobId)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();

  if (row?.conversation_id) {
    await syncAgentJobTerminalToChat(env, row, {
      answer,
      knowledgeNetworkHtml: null,
    });
  }
}

export type CancelAgentJobResult =
  | { ok: true; job: AgentJobRow; hermesCancelAttempted: boolean }
  | { ok: false; error: string; status?: number };

/** 用户主动取消进行中的 Hermes / 深度任务 */
export async function cancelAgentJob(
  env: AgentJobEnv,
  jobId: string,
  userId: string,
): Promise<CancelAgentJobResult> {
  const row = await getAgentJob(env, jobId, userId);
  if (!row) {
    return { ok: false, error: "任务不存在或无权访问", status: 404 };
  }
  if (!isAgentJobActive(row.status)) {
    return { ok: false, error: `任务已结束（${row.status}）`, status: 409 };
  }

  let hermesCancelAttempted = false;
  const runId = (row.hermes_run_id ?? "").trim();
  if (runId && !runId.startsWith("chat-fallback-") && isHermesAgentConfigured(env)) {
    hermesCancelAttempted = true;
    try {
      await cancelHermesRun(env, runId);
    } catch {
      /* 本地终态优先 */
    }
  }

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'cancelled', error = ?, answer = ?, knowledge_network_html = NULL, updated_at = ? WHERE id = ? AND user_id = ?`,
  )
    .bind("用户取消", AGENT_JOB_CANCELLED_MESSAGE, now, jobId, userId)
    .run();

  const updated = await getAgentJob(env, jobId, userId);
  if (!updated) {
    return { ok: false, error: "取消后读取任务失败", status: 500 };
  }

  if (updated.conversation_id) {
    await syncAgentJobTerminalToChat(env, updated, {
      answer: AGENT_JOB_CANCELLED_MESSAGE,
      knowledgeNetworkHtml: null,
    });
  }

  return { ok: true, job: updated, hermesCancelAttempted };
}

export async function getAgentJob(
  env: AgentJobEnv,
  jobId: string,
  userId: string,
): Promise<AgentJobRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ? AND user_id = ?`,
  )
    .bind(jobId, userId)
    .first<AgentJobRow>();
  return row ?? null;
}

export async function getAgentJobById(
  env: AgentJobEnv,
  jobId: string,
): Promise<AgentJobRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();
  return row ?? null;
}

/**
 * Hermes 已通过 curl PUT 写入 KB，但 agent_jobs 仍 running 时收尾（waitUntil 丢失或 Run 未终态）。
 */
export async function finalizeAgentJobAfterKnPut(
  env: AgentJobEnv,
  jobId: string,
  answerSummary?: string,
): Promise<boolean> {
  const row = await getAgentJobById(env, jobId);
  if (!row || !isAgentJobActive(row.status)) return false;
  if (row.skill_intent !== "knowledge_network") return false;

  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  if (meta?.lastJobId !== jobId) return false;

  const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  if (!html?.trim()) return false;

  const summary = (answerSummary ?? "Hermes 文件回传").trim();
  const note = `\n\n已同步至**项目知识网络 v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（文件 API 回传，可在项目详情预览）。`;
  const answer = summary.includes("项目知识网络 v") ? summary : `${summary}${note}`;

  await completeAgentJob(env, jobId, { answer, knowledgeNetworkHtml: html });
  return true;
}

/** 聊天兼容模式后台最长等待 + 宽限 */
const CHAT_FALLBACK_STALE_MS = 17 * 60_000;
/** 超过此时长仍为 pending/running 则强制收尾（避免 D1 僵尸） */
const ZOMBIE_ABSOLUTE_MS = 24 * 60 * 60_000;

const RUN_NOT_FOUND_RE = /run not found|not found:/i;

function jobAgeMs(row: AgentJobRow): number {
  const t = Date.parse(row.created_at);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Date.now() - t);
}

async function reloadAgentJob(env: AgentJobEnv, jobId: string): Promise<AgentJobRow | null> {
  return getAgentJobById(env, jobId);
}

/** 轮询 / 列表 active jobs 时同步 Hermes 终态、KN PUT 收尾，并清理超时/僵尸任务。 */
export type ReconcileAgentJobOptions = {
  /** Poll API 用：Hermes 状态查询最长等待（毫秒），0 = 不限制 */
  hermesPollTimeoutMs?: number;
};

export async function reconcileAgentJob(
  env: AgentJobEnv,
  row: AgentJobRow,
  options?: ReconcileAgentJobOptions,
): Promise<{ row: AgentJobRow; hermesStatus: string | null; slotBatchProgress?: Awaited<ReturnType<typeof getKnSlotBatchProgress>> }> {
  if (!isAgentJobActive(row.status)) {
    return { row, hermesStatus: null };
  }

  const slotSession = await readKnSlotBatchSession(env, row.project_id, row.id);
  if (slotSession) {
    try {
      const adv = await advanceKnSlotBatchJob(env, row, {
        pollTimeoutMs: options?.hermesPollTimeoutMs ?? 8_000,
      });
      const updated = await reloadAgentJob(env, row.id);
      const progress = await getKnSlotBatchProgress(
        env,
        row.project_id,
        row.id,
        adv.action === "continue" ? (adv.hermesStatus ?? "running") : adv.action,
      );
      if (adv.action === "completed") {
        return { row: updated ?? row, hermesStatus: "completed", slotBatchProgress: progress };
      }
      if (adv.action === "failed") {
        return { row: updated ?? row, hermesStatus: "failed", slotBatchProgress: progress };
      }
      if (adv.action === "continue") {
        return {
          row: updated ?? row,
          hermesStatus: adv.hermesStatus ?? "running",
          slotBatchProgress: progress,
        };
      }
      return { row: updated ?? row, hermesStatus: null, slotBatchProgress: progress };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await recordKnSlotBatchReconcileFailure(env, row, errMsg);
      const updated = await reloadAgentJob(env, row.id);
      const progress = await getKnSlotBatchProgress(env, row.project_id, row.id, "failed");
      return { row: updated ?? row, hermesStatus: "failed", slotBatchProgress: progress };
    }
  }

  if (row.skill_intent === "knowledge_network") {
    const finalized = await finalizeAgentJobAfterKnPut(env, row.id);
    if (finalized) {
      const updated = await reloadAgentJob(env, row.id);
      return { row: updated ?? row, hermesStatus: "completed" };
    }
  }

  const runId = (row.hermes_run_id ?? "").trim();
  const ageMs = jobAgeMs(row);

  /** 旧 monolithic full JSON 任务：超过 35 分钟仍 running → 僵尸失败（无 R2 slot-batch session） */
  const KN_MONOLITHIC_STALE_MS = 35 * 60_000;
  if (
    row.skill_intent === "knowledge_network" &&
    !slotSession &&
    ageMs > KN_MONOLITHIC_STALE_MS &&
    !runId.includes("jfo-kn-batch-")
  ) {
    await failAgentJob(
      env,
      row.id,
      "全量 monolithic 任务超时（已切换 slot-batched 生成；请重新发起全量重做）",
    );
    const updated = await reloadAgentJob(env, row.id);
    return { row: updated ?? row, hermesStatus: "failed" };
  }

  if (runId.startsWith("chat-fallback-")) {
    if (ageMs > CHAT_FALLBACK_STALE_MS) {
      await failAgentJob(
        env,
        row.id,
        "聊天兼容模式任务超时（后台未在时限内完成）",
      );
      const updated = await reloadAgentJob(env, row.id);
      return { row: updated ?? row, hermesStatus: "failed" };
    }
    return { row, hermesStatus: null };
  }

  if (runId && isHermesAgentConfigured(env)) {
    try {
      const pollTimeout = options?.hermesPollTimeoutMs ?? 0;
      const snap = await pollHermesRun(env, runId, { timeoutMs: pollTimeout });
      const hermesStatus = snap.status;
      const terminal = new Set(["completed", "failed", "cancelled"]);
      const errText = (snap.error ?? "").trim();

      if (snap.status === "completed") {
        const intent = row.skill_intent as SkillIntent;
        const finalized = finalizeHermesOutput(snap.output, intent);
        const parsedUsage = parseUsageFromHermesRunRaw(snap.raw);
        const tokenUsage: AgentJobTokenUsage | undefined = parsedUsage
          ? {
              promptTokens: parsedUsage.promptTokens,
              completionTokens: parsedUsage.completionTokens,
              isEstimated: false,
              model: "hermes-agent",
            }
          : undefined;
        await completeAgentJob(env, row.id, finalized, tokenUsage);
        const updated = await reloadAgentJob(env, row.id);
        return { row: updated ?? row, hermesStatus: "completed" };
      }

      if (terminal.has(snap.status)) {
        if (snap.status === "cancelled") {
          const now = nowIso();
          await env.DB.prepare(
            `UPDATE agent_jobs SET status = 'cancelled', error = ?, answer = ?, knowledge_network_html = NULL, updated_at = ? WHERE id = ?`,
          )
            .bind("用户取消", AGENT_JOB_CANCELLED_MESSAGE, now, row.id)
            .run();
          const updated = await reloadAgentJob(env, row.id);
          if (updated?.conversation_id) {
            await syncAgentJobTerminalToChat(env, updated, {
              answer: AGENT_JOB_CANCELLED_MESSAGE,
              knowledgeNetworkHtml: null,
            });
          }
          return { row: updated ?? row, hermesStatus: snap.status };
        }
        await failAgentJob(env, row.id, errText || `Hermes 任务结束：${snap.status}`);
        const updated = await reloadAgentJob(env, row.id);
        return { row: updated ?? row, hermesStatus: snap.status };
      }

      if (errText && RUN_NOT_FOUND_RE.test(errText)) {
        await failAgentJob(env, row.id, errText);
        const updated = await reloadAgentJob(env, row.id);
        return { row: updated ?? row, hermesStatus: "failed" };
      }

      if (ageMs > ZOMBIE_ABSOLUTE_MS) {
        await failAgentJob(env, row.id, "任务已超过 24 小时仍未完成，已自动关闭");
        const updated = await reloadAgentJob(env, row.id);
        return { row: updated ?? row, hermesStatus: "failed" };
      }

      return { row, hermesStatus };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (ageMs > ZOMBIE_ABSOLUTE_MS || RUN_NOT_FOUND_RE.test(msg)) {
        await failAgentJob(env, row.id, msg);
        const updated = await reloadAgentJob(env, row.id);
        return { row: updated ?? row, hermesStatus: "failed" };
      }
      return { row, hermesStatus: null };
    }
  }

  if (ageMs > ZOMBIE_ABSOLUTE_MS) {
    await failAgentJob(env, row.id, "任务已过期（无引擎 Run 记录）");
    const updated = await reloadAgentJob(env, row.id);
    return { row: updated ?? row, hermesStatus: "failed" };
  }

  return { row, hermesStatus: null };
}

/** 拉取 active-agent-jobs 前先 reconcile，避免把僵尸任务返回给前端 */
export async function reconcileActiveAgentJobsForUser(
  env: AgentJobEnv,
  userId: string,
): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id FROM agent_jobs WHERE user_id = ? AND status IN ('pending', 'running')`,
  )
    .bind(userId)
    .all<{ id: string }>();

  for (const r of results ?? []) {
    const row = await getAgentJobById(env, r.id);
    if (row) await reconcileAgentJob(env, row);
  }
}
