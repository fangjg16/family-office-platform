import type { AgentJobRow } from "./agent-jobs";
import { createAgentJob, getAgentJob, getAgentJobById, isAgentJobActive, markAgentJobRunning } from "./agent-jobs";
import type { HermesAgentEnv } from "./hermes-agent";
import { isHermesAgentConfigured, pollHermesRun, startHermesRun, waitForHermesRun, cancelHermesRun, isHermesCapacityError } from "./hermes-agent";
import {
  resolveMaxParallelStartsPerInvocation,
  resolveParallelBatchLimit,
  type SlotBatchArchitecture,
} from "./knowledge-network-slot-batch-config";
import { assembleKbFromFragmentSession } from "./knowledge-network-fragment-assembler";
import { formatWorkerStubAuditAnswerBlock } from "./knowledge-network-fragment-stub-audit";
import { mergeFragmentBatchIntoSession } from "./knowledge-network-fragment-merge";
import { buildMinimalFragmentBatchRepairPrompt } from "./knowledge-network-fragment-batch-instructions";
import {
  isFragmentGenerationSession,
  resolveKnGenerationMode,
} from "./knowledge-network-generation-mode";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import { syncAgentJobTerminalToChat } from "./chat-sync";
import {
  buildSlotBatchHermesInstructionsPackage,
  mergeSourcesIntoRegistry,
} from "./knowledge-network-slot-batch-instructions";
import { buildPrepSharedContextBlock, runKnSlotBatchPreprocess } from "./knowledge-network-slot-batch-prep";
import { buildSlotMaturitySummaryText } from "./knowledge-network-slot-maturity-summary";
import {
  rejectInventedFinalSourceIds,
  resolveEvidenceSourceRefsInSlots,
} from "./knowledge-network-source-ref-resolve";
import {
  mergeSourceProposalsIntoRegistry,
  type SourceProposalInput,
} from "./knowledge-network-source-proposals";
import { collectEvidenceSourceIds } from "./knowledge-network-slot-payload-validation";
import { buildMinimalSlotBatchRepairPrompt } from "./knowledge-network-slot-batch-minimal-repair";
import {
  buildMergeRowRepairHint,
  evaluateSlotPayloadMergeHardIssues,
  normalizeSlotForMerge,
} from "./knowledge-network-slot-merge-validation";
import { mergeHardIssuesFromNormalized } from "./knowledge-network-slot-normalizer";
import { HARD_SLOT_ISSUE_CODE_SET } from "./knowledge-network-hard-issue-codes";
import { CANONICAL_KB_SLOTS, validateKnowledgeNetworkHtmlForWrite } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { evaluateSlotQuality } from "./knowledge-network-full-quality-contract";
import { extractStructuredSlotBatchFromAnswer } from "./knowledge-network-slot-batch-extract";
import {
  deleteKnSlotBatchSession,
  readKnSlotBatchSession,
  writeKnSlotBatchSession,
} from "./knowledge-network-slot-batch-session";
import {
  KN_SLOT_BATCH_PLAN,
  type KnSlotBatchRunState,
  type KnPublishStep,
  type KnSlotBatchSession,
  type KnSlotQualityRecord,
} from "./knowledge-network-slot-batch-types";
import {
  applyDeterministicMaturity,
  evaluateStructuredKbPublishGate,
  renderStructuredKbDataToHtml,
} from "./knowledge-network-structured-kb-data";
import type { StructuredKbData, StructuredKbSlots } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";
import { formatKnVersionDisplay, resolveKnVersionOnUpload } from "./knowledge-network-version";
import {
  isKnRenderGapTypeError,
  knPublishFailedAnswer,
  knPublishFailedStoredError,
  KN_RENDER_GAP_TYPE_ERROR_CODE,
} from "./knowledge-network-gap-callouts";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";

export type SlotBatchOrchestratorEnv = HermesAgentEnv & {
  FILES: R2Bucket;
  DB: D1Database;
};

function nowIso(): string {
  return new Date().toISOString();
}

const PUBLISH_STEP_TIMEOUT_MS = 90_000;

async function setPublishStep(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  step: KnPublishStep,
): Promise<void> {
  session.currentPublishStep = step;
  session.publishStepStartedAt = nowIso();
  if (!session.publishStartedAt) {
    session.publishStartedAt = session.publishStepStartedAt;
  }
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);
}

async function withPublishStepTimeout<T>(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  step: KnPublishStep,
  fn: () => Promise<T>,
): Promise<T> {
  await setPublishStep(env, session, step);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`publishing 步骤 ${step} 超过 ${PUBLISH_STEP_TIMEOUT_MS / 1000}s`));
        }, PUBLISH_STEP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function failPublishPipeline(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  jobId: string,
  step: KnPublishStep,
  error: string,
): Promise<SlotBatchAdvanceResult> {
  session.phase = "failed";
  session.currentPublishStep = "failed";
  session.publishError = `${step}: ${error}`;
  session.lastError = session.publishError;
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);
  await failSlotBatchJob(env, jobId, session.publishError);
  return { action: "failed", error: session.publishError };
}

async function runKnFragmentBatchPublishing(
  env: SlotBatchOrchestratorEnv,
  row: AgentJobRow,
  session: KnSlotBatchSession,
): Promise<SlotBatchAdvanceResult> {
  session.phase = "publishing";
  await writeKnSlotBatchSession(env, session);

  const prevKn = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const nextVer = resolveKnVersionOnUpload(prevKn, null);
  const versionDisplay = formatKnVersionDisplay(nextVer.version, nextVer.versionLabel);

  let renderedHtml: string;
  try {
    renderedHtml = await withPublishStepTimeout(env, session, "assembling", async () => {
      const assembled = assembleKbFromFragmentSession(session, { versionDisplay });
      if (!assembled.ok) {
        throw new Error(assembled.error);
      }
      session.assembledHtmlBytes = assembled.html.length;
      await writeKnSlotBatchSession(env, session);
      return assembled.html;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "assembling", msg);
  }

  let previousHtml: string | null;
  try {
    previousHtml = await withPublishStepTimeout(env, session, "quality_gate", async () =>
      readProjectKnowledgeNetworkHtml(env, row.project_id),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "quality_gate", msg);
  }

  let htmlToStore: string;
  try {
    htmlToStore = await withPublishStepTimeout(env, session, "validating_html", async () => {
      const validation = validateKnowledgeNetworkHtmlForWrite(renderedHtml, {
        mode: session.mode,
        previousHtml,
        strict: true,
        touchesTimeline: /id=["']timeline-milestones["']/i.test(renderedHtml),
        browserUpload: false,
      });
      if (!validation.ok) {
        throw new Error(validation.error ?? "HTML 校验失败");
      }
      return validation.html ?? renderedHtml;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "validating_html", msg);
  }

  const summary =
    session.shell.summary ??
    session.batchSummaries.filter(Boolean).join(" ") ??
    "fragment-batched 知识网络";

  try {
    await withPublishStepTimeout(env, session, "writing_r2", async () => {
      await upsertProjectKnowledgeNetwork(env, {
        projectId: row.project_id,
        userId: row.user_id,
        html: htmlToStore,
        lastJobId: row.id,
        answerSummary: summary,
      });
    });
    await setPublishStep(env, session, "updating_d1");
  } catch (e) {
    const step: KnPublishStep =
      session.currentPublishStep === "updating_d1" ? "updating_d1" : "writing_r2";
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, step, msg);
  }

  const timingSummary = session.batchTimings
    .map(
      (t) =>
        `批次${t.batchIndex + 1}（${t.slots.join("+")}）${t.durationMs ? `${Math.round(t.durationMs / 1000)}s` : "—"}`,
    )
    .join("；");
  const stubAudit = formatWorkerStubAuditAnswerBlock(session);
  const answer =
    `${summary}\n\n` +
    `已通过 **kb-fragment-batch**（预处理 + ${KN_SLOT_BATCH_PLAN.length} 批并行 / 13 slot HTML fragment）写入项目知识网络 **v${versionDisplay}**。` +
    `${stubAudit}\n` +
    `批次耗时：${timingSummary}。\n` +
    `Factor A/B/Combined 见页面 maturity 区（fragment 路径由 HTML 入库后展示）。`;

  try {
    await withPublishStepTimeout(env, session, "syncing_chat", async () => {
      await completeSlotBatchJob(env, row.id, { answer, html: htmlToStore });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "syncing_chat", msg);
  }

  session.phase = "done";
  session.currentPublishStep = "completed";
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);

  return { action: "completed", answer, html: htmlToStore };
}

async function runKnSlotBatchPublishing(
  env: SlotBatchOrchestratorEnv,
  row: AgentJobRow,
  session: KnSlotBatchSession,
): Promise<SlotBatchAdvanceResult> {
  if (isFragmentGenerationSession(session)) {
    return runKnFragmentBatchPublishing(env, row, session);
  }
  session.phase = "publishing";
  await writeKnSlotBatchSession(env, session);

  let assembled: StructuredKbData;
  try {
    const data = await withPublishStepTimeout(env, session, "assembling", async () =>
      assembleStructuredKbData(session),
    );
    if (!data) {
      return failPublishPipeline(
        env,
        session,
        row.id,
        "assembling",
        "assemble 失败：缺少 slot payload",
      );
    }
    assembled = data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "assembling", msg);
  }

  let previousHtml: string | null;
  try {
    previousHtml = await withPublishStepTimeout(env, session, "quality_gate", async () => {
      const prev = await readProjectKnowledgeNetworkHtml(env, row.project_id);
      const gate = evaluateStructuredKbPublishGate(assembled, prev);
      if (!gate.ok) {
        throw new Error("message" in gate ? gate.message : "publish gate 未通过");
      }
      return prev;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "quality_gate", msg);
  }

  const prevKn = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const nextVer = resolveKnVersionOnUpload(prevKn, null);

  let renderedHtml: string;
  try {
    renderedHtml = await withPublishStepTimeout(env, session, "rendering_html", async () => {
      const rendered = renderStructuredKbDataToHtml(assembled, {
        versionDisplay: formatKnVersionDisplay(nextVer.version, nextVer.versionLabel),
      });
      if (!rendered.ok) {
        throw new Error(rendered.reason);
      }
      session.assembledHtmlBytes = rendered.html.length;
      await writeKnSlotBatchSession(env, session);
      return rendered.html;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "rendering_html", msg);
  }

  let htmlToStore: string;
  try {
    htmlToStore = await withPublishStepTimeout(env, session, "validating_html", async () => {
      const validation = validateKnowledgeNetworkHtmlForWrite(renderedHtml, {
        mode: session.mode,
        previousHtml,
        strict: true,
        touchesTimeline:
          /id=["']timeline-milestones["']/i.test(renderedHtml),
        browserUpload: false,
      });
      if (!validation.ok) {
        throw new Error(validation.error ?? "HTML 校验失败");
      }
      return validation.html ?? renderedHtml;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "validating_html", msg);
  }

  try {
    await withPublishStepTimeout(env, session, "writing_r2", async () => {
      await upsertProjectKnowledgeNetwork(env, {
        projectId: row.project_id,
        userId: row.user_id,
        html: htmlToStore,
        lastJobId: row.id,
        answerSummary: assembled.summary ?? "slot-batched structured KB",
      });
    });
    await setPublishStep(env, session, "updating_d1");
  } catch (e) {
    const step: KnPublishStep =
      session.currentPublishStep === "updating_d1" ? "updating_d1" : "writing_r2";
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, step, msg);
  }

  const timingSummary = session.batchTimings
    .map(
      (t) =>
        `批次${t.batchIndex + 1}（${t.slots.join("+")}）${t.durationMs ? `${Math.round(t.durationMs / 1000)}s` : "—"}`,
    )
    .join("；");
  const maturityBlock = buildSlotMaturitySummaryText(assembled);
  const answer =
    `${assembled.summary ?? "知识网络 slot-batched 生成完成"}\n\n` +
    `已通过 **structured-slot-batch**（预处理 + ${KN_SLOT_BATCH_PLAN.length} 批并行 / 13 slot）写入项目知识网络 **v${formatKnVersionDisplay(nextVer.version, nextVer.versionLabel)}**。\n` +
    `批次耗时：${timingSummary}。\n` +
    `Factor A/B/Combined 由 Worker 在入库后轻量计算（13-slot Evidence Maturity + Source Diversity），见页面 maturity 区。\n\n` +
    maturityBlock;

  try {
    await withPublishStepTimeout(env, session, "syncing_chat", async () => {
      await completeSlotBatchJob(env, row.id, { answer, html: htmlToStore });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failPublishPipeline(env, session, row.id, "syncing_chat", msg);
  }

  session.phase = "done";
  session.currentPublishStep = "completed";
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);

  return { action: "completed", answer, html: htmlToStore };
}

async function failSlotBatchJob(
  env: SlotBatchOrchestratorEnv,
  jobId: string,
  error: string,
  options?: { answer?: string; errorCode?: string },
): Promise<void> {
  const errorCode =
    options?.errorCode ??
    (isKnRenderGapTypeError(error) ? KN_RENDER_GAP_TYPE_ERROR_CODE : undefined);
  const storedError = errorCode ? knPublishFailedStoredError(error, errorCode) : error;
  const answer = options?.answer ?? knPublishFailedAnswer(storedError);
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'failed', error = ?, answer = ?, knowledge_network_html = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(storedError, answer, nowIso(), jobId)
    .run();
  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();
  if (row?.conversation_id) {
    await syncAgentJobTerminalToChat(env, row, { answer, knowledgeNetworkHtml: null });
  }
}

async function completeSlotBatchJob(
  env: SlotBatchOrchestratorEnv,
  jobId: string,
  result: { answer: string; html: string },
): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'completed', answer = ?, knowledge_network_html = ?, error = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(result.answer, result.html, nowIso(), jobId)
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
      answer: result.answer,
      knowledgeNetworkHtml: result.html,
    });
  }
}

export function shouldUseSlotBatchGeneration(mode: string): boolean {
  return mode === "full" || mode === "initial";
}

export { readKnSlotBatchSession } from "./knowledge-network-slot-batch-session";

export async function initKnSlotBatchSession(params: {
  env: SlotBatchOrchestratorEnv;
  jobId: string;
  projectId: string;
  userId: string;
  conversationId: string;
  mode: "initial" | "full";
  projectTitle: string;
  userMessage: string;
  architecture?: SlotBatchArchitecture;
}): Promise<KnSlotBatchSession> {
  const arch = params.architecture ?? "v2";
  const isV2 = arch === "v2";
  const now = nowIso();
  const generationMode = resolveKnGenerationMode(params.env, {
    userMessage: params.userMessage,
  });
  const session: KnSlotBatchSession = {
    version: isV2 ? 2 : 1,
    architectureVersion: isV2 ? 2 : undefined,
    parallelMode: isV2,
    parallelLimit: isV2 ? resolveParallelBatchLimit(params.env) : undefined,
    jobId: params.jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    mode: params.mode,
    projectTitle: params.projectTitle,
    userMessage: params.userMessage,
    currentBatchIndex: 0,
    phase: isV2 ? "preprocessing" : "waiting_hermes",
    shell: {},
    slots: {},
    fragments: {},
    appendixFragments: {},
    generationMode,
    fragmentDelivery: {},
    workerStubSlots: [],
    workerStubAppendix: [],
    slotQuality: {},
    batchTimings: [],
    batchRepairAttempts: {},
    batchSummaries: [],
    unresolvedGaps: [],
    sourceRegistry: [],
    batchRuns: [],
    pendingSourceProposals: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeKnSlotBatchSession(params.env, session);
  return session;
}

export type Batch1SharedContextFixture = {
  projectId: string;
  projectTitle: string;
  mode: "initial" | "full";
  userMessage: string;
  shell: KnSlotBatchSession["shell"];
  batchSummaries?: string[];
  slots: Partial<{ [K in CanonicalKbSlot]: SlotPayloadBySlot[K] }>;
  slotQuality?: Partial<Record<CanonicalKbSlot, KnSlotQualityRecord>>;
  unresolvedGaps?: string[];
};

/** Batch 2 smoke：注入 batch 1 shared context，直接从 batchIndex=1 启动 Hermes */
export async function initKnSlotBatchBatch2Smoke(params: {
  env: SlotBatchOrchestratorEnv;
  jobId: string;
  projectId: string;
  userId: string;
  conversationId: string;
  fixture: Batch1SharedContextFixture;
}): Promise<KnSlotBatchSession> {
  const now = nowIso();
  const session: KnSlotBatchSession = {
    version: 1,
    jobId: params.jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    mode: params.fixture.mode,
    projectTitle: params.fixture.projectTitle,
    userMessage: params.fixture.userMessage,
    currentBatchIndex: 1,
    phase: "between_batches",
    shell: { ...params.fixture.shell },
    slots: { ...params.fixture.slots },
    slotQuality: { ...(params.fixture.slotQuality ?? {}) },
    batchTimings: [
      {
        batchIndex: 0,
        slots: [...KN_SLOT_BATCH_PLAN[0]!],
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      },
    ],
    batchRepairAttempts: {},
    batchSummaries: [...(params.fixture.batchSummaries ?? [])],
    unresolvedGaps: [...(params.fixture.unresolvedGaps ?? [])],
    sourceRegistry: params.fixture.shell.sources ?? [],
    smokeBatch2Only: true,
    createdAt: now,
    updatedAt: now,
  };
  await writeKnSlotBatchSession(params.env, session);
  return session;
}

export async function startKnSlotBatchBatch2SmokeJob(
  env: SlotBatchOrchestratorEnv,
  params: {
    projectId: string;
    userId: string;
    conversationId: string;
    fixture: Batch1SharedContextFixture;
    projectTitle?: string;
  },
): Promise<
  | { ok: true; jobId: string; session: KnSlotBatchSession }
  | { ok: false; error: string }
> {
  if (!isHermesAgentConfigured(env)) {
    return { ok: false, error: "Hermes 未配置" };
  }
  const jobId = crypto.randomUUID();
  const fixture = {
    ...params.fixture,
    projectId: params.projectId,
    projectTitle: params.projectTitle ?? params.fixture.projectTitle,
  };
  await createAgentJob(env, {
    id: jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    skillIntent: "knowledge_network",
  });
  const session = await initKnSlotBatchBatch2Smoke({
    env,
    jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    fixture,
  });
  const started = await startBatchHermesRun(env, session, 1);
  if (!started.ok) {
    await deleteKnSlotBatchSession(env, params.projectId, jobId);
    return { ok: false, error: started.error };
  }
  await markAgentJobRunning(env, jobId, started.runId);
  return { ok: true, jobId, session };
}

/** Batch 3 smoke：注入 batch 1+2 shared context，从 batchIndex=2 启动 Hermes */
export async function initKnSlotBatchBatch3Smoke(params: {
  env: SlotBatchOrchestratorEnv;
  jobId: string;
  projectId: string;
  userId: string;
  conversationId: string;
  fixture: Batch1SharedContextFixture;
}): Promise<KnSlotBatchSession> {
  const now = nowIso();
  const session: KnSlotBatchSession = {
    version: 1,
    jobId: params.jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    mode: params.fixture.mode,
    projectTitle: params.fixture.projectTitle,
    userMessage: params.fixture.userMessage,
    currentBatchIndex: 2,
    phase: "between_batches",
    shell: { ...params.fixture.shell },
    slots: { ...params.fixture.slots },
    slotQuality: { ...(params.fixture.slotQuality ?? {}) },
    batchTimings: [
      {
        batchIndex: 0,
        slots: [...KN_SLOT_BATCH_PLAN[0]!],
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        jsonParsed: true,
        repairJsonValid: null,
      },
      {
        batchIndex: 1,
        slots: [...KN_SLOT_BATCH_PLAN[1]!],
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        jsonParsed: true,
        repairJsonValid: null,
      },
    ],
    batchRepairAttempts: {},
    batchSummaries: [...(params.fixture.batchSummaries ?? [])],
    unresolvedGaps: [...(params.fixture.unresolvedGaps ?? [])],
    sourceRegistry: params.fixture.shell.sources ?? [],
    smokeBatch3Only: true,
    createdAt: now,
    updatedAt: now,
  };
  await writeKnSlotBatchSession(params.env, session);
  return session;
}

export async function startKnSlotBatchBatch3SmokeJob(
  env: SlotBatchOrchestratorEnv,
  params: {
    projectId: string;
    userId: string;
    conversationId: string;
    fixture: Batch1SharedContextFixture;
    projectTitle?: string;
  },
): Promise<
  | { ok: true; jobId: string; session: KnSlotBatchSession }
  | { ok: false; error: string }
> {
  if (!isHermesAgentConfigured(env)) {
    return { ok: false, error: "Hermes 未配置" };
  }
  const jobId = crypto.randomUUID();
  const fixture = {
    ...params.fixture,
    projectId: params.projectId,
    projectTitle: params.projectTitle ?? params.fixture.projectTitle,
  };
  await createAgentJob(env, {
    id: jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    skillIntent: "knowledge_network",
  });
  const session = await initKnSlotBatchBatch3Smoke({
    env,
    jobId,
    projectId: params.projectId,
    userId: params.userId,
    conversationId: params.conversationId,
    fixture,
  });
  const started = await startBatchHermesRun(env, session, 2);
  if (!started.ok) {
    await deleteKnSlotBatchSession(env, params.projectId, jobId);
    return { ok: false, error: started.error };
  }
  await markAgentJobRunning(env, jobId, started.runId);
  return { ok: true, jobId, session };
}

export async function startBatchHermesRun(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  batchIndex: number,
  options?: { repairHints?: string; userMessageOverride?: string },
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  let hasExistingKb = false;
  try {
    const meta = await getProjectKnowledgeNetworkMeta(env, session.projectId);
    hasExistingKb = Boolean(meta);
  } catch {
    hasExistingKb = false;
  }
  session.currentBatchIndex = batchIndex;
  const pkg = await buildSlotBatchHermesInstructionsPackage(env, session, batchIndex, {
    projectTitle: session.projectTitle,
    hasExistingKb,
    repairHints: options?.repairHints,
  });
  session.lastReadPlan = pkg.readPlan;
  await writeKnSlotBatchSession(env, session);
  const msg = options?.userMessageOverride ?? pkg.userMessage;
  return startKnSlotBatchHermesRun(env, session, pkg.instructions, msg, pkg.injectionMeta);
}

export async function startKnSlotBatchHermesRun(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  instructions: string,
  userMessage: string,
  injectionMeta?: import("./knowledge-network-slot-batch-types").KnSlotBatchInjectionMeta,
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  if (!isHermesAgentConfigured(env)) {
    return { ok: false, error: "Hermes 未配置" };
  }
  const sessionId = `jfo-kn-batch-${session.projectId}-${session.jobId}`;
  const { runId, error } = await startHermesRun(env, {
    userMessage,
    sessionId,
    instructions,
    history: [],
  });
  if (!runId) return { ok: false, error: error ?? "Hermes 启动失败" };
  session.currentRunId = runId;
  session.phase = session.parallelMode ? "waiting_batches" : "waiting_hermes";
  session.updatedAt = nowIso();
  const timing = session.batchTimings.find((t) => t.batchIndex === session.currentBatchIndex);
  if (!timing) {
    session.batchTimings.push({
      batchIndex: session.currentBatchIndex,
      slots: [...KN_SLOT_BATCH_PLAN[session.currentBatchIndex]!],
      startedAt: nowIso(),
      injectionMeta,
    });
  } else if (injectionMeta) {
    timing.injectionMeta = injectionMeta;
  }
  await writeKnSlotBatchSession(env, session);
  await env.DB.prepare(`UPDATE agent_jobs SET hermes_run_id = ?, updated_at = ? WHERE id = ?`)
    .bind(runId, nowIso(), session.jobId)
    .run();
  return { ok: true, runId };
}

const HARD_ISSUE_CODES = HARD_SLOT_ISSUE_CODE_SET;

function extractIssueCodesFromMergeError(
  session: KnSlotBatchSession,
  failedSlots: CanonicalKbSlot[],
): string[] {
  const codes: string[] = [];
  for (const slot of failedSlots) {
    const payload = session.slots[slot];
    const q = evaluateSlotQuality(slot, payload);
    for (const issue of q.issues) {
      if (HARD_ISSUE_CODES.has(issue.code)) codes.push(issue.code);
    }
    for (const issue of evaluateSlotPayloadMergeHardIssues(slot, payload)) {
      if (HARD_ISSUE_CODES.has(issue.code)) codes.push(issue.code);
    }
  }
  return [...new Set(codes)];
}

function buildBatchRepairUserMessage(
  session: KnSlotBatchSession,
  batchIndex: number,
  repairMessage: string,
  failedSlots: CanonicalKbSlot[],
): string {
  if (isFragmentGenerationSession(session)) {
    return buildMinimalFragmentBatchRepairPrompt({
      repairMessage,
      failedSlots,
      batchIndex,
      mode: session.mode,
    });
  }
  return buildMinimalSlotBatchRepairPrompt({
    repairMessage,
    failedSlots,
    batchIndex,
    mode: session.mode,
    issueCodes: extractIssueCodesFromMergeError(session, failedSlots),
  });
}

type BatchMergeResult =
  | { ok: true }
  | { ok: false; error: string; failedSlots: CanonicalKbSlot[]; hardOnly: boolean };

function hermesBatchOutputFormatLabel(session: KnSlotBatchSession): string {
  return isFragmentGenerationSession(session) ? "kb-fragment-batch" : "structured-slot-batch JSON";
}

function tryMergeBatchOutput(
  session: KnSlotBatchSession,
  batchIndex: number,
  answer: string | undefined,
): BatchMergeResult | null {
  if (!answer?.trim()) return null;
  if (isFragmentGenerationSession(session)) {
    const preview = extractKbFragmentBatchFromAnswer(answer);
    if (!preview.ok) {
      return {
        ok: false,
        error: preview.reason,
        failedSlots: [...KN_SLOT_BATCH_PLAN[batchIndex]!],
        hardOnly: true,
      };
    }
    return mergeFragmentBatchIntoSession(session, batchIndex, answer);
  }
  const preview = extractStructuredSlotBatchFromAnswer(answer);
  if (!preview.ok) {
    return {
      ok: false,
      error: preview.blocked
        ? `Hermes blocked：${preview.blockedReason ?? preview.reason}`
        : preview.reason,
      failedSlots: preview.blocked ? [...KN_SLOT_BATCH_PLAN[batchIndex]!] : [],
      hardOnly: true,
    };
  }
  return mergeBatchIntoSession(session, batchIndex, answer);
}

function proposalsFromBatch(
  batch: import("./knowledge-network-slot-batch-types").StructuredSlotBatchPayload,
): SourceProposalInput[] {
  const raw = batch.sourceProposals ?? [];
  return raw.map((s) => {
    const ext = s as StructuredKbSource & { sourceKey?: string };
    const key = ext.sourceKey?.trim() || ext.id?.trim();
    return {
      sourceKey: key,
      proposalKey: key,
      type: s.type,
      title: s.title,
      author: s.author,
      excerpt: s.excerpt,
      usedIn: s.usedIn,
    };
  });
}

async function cancelOtherParallelRuns(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  exceptBatchIndex?: number,
): Promise<void> {
  for (const run of session.batchRuns ?? []) {
    if (exceptBatchIndex !== undefined && run.batchIndex === exceptBatchIndex) continue;
    if (run.status === "running" && run.runId) {
      try {
        await cancelHermesRun(env, run.runId);
      } catch {
        /* best-effort */
      }
    }
    if (run.status === "running" || run.status === "queued" || run.status === "pending") {
      run.status = "cancelled";
    }
  }
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);
}

async function failParallelSlotBatchJob(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  jobId: string,
  error: string,
): Promise<void> {
  await cancelOtherParallelRuns(env, session);
  session.phase = "failed";
  session.lastError = error;
  await writeKnSlotBatchSession(env, session);
  await failSlotBatchJob(env, jobId, error);
}

function finalizeSessionSources(
  session: KnSlotBatchSession,
): { ok: true } | { ok: false; error: string } {
  const base = session.sourceRegistry ?? session.shell.sources ?? [];
  const batches: { batchIndex: number; proposals: SourceProposalInput[] }[] = [];
  const pending = session.pendingSourceProposals ?? [];
  if (pending.length) {
    batches.push({ batchIndex: -1, proposals: pending });
  }
  const { registry, proposalKeyToId } = mergeSourceProposalsIntoRegistry(base, batches);
  session.sourceRegistry = registry;
  session.shell.sources = registry;
  session.proposalKeyToId = Object.fromEntries(proposalKeyToId);

  if (isFragmentGenerationSession(session)) {
    return { ok: true };
  }

  const keyMap = new Map(proposalKeyToId);
  const slots = session.slots as StructuredKbSlots;
  const resolved = resolveEvidenceSourceRefsInSlots(slots, registry, keyMap);
  if (resolved.unresolved.length) {
    return {
      ok: false,
      error: `assemble 前 source 解析失败：${resolved.unresolved.join(", ")}`,
    };
  }
  session.slots = resolved.slots;

  const registryIds = new Set(
    registry.map((s) => (s.id.startsWith("source-") ? s.id : `source-${s.id}`)),
  );
  for (const slot of CANONICAL_KB_SLOTS) {
    const payload = session.slots[slot];
    if (!payload) continue;
    for (const ref of collectEvidenceSourceIds(payload)) {
      if (!registryIds.has(ref)) {
        return {
          ok: false,
          error: `assemble 前 source 校验失败：slot ${slot} 引用未知 ${ref}`,
        };
      }
    }
  }
  return { ok: true };
}

function mergeBatchIntoSession(
  session: KnSlotBatchSession,
  batchIndex: number,
  answer: string,
): {
  ok: true;
} | {
  ok: false;
  error: string;
  failedSlots: CanonicalKbSlot[];
  hardOnly: boolean;
} {
  const extracted = extractStructuredSlotBatchFromAnswer(answer);
  if (!extracted.ok) {
    const reason = extracted.blocked
      ? `Hermes blocked：${extracted.blockedReason ?? extracted.reason}`
      : extracted.reason;
    return {
      ok: false,
      error: reason,
      failedSlots: extracted.blocked ? [...KN_SLOT_BATCH_PLAN[batchIndex]!] : [],
      hardOnly: true,
    };
  }
  const batch = extracted.batch;
  const parallel = session.parallelMode === true;

  if (!parallel && batchIndex === 0) {
    if (batch.config) session.shell.config = batch.config;
    if (batch.meta) {
      session.shell.meta = {
        title: batch.meta.title ?? session.projectTitle,
        ...session.shell.meta,
        ...batch.meta,
      };
    }
    const srcMerge = mergeSourcesIntoRegistry(
      session.sourceRegistry ?? [],
      batch.sources,
      batchIndex,
    );
    if (!srcMerge.ok) {
      return { ok: false, error: srcMerge.error, failedSlots: [], hardOnly: true };
    }
    session.sourceRegistry = srcMerge.registry;
    session.shell.sources = srcMerge.registry;
    if (batch.terms?.length) {
      session.shell.terms = [...(session.shell.terms ?? []), ...batch.terms];
    }
    if (batch.dataDictionary?.length) {
      session.shell.dataDictionary = [
        ...(session.shell.dataDictionary ?? []),
        ...batch.dataDictionary,
      ];
    }
    if (batch.summary) session.shell.summary = batch.summary;
  } else if (parallel) {
    if (batch.sources?.length) {
      return {
        ok: false,
        error:
          "v2 禁止在 batch 内提交 sources 数组；请用 sourceProposals（含 sourceKey）引用新来源",
        failedSlots: [],
        hardOnly: true,
      };
    }
    const invented = rejectInventedFinalSourceIds(
      (batch.sourceProposals ?? []) as { id?: string; sourceKey?: string; title: string }[],
      session.sourceRegistry ?? [],
    );
    if (invented) {
      return { ok: false, error: invented, failedSlots: [], hardOnly: true };
    }
    if (batch.config || batch.meta) {
      /* prep shell 已锁定 */
    }
    if (batch.terms?.length) {
      session.shell.terms = [...(session.shell.terms ?? []), ...batch.terms];
    }
    if (batch.dataDictionary?.length) {
      session.shell.dataDictionary = [
        ...(session.shell.dataDictionary ?? []),
        ...batch.dataDictionary,
      ];
    }
  } else if (batch.sources?.length) {
    return {
      ok: false,
      error: "batch 2+ 禁止 sources；请用 sourceProposals 或引用 registry",
      failedSlots: [],
      hardOnly: true,
    };
  }

  const proposals = proposalsFromBatch(batch);
  if (proposals.length) {
    session.pendingSourceProposals = [...(session.pendingSourceProposals ?? []), ...proposals];
  }

  if (batch.summary?.trim()) {
    session.batchSummaries[batchIndex] = batch.summary.trim();
  }

  const hardFailedSlots: CanonicalKbSlot[] = [];
  const repairLines: string[] = [];

  for (const item of batch.slots) {
    const norm = normalizeSlotForMerge(item.slot, item.payload);
    const adaptedPayload = norm.payload as StructuredKbSlots[typeof item.slot];
    (session.slots as Partial<StructuredKbSlots>)[item.slot] = adaptedPayload;
    for (const w of norm.warnings) {
      session.unresolvedGaps.push(`${item.slot}: [${w.code}] ${w.message}`);
    }
    const q = evaluateSlotQuality(item.slot, adaptedPayload);
    const rowHardIssues = mergeHardIssuesFromNormalized(item.slot, norm).map((h) => ({
      slot: item.slot,
      code: h.code,
      message: h.message,
    }));
    const rec: KnSlotQualityRecord = {
      score: q.score,
      ok: q.ok && rowHardIssues.length === 0,
      hardOk: q.hardOk && rowHardIssues.length === 0,
      issues: [
        ...q.issues.map((i) => i.message),
        ...rowHardIssues.map((i) => i.message),
      ],
      gapFirstMode: q.gapFirstMode,
      factCoverage: q.factCoverage,
      gapCoverage: q.gapCoverage,
    };
    session.slotQuality[item.slot] = rec;

    const hardIssues = [
      ...q.issues.filter((i) => HARD_ISSUE_CODES.has(i.code)),
      ...rowHardIssues,
    ];
    if (hardIssues.length > 0) {
      hardFailedSlots.push(item.slot);
      for (const issue of hardIssues) {
        repairLines.push(`${item.slot}: ${issue.message}`);
      }
      if (rowHardIssues.length) {
        repairLines.push(buildMergeRowRepairHint(item.slot, rowHardIssues));
      }
    } else if (!q.ok) {
      for (const issue of q.issues) {
        session.unresolvedGaps.push(`${item.slot}: ${issue.message}`);
      }
    }
  }

  if (!parallel && batchIndex > 0) {
    const registryIds = new Set(
      (session.sourceRegistry ?? session.shell.sources ?? []).map((s) =>
        s.id.startsWith("source-") ? s.id : `source-${s.id}`,
      ),
    );
    for (const item of batch.slots) {
      for (const ref of collectEvidenceSourceIds(item.payload)) {
        if (!registryIds.has(ref)) {
          return {
            ok: false,
            error: `slot ${item.slot} 引用未知 source id ${ref}`,
            failedSlots: [item.slot],
            hardOnly: true,
          };
        }
      }
    }
  }

  if (hardFailedSlots.length) {
    return {
      ok: false,
      error:
        `批次 ${batchIndex + 1} hard 结构/幻觉问题：${hardFailedSlots.join(", ")}` +
        (repairLines.length ? `\n${repairLines.join("\n")}` : ""),
      failedSlots: hardFailedSlots,
      hardOnly: true,
    };
  }
  return { ok: true };
}

export async function startParallelBatchHermesRuns(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
): Promise<{ ok: true; primaryRunId: string; capacityWait?: boolean } | { ok: false; error: string }> {
  if (!session.prep) {
    await runKnSlotBatchPreprocess(env, session);
  }
  const limit = session.parallelLimit ?? resolveParallelBatchLimit(env);
  session.parallelLimit = limit;

  const runs: KnSlotBatchRunState[] = KN_SLOT_BATCH_PLAN.map((_, batchIndex) => ({
    batchIndex,
    status: "queued" as const,
  }));
  session.batchRuns = runs;
  session.phase = "waiting_batches";
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);

  let primaryRunId = "";
  const startCap = resolveMaxParallelStartsPerInvocation(env);
  const initial = Math.min(startCap, limit, KN_SLOT_BATCH_PLAN.length);
  for (let batchIndex = 0; batchIndex < initial; batchIndex++) {
    const started = await startBatchHermesRun(env, session, batchIndex);
    if (!started.ok) {
      if (isHermesCapacityError(started.error)) {
        runs[batchIndex] = { batchIndex, status: "queued", error: started.error };
        markSessionWaitingCapacity(session);
        session.batchRuns = runs;
        await writeKnSlotBatchSession(env, session);
        if (primaryRunId) {
          return { ok: true, primaryRunId };
        }
        return { ok: true, primaryRunId: "", capacityWait: true };
      }
      await cancelOtherParallelRuns(env, session);
      return { ok: false, error: `批次 ${batchIndex + 1} 启动失败：${started.error}` };
    }
    clearSessionWaitingCapacity(session);
    runs[batchIndex] = {
      batchIndex,
      runId: started.runId,
      status: "running",
      startedAt: nowIso(),
    };
    if (!primaryRunId) primaryRunId = started.runId;
  }
  session.batchRuns = runs;
  session.currentRunId = primaryRunId;
  session.currentBatchIndex = 0;
  await writeKnSlotBatchSession(env, session);
  await env.DB.prepare(`UPDATE agent_jobs SET hermes_run_id = ?, updated_at = ? WHERE id = ?`)
    .bind(primaryRunId, nowIso(), session.jobId)
    .run();
  return { ok: true, primaryRunId };
}

function markSessionWaitingCapacity(session: KnSlotBatchSession): void {
  session.phase = "waiting_capacity";
  session.updatedAt = nowIso();
}

function clearSessionWaitingCapacity(session: KnSlotBatchSession): void {
  if (session.phase === "waiting_capacity") {
    session.phase = session.parallelMode ? "waiting_batches" : "waiting_hermes";
    session.updatedAt = nowIso();
  }
}

/** repair 进行中时暂停拉起新 batch，避免 Hermes 并发顶满 */
function hasActiveBatchRepair(session: KnSlotBatchSession): boolean {
  const runs = session.batchRuns ?? [];
  for (const run of runs) {
    const attempts = session.batchRepairAttempts[run.batchIndex] ?? 0;
    if (attempts > 0 && !run.merged) return true;
  }
  return false;
}

async function tryStartQueuedParallelBatches(
  env: SlotBatchOrchestratorEnv,
  session: KnSlotBatchSession,
  options?: { maxStarts?: number },
): Promise<void> {
  if (hasActiveBatchRepair(session)) return;

  const runs = session.batchRuns ?? [];
  for (const run of runs) {
    if (run.status === "failed" && isHermesCapacityError(run.error)) {
      run.status = "queued";
      run.error = undefined;
    }
  }

  const limit = session.parallelLimit ?? resolveParallelBatchLimit(env);
  const maxStarts = options?.maxStarts ?? resolveMaxParallelStartsPerInvocation(env);
  let running = runs.filter((r) => r.status === "running").length;
  let startedThisTick = 0;
  for (const run of runs) {
    if (running >= limit) break;
    if (startedThisTick >= maxStarts) break;
    if (run.status !== "queued") continue;
    const started = await startBatchHermesRun(env, session, run.batchIndex);
    if (!started.ok) {
      if (isHermesCapacityError(started.error)) {
        run.status = "queued";
        run.error = started.error;
        run.runId = undefined;
        markSessionWaitingCapacity(session);
        continue;
      }
      run.status = "failed";
      run.error = started.error;
      continue;
    }
    clearSessionWaitingCapacity(session);
    run.runId = started.runId;
    run.status = "running";
    run.startedAt = nowIso();
    running += 1;
    startedThisTick += 1;
    if (!session.currentRunId) {
      session.currentRunId = started.runId;
      await env.DB.prepare(`UPDATE agent_jobs SET hermes_run_id = ?, updated_at = ? WHERE id = ?`)
        .bind(started.runId, nowIso(), session.jobId)
        .run();
    }
  }
  await writeKnSlotBatchSession(env, session);
}

async function advanceParallelSlotBatches(
  env: SlotBatchOrchestratorEnv,
  row: AgentJobRow,
  session: KnSlotBatchSession,
  options?: { pollTimeoutMs?: number },
): Promise<SlotBatchAdvanceResult> {
  await tryStartQueuedParallelBatches(env, session);
  const runs = session.batchRuns ?? [];
  let anyRunning = false;

  for (const run of runs) {
    if (run.status !== "running" || !run.runId || run.merged) continue;
    const snap = await pollHermesRun(env, run.runId, {
      timeoutMs: options?.pollTimeoutMs ?? 12_000,
    });
    if (!["completed", "failed", "cancelled"].includes(snap.status)) {
      anyRunning = true;
      continue;
    }
    if (snap.status === "failed" || snap.status === "cancelled") {
      const partialMerge = tryMergeBatchOutput(session, run.batchIndex, snap.output);
      if (partialMerge?.ok) {
        run.status = "completed";
        run.merged = true;
        run.completedAt = nowIso();
        const timingPartial = session.batchTimings.find((t) => t.batchIndex === run.batchIndex);
        if (timingPartial) {
          timingPartial.jsonParsed = true;
          timingPartial.completedAt = nowIso();
          if (timingPartial.startedAt) {
            timingPartial.durationMs =
              Date.parse(timingPartial.completedAt) - Date.parse(timingPartial.startedAt);
          }
        }
        await tryStartQueuedParallelBatches(env, session);
        await writeKnSlotBatchSession(env, session);
        continue;
      }
      const attempts = session.batchRepairAttempts[run.batchIndex] ?? 0;
      if (attempts < 1 && (partialMerge?.hardOnly || !snap.output?.trim())) {
        session.batchRepairAttempts[run.batchIndex] = attempts + 1;
        const timingFail = session.batchTimings.find((t) => t.batchIndex === run.batchIndex);
        if (timingFail) {
          timingFail.repairAttempted = true;
          timingFail.repairStartedAt = nowIso();
        }
        const failedSlots =
          partialMerge && !partialMerge.ok && partialMerge.failedSlots.length
            ? partialMerge.failedSlots
            : ([...KN_SLOT_BATCH_PLAN[run.batchIndex]!] as CanonicalKbSlot[]);
        const repairMsg = buildBatchRepairUserMessage(
          session,
          run.batchIndex,
          partialMerge && !partialMerge.ok
            ? partialMerge.error
            : snap.error ||
              `Hermes ${snap.status}，且无有效 ${hermesBatchOutputFormatLabel(session)}`,
          failedSlots,
        );
        const started = await startBatchHermesRun(env, session, run.batchIndex, {
          repairHints:
            partialMerge && !partialMerge.ok
              ? partialMerge.error
              : snap.error || `Hermes ${snap.status}`,
          userMessageOverride: repairMsg,
        });
        if (!started.ok) {
          if (isHermesCapacityError(started.error)) {
            run.status = "queued";
            run.error = started.error;
            run.runId = undefined;
            markSessionWaitingCapacity(session);
            await writeKnSlotBatchSession(env, session);
            continue;
          }
          await failParallelSlotBatchJob(env, session, row.id, started.error);
          return { action: "failed", error: started.error };
        }
        clearSessionWaitingCapacity(session);
        run.runId = started.runId;
        run.status = "running";
        run.startedAt = nowIso();
        anyRunning = true;
        continue;
      }
      run.status = "failed";
      run.error =
        partialMerge && !partialMerge.ok
          ? partialMerge.error
          : snap.error || `Hermes ${snap.status}`;
      await failParallelSlotBatchJob(env, session, row.id, run.error);
      return { action: "failed", error: run.error };
    }

    const merged = tryMergeBatchOutput(session, run.batchIndex, snap.output);
    const timing = session.batchTimings.find((t) => t.batchIndex === run.batchIndex);
    if (timing) {
      timing.jsonParsed = merged?.ok === true;
      timing.completedAt = nowIso();
      timing.durationMs = Date.parse(timing.completedAt) - Date.parse(timing.startedAt);
    }

    if (!merged || !merged.ok) {
      const attempts = session.batchRepairAttempts[run.batchIndex] ?? 0;
      if ((merged?.hardOnly ?? true) && attempts < 1) {
        session.batchRepairAttempts[run.batchIndex] = attempts + 1;
        if (timing) {
          timing.repairAttempted = true;
          timing.repairStartedAt = nowIso();
        }
        const mergeError =
          merged?.ok === false
            ? merged.error
            : snap.error || `Hermes 完成但无有效 ${hermesBatchOutputFormatLabel(session)}`;
        const failedSlots =
          merged?.ok === false && merged.failedSlots.length
            ? merged.failedSlots
            : ([...KN_SLOT_BATCH_PLAN[run.batchIndex]!] as CanonicalKbSlot[]);
        const repairMsg = buildBatchRepairUserMessage(
          session,
          run.batchIndex,
          mergeError,
          failedSlots,
        );
        const started = await startBatchHermesRun(env, session, run.batchIndex, {
          repairHints: mergeError,
          userMessageOverride: repairMsg,
        });
        if (!started.ok) {
          if (isHermesCapacityError(started.error)) {
            run.status = "queued";
            run.error = started.error;
            run.runId = undefined;
            markSessionWaitingCapacity(session);
            await writeKnSlotBatchSession(env, session);
            continue;
          }
          await failParallelSlotBatchJob(env, session, row.id, started.error);
          return { action: "failed", error: started.error };
        }
        clearSessionWaitingCapacity(session);
        run.runId = started.runId;
        run.status = "running";
        anyRunning = true;
        await writeKnSlotBatchSession(env, session);
        continue;
      }
      run.status = "failed";
      run.error =
        merged?.ok === false
          ? merged.error
          : snap.error || `Hermes 完成但无有效 ${hermesBatchOutputFormatLabel(session)}`;
      await failParallelSlotBatchJob(env, session, row.id, run.error);
      return { action: "failed", error: run.error };
    }

    run.status = "completed";
    run.merged = true;
    run.completedAt = nowIso();
    await tryStartQueuedParallelBatches(env, session);
  }

  await writeKnSlotBatchSession(env, session);

  const allDone = runs.length === KN_SLOT_BATCH_PLAN.length && runs.every((r) => r.merged);
  if (!allDone) {
    const stillRunning = runs.some((r) => r.status === "running");
    if (session.phase === "waiting_capacity") {
      return { action: "continue", hermesStatus: "queued" };
    }
    return { action: "continue", hermesStatus: stillRunning || anyRunning ? "running" : "processing" };
  }

  const srcFinal = finalizeSessionSources(session);
  if (!srcFinal.ok) {
    await failParallelSlotBatchJob(env, session, row.id, srcFinal.error);
    return { action: "failed", error: srcFinal.error };
  }
  session.phase = "assembling";
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);
  return runKnSlotBatchPublishing(env, row, session);
}

function assembleStructuredKbData(session: KnSlotBatchSession): StructuredKbData | null {
  const missing = CANONICAL_KB_SLOTS.filter((s) => !session.slots[s]);
  if (missing.length) return null;
  const slots = session.slots as StructuredKbSlots;
  const data: StructuredKbData = {
    type: "structured-kb-data",
    schemaVersion: "2.91",
    mode: session.mode,
    summary: session.shell.summary ?? `slot-batched ${session.mode} KB`,
    config: session.shell.config ?? {
      displayOrder: [...CANONICAL_KB_SLOTS],
      projectType: "general",
      renderingMode: "chinese-only",
    },
    meta: {
      title: session.shell.meta?.title ?? session.projectTitle,
      autoSummary: session.shell.meta?.autoSummary ?? session.shell.summary ?? "",
      ...session.shell.meta,
    },
    maturity: {
      factorA: "—",
      factorB: "—",
      combined: "—",
      tier: "Early",
    },
    slots,
    sources: session.sourceRegistry ?? session.shell.sources ?? [],
    terms: session.shell.terms,
    dataDictionary: session.shell.dataDictionary,
  };
  return applyDeterministicMaturity(data);
}

function missingCanonicalDeliverables(session: KnSlotBatchSession): CanonicalKbSlot[] {
  if (isFragmentGenerationSession(session)) {
    return CANONICAL_KB_SLOTS.filter((s) => !session.fragments?.[s]?.trim());
  }
  return CANONICAL_KB_SLOTS.filter((s) => !session.slots[s]);
}

function allKnSlotsReady(session: KnSlotBatchSession): boolean {
  return missingCanonicalDeliverables(session).length === 0;
}

export type SlotBatchAdvanceResult =
  | { action: "continue"; hermesStatus: string | null }
  | { action: "completed"; answer: string; html: string }
  | { action: "failed"; error: string }
  | { action: "idle" };

/** 处理 Hermes 终态或推进下一批次（reconcile / background 共用） */
export async function advanceKnSlotBatchJob(
  env: SlotBatchOrchestratorEnv,
  row: AgentJobRow,
  options?: { hermesOutput?: string; hermesStatus?: string; pollTimeoutMs?: number },
): Promise<SlotBatchAdvanceResult> {
  const session = await readKnSlotBatchSession(env, row.project_id, row.id);
  if (!session) return { action: "idle" };

  if (session.phase === "done") {
    return { action: "idle" };
  }

  if (session.phase === "failed") {
    if (isAgentJobActive(row.status)) {
      const errDetail = session.publishError ?? session.lastError ?? "知识网络生成失败";
      await failSlotBatchJob(env, row.id, errDetail);
      return { action: "failed", error: errDetail };
    }
    return { action: "idle" };
  }

  if (session.parallelMode && session.phase === "preprocessing") {
    const started = await startParallelBatchHermesRuns(env, session);
    if (!started.ok) {
      await failSlotBatchJob(env, row.id, started.error);
      return { action: "failed", error: started.error };
    }
    return {
      action: "continue",
      hermesStatus: started.capacityWait ? "queued" : "running",
    };
  }

  if (
    session.parallelMode &&
    (session.phase === "waiting_batches" || session.phase === "waiting_capacity")
  ) {
    return advanceParallelSlotBatches(env, row, session, options);
  }

  const runId = (session.currentRunId ?? row.hermes_run_id ?? "").trim();
  let output = options?.hermesOutput ?? "";
  let status = options?.hermesStatus ?? "";

  const skipHermesPoll =
    session.phase === "assembling" ||
    session.phase === "publishing" ||
    session.phase === "waiting_batches" ||
    session.phase === "waiting_capacity" ||
    session.phase === "preprocessing" ||
    session.currentBatchIndex >= KN_SLOT_BATCH_PLAN.length;

  if (!output && runId && !runId.startsWith("chat-fallback-") && !skipHermesPoll) {
    const snap = await pollHermesRun(env, runId, { timeoutMs: options?.pollTimeoutMs ?? 12_000 });
    status = snap.status;
    output = snap.output;
    if (snap.raw && typeof snap.raw === "object" && (snap.raw as { pollTimeout?: boolean }).pollTimeout) {
      return { action: "continue", hermesStatus: "running" };
    }
    if (!["completed", "failed", "cancelled"].includes(status)) {
      return { action: "continue", hermesStatus: status };
    }
  }

  if (status === "failed" || status === "cancelled") {
    const readyToPublish =
      session.phase === "assembling" ||
      session.phase === "publishing" ||
      allKnSlotsReady(session);
    if (!readyToPublish) {
      const partial = tryMergeBatchOutput(session, session.currentBatchIndex, output);
      if (partial?.ok) {
        status = "completed";
      } else {
        session.phase = "failed";
        session.lastError =
          partial && !partial.ok
            ? partial.error
            : `Hermes batch ${session.currentBatchIndex + 1} ${status}`;
        await writeKnSlotBatchSession(env, session);
        await failSlotBatchJob(env, row.id, session.lastError);
        return { action: "failed", error: session.lastError };
      }
    } else {
      status = "";
      output = "";
    }
  }

  if (session.phase === "waiting_hermes" && output) {
    session.phase = "processing";
    await writeKnSlotBatchSession(env, session);

    const timing = session.batchTimings.find((t) => t.batchIndex === session.currentBatchIndex);
    const repairRound = (session.batchRepairAttempts[session.currentBatchIndex] ?? 0) > 0;
    const extractPreview = isFragmentGenerationSession(session)
      ? extractKbFragmentBatchFromAnswer(output)
      : extractStructuredSlotBatchFromAnswer(output);
    if (timing) {
      if (repairRound && timing.repairStartedAt) {
        timing.repairJsonValid = extractPreview.ok;
      } else {
        timing.jsonParsed = extractPreview.ok;
        if (timing.repairJsonValid === undefined) timing.repairJsonValid = null;
      }
    }

    const merged = tryMergeBatchOutput(session, session.currentBatchIndex, output);
    if (!merged || !merged.ok) {
      const attempts = session.batchRepairAttempts[session.currentBatchIndex] ?? 0;
      const mergeError =
        merged?.ok === false
          ? merged.error
          : `Hermes 完成但无有效 ${hermesBatchOutputFormatLabel(session)}`;
      const canRepair =
        attempts < 1 &&
        (merged?.hardOnly ?? true) &&
        ((merged?.ok === false && merged.failedSlots.length > 0) || !extractPreview.ok);
      if (canRepair) {
        session.batchRepairAttempts[session.currentBatchIndex] = attempts + 1;
        if (timing) {
          timing.repairAttempted = true;
          timing.repairStartedAt = nowIso();
        }
        session.phase = "waiting_hermes";
        await writeKnSlotBatchSession(env, session);
        const repairFailedSlots =
          merged?.ok === false && merged.failedSlots.length > 0
            ? merged.failedSlots
            : [...KN_SLOT_BATCH_PLAN[session.currentBatchIndex]!];
        const repairMsg = buildBatchRepairUserMessage(
          session,
          session.currentBatchIndex,
          mergeError,
          repairFailedSlots,
        );
        const started = await startBatchHermesRun(env, session, session.currentBatchIndex, {
          repairHints: mergeError,
          userMessageOverride: repairMsg,
        });
        if (!started.ok) {
          if (isHermesCapacityError(started.error)) {
            markSessionWaitingCapacity(session);
            await writeKnSlotBatchSession(env, session);
            return { action: "continue", hermesStatus: "queued" };
          }
          await failSlotBatchJob(env, row.id, started.error);
          return { action: "failed", error: started.error };
        }
        clearSessionWaitingCapacity(session);
        return { action: "continue", hermesStatus: "running" };
      }
      session.phase = "failed";
      session.lastError = mergeError;
      await writeKnSlotBatchSession(env, session);
      await failSlotBatchJob(env, row.id, mergeError);
      return { action: "failed", error: mergeError };
    }

    const timingDone = session.batchTimings.find((t) => t.batchIndex === session.currentBatchIndex);
    if (timingDone) {
      if (timingDone.repairStartedAt && !timingDone.repairDurationMs) {
        timingDone.repairDurationMs =
          Date.parse(nowIso()) - Date.parse(timingDone.repairStartedAt);
      }
      timingDone.completedAt = nowIso();
      timingDone.durationMs =
        Date.parse(timingDone.completedAt) - Date.parse(timingDone.startedAt);
      timingDone.slotResults = KN_SLOT_BATCH_PLAN[session.currentBatchIndex]!.map((slot) => {
        if (isFragmentGenerationSession(session)) {
          const delivered = Boolean(session.fragments?.[slot]?.trim());
          return {
            slot,
            score: delivered ? 1 : 0,
            ok: delivered,
            issues: [],
          };
        }
        const q = session.slotQuality[slot];
        return {
          slot,
          score: q?.score ?? 0,
          ok: q?.ok ?? false,
          issues: q?.issues ?? [],
          gapFirstMode: q?.gapFirstMode,
          factCoverage: q?.factCoverage,
          gapCoverage: q?.gapCoverage,
        };
      });
    }

    if (session.smokeBatch2Only && session.currentBatchIndex === 1) {
      const scores = KN_SLOT_BATCH_PLAN[1]!.map((s) => {
        const q = session.slotQuality[s];
        return `${s}:${q?.ok ? "pass" : "fail"}(${q?.score ?? "—"})`;
      }).join(", ");
      session.phase = "done";
      session.updatedAt = nowIso();
      await writeKnSlotBatchSession(env, session);
      const answer =
        `Batch 2 smoke 通过（未发布 KB）。\n` +
        `slot quality：${scores}。\n` +
        `耗时：${timingDone?.durationMs ? Math.round(timingDone.durationMs / 1000) : "—"}s；repair=${(session.batchRepairAttempts[1] ?? 0) > 0 ? "是" : "否"}。\n` +
        `jsonParsed=${timingDone?.jsonParsed ?? "—"}；repairJsonValid=${timingDone?.repairJsonValid ?? "—"}。`;
      await completeSlotBatchJob(env, row.id, { answer, html: "" });
      await deleteKnSlotBatchSession(env, row.project_id, row.id);
      return { action: "completed", answer, html: "" };
    }

    if (session.smokeBatch3Only && session.currentBatchIndex === 2) {
      const scores = KN_SLOT_BATCH_PLAN[2]!.map((s) => {
        const q = session.slotQuality[s];
        return `${s}:${q?.ok ? "pass" : "fail"}(${q?.score ?? "—"})`;
      }).join(", ");
      session.phase = "done";
      session.updatedAt = nowIso();
      await writeKnSlotBatchSession(env, session);
      const answer =
        `Batch 3 smoke 通过（未发布 KB）。\n` +
        `slot quality：${scores}。\n` +
        `耗时：${timingDone?.durationMs ? Math.round(timingDone.durationMs / 1000) : "—"}s；repair=${(session.batchRepairAttempts[2] ?? 0) > 0 ? "是" : "否"}。\n` +
        `jsonParsed=${timingDone?.jsonParsed ?? "—"}；repairJsonValid=${timingDone?.repairJsonValid ?? "—"}。`;
      await completeSlotBatchJob(env, row.id, { answer, html: "" });
      await deleteKnSlotBatchSession(env, row.project_id, row.id);
      return { action: "completed", answer, html: "" };
    }

    const nextBatch = session.currentBatchIndex + 1;
    session.currentRunId = undefined;
    if (nextBatch >= KN_SLOT_BATCH_PLAN.length) {
      const srcFinal = finalizeSessionSources(session);
      if (!srcFinal.ok) {
        await failSlotBatchJob(env, row.id, srcFinal.error);
        return { action: "failed", error: srcFinal.error };
      }
      session.phase = "assembling";
      session.updatedAt = nowIso();
      await writeKnSlotBatchSession(env, session);
    } else {
      session.currentBatchIndex = nextBatch;
      session.phase = "between_batches";
      session.updatedAt = nowIso();
      await writeKnSlotBatchSession(env, session);
    }
  }

  if (
    session.phase === "between_batches" ||
    session.phase === "assembling" ||
    session.phase === "publishing"
  ) {
    if (session.currentBatchIndex < KN_SLOT_BATCH_PLAN.length && session.phase === "between_batches") {
      if (session.currentRunId) {
        const pending = await pollHermesRun(env, session.currentRunId, {
          timeoutMs: options?.pollTimeoutMs ?? 8_000,
        });
        if (!["completed", "failed", "cancelled"].includes(pending.status)) {
          return { action: "continue", hermesStatus: pending.status };
        }
      }
      const started = await startBatchHermesRun(env, session, session.currentBatchIndex);
      if (!started.ok) {
        if (isHermesCapacityError(started.error)) {
          markSessionWaitingCapacity(session);
          await writeKnSlotBatchSession(env, session);
          return { action: "continue", hermesStatus: "queued" };
        }
        await failSlotBatchJob(env, row.id, started.error);
        return { action: "failed", error: started.error };
      }
      clearSessionWaitingCapacity(session);
      return { action: "continue", hermesStatus: "running" };
    }

    return runKnSlotBatchPublishing(env, row, session);
  }

  return { action: "continue", hermesStatus: status || "running" };
}

export async function processKnSlotBatchHermesBackground(
  env: SlotBatchOrchestratorEnv,
  jobId: string,
): Promise<void> {
  const deadline = Date.now() + 55 * 60_000;
  while (Date.now() < deadline) {
    const row = await env.DB.prepare(
      `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
              hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
       FROM agent_jobs WHERE id = ?`,
    )
      .bind(jobId)
      .first<AgentJobRow>();
    if (!row || row.status === "completed" || row.status === "failed" || row.status === "cancelled") {
      return;
    }

    const session = await readKnSlotBatchSession(env, row.project_id, jobId);
    if (!session || session.phase === "done" || session.phase === "failed") return;

    if (session.phase === "waiting_hermes" && session.currentRunId) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      const result = await waitForHermesRun(env, session.currentRunId, {
        maxWaitMs: Math.min(22 * 60_000, remaining),
        pollIntervalMs: 4000,
      });
      const adv = await advanceKnSlotBatchJob(env, row, {
        hermesOutput: result.output,
        hermesStatus: result.status,
        pollTimeoutMs: 8_000,
      });
      if (adv.action === "completed" || adv.action === "failed") return;
      continue;
    }

    if (
      session.phase === "preprocessing" ||
      session.phase === "waiting_batches" ||
      session.phase === "waiting_capacity" ||
      session.phase === "between_batches" ||
      session.phase === "assembling" ||
      session.phase === "publishing"
    ) {
      const adv = await advanceKnSlotBatchJob(env, row, { pollTimeoutMs: 8_000 });
      if (adv.action === "completed" || adv.action === "failed") return;
      continue;
    }

    await new Promise((r) => setTimeout(r, 2500));
  }
}

function deriveCurrentBatchStatus(
  phase: KnSlotBatchSession["phase"],
  hermesStatus: string | null,
): string {
  if (phase === "preprocessing") return "preprocessing";
  if (phase === "waiting_capacity") return "waiting_capacity";
  if (phase === "waiting_batches") return "parallel_batches";
  if (phase === "waiting_hermes") {
    const hs = (hermesStatus ?? "").toLowerCase();
    if (hs === "running" || hs === "started") return "hermes_running";
    if (hs === "queued") return "hermes_queued";
    return "waiting_hermes";
  }
  if (phase === "processing") return "processing";
  if (phase === "between_batches") return "between_batches";
  if (phase === "assembling") return "assembling";
  if (phase === "publishing") return "publishing";
  if (phase === "done") return "done";
  if (phase === "failed") return "failed";
  return phase;
}

/**
 * 从 R2 session 仅重跑 publishing（不调 Hermes、不重跑 batch）。
 * 要求 slots 13/13；publish hard gate 在 publishing 阶段校验（不因 coverage target 未 pass 阻断）。
 */
export async function resumeKnSlotBatchPublish(
  env: SlotBatchOrchestratorEnv,
  params: { projectId: string; jobId: string; userId: string },
): Promise<SlotBatchAdvanceResult> {
  const session = await readKnSlotBatchSession(env, params.projectId, params.jobId);
  if (!session) {
    return { action: "failed", error: "R2 slot-batch session 不存在" };
  }

  const missingSlots = missingCanonicalDeliverables(session);
  if (missingSlots.length) {
    const deliveredCount = isFragmentGenerationSession(session)
      ? Object.keys(session.fragments ?? {}).length
      : Object.keys(session.slots).length;
    const label = isFragmentGenerationSession(session) ? "fragments" : "slots";
    return {
      action: "failed",
      error: `${label} 不齐（${deliveredCount}/13），缺：${missingSlots.join(", ")}`,
    };
  }

  const registry = session.sourceRegistry ?? session.shell.sources ?? [];
  if (registry.length === 0 && (session.shell.sources ?? []).length === 0) {
    return { action: "failed", error: "sourceRegistry 为空" };
  }

  let row =
    (await getAgentJob(env, params.jobId, params.userId)) ??
    (await getAgentJobById(env, params.jobId));
  if (!row || row.project_id !== params.projectId) {
    return { action: "failed", error: "agent job 不存在或与 project 不匹配" };
  }

  session.phase = "assembling";
  const srcFinal = finalizeSessionSources(session);
  if (!srcFinal.ok) {
    return { action: "failed", error: srcFinal.error };
  }
  session.currentPublishStep = undefined;
  session.publishError = undefined;
  session.publishStartedAt = undefined;
  session.publishStepStartedAt = undefined;
  session.assembledHtmlBytes = undefined;
  session.currentRunId = undefined;
  session.lastError = undefined;
  session.updatedAt = nowIso();
  await writeKnSlotBatchSession(env, session);

  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'running', error = NULL, updated_at = ? WHERE id = ? AND project_id = ?`,
  )
    .bind(nowIso(), params.jobId, params.projectId)
    .run();

  row = (await getAgentJobById(env, params.jobId)) ?? row;

  return runKnSlotBatchPublishing(env, row, session);
}

/** 导出 session 供进度展示 */
export async function getKnSlotBatchProgress(
  env: SlotBatchOrchestratorEnv,
  projectId: string,
  jobId: string,
  hermesStatus?: string | null,
): Promise<{
  batchIndex: number;
  totalBatches: number;
  phase: string;
  completedSlots: string[];
  batchTimings: KnSlotBatchSession["batchTimings"];
  currentBatchIndex: number;
  currentBatchSlots: CanonicalKbSlot[];
  currentBatchStatus: string;
  repairAttempt: number;
  readPlan?: KnSlotBatchSession["lastReadPlan"];
  sourceRegistryCount: number;
  unresolvedGaps: string[];
  slotQuality: KnSlotBatchSession["slotQuality"];
  currentPublishStep?: KnSlotBatchSession["currentPublishStep"];
  publishStartedAt?: string;
  publishStepStartedAt?: string;
  publishError?: string;
  assembledHtmlBytes?: number;
  workerStubSlots?: KnSlotBatchSession["workerStubSlots"];
  workerStubAppendix?: KnSlotBatchSession["workerStubAppendix"];
  fragmentDelivery?: KnSlotBatchSession["fragmentDelivery"];
} | null> {
  const session = await readKnSlotBatchSession(env, projectId, jobId);
  if (!session) return null;
  const currentBatchSlots = [...KN_SLOT_BATCH_PLAN[session.currentBatchIndex]!];
  const parallelDone = session.batchRuns?.filter((r) => r.merged).length ?? 0;
  return {
    batchIndex: session.currentBatchIndex,
    totalBatches: KN_SLOT_BATCH_PLAN.length,
    phase: session.phase,
    completedSlots: isFragmentGenerationSession(session)
      ? Object.keys(session.fragments ?? {})
      : Object.keys(session.slots),
    batchTimings: session.batchTimings,
    currentBatchIndex: session.currentBatchIndex,
    currentBatchSlots,
    currentBatchStatus: deriveCurrentBatchStatus(session.phase, hermesStatus ?? null),
    repairAttempt: session.batchRepairAttempts[session.currentBatchIndex] ?? 0,
    readPlan: session.lastReadPlan,
    sourceRegistryCount: (session.sourceRegistry ?? session.shell.sources ?? []).length,
    unresolvedGaps: session.unresolvedGaps,
    slotQuality: session.slotQuality,
    currentPublishStep: session.currentPublishStep,
    publishStartedAt: session.publishStartedAt,
    publishStepStartedAt: session.publishStepStartedAt,
    publishError: session.publishError,
    assembledHtmlBytes: session.assembledHtmlBytes,
    workerStubSlots: session.workerStubSlots,
    workerStubAppendix: session.workerStubAppendix,
    fragmentDelivery: session.fragmentDelivery,
    architectureVersion: session.architectureVersion,
    parallelMode: session.parallelMode,
    parallelBatchesCompleted: parallelDone,
    batchRuns: session.batchRuns,
    prepCompleted: Boolean(session.prep?.completedAt),
  };
}
