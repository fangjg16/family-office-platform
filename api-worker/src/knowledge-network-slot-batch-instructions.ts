import type { HermesAgentEnv } from "./hermes-agent";
import { buildHermesAgentInstructions } from "./hermes-agent";
import { buildHermesSlotBatchWorkflow } from "./hermes-knowledge-network";
import { buildCompactSlotBatchWorkflow } from "./knowledge-network-slot-batch-compact-prompt";
import { buildPrepSharedContextBlock, buildBatchEvidenceHintsBlock } from "./knowledge-network-slot-batch-prep";
import { buildHermesMaterialsDigest } from "./hermes-materials-digest";
import {
  buildKnowledgeNetworkMaterialHints,
  buildMaterialHintsFromDocuments,
  countMaterialHintFiles,
  loadDocumentsForMaterialHints,
} from "./knowledge-network-material-hints";
import {
  buildKnowledgeNetworkReadingPlan,
  buildReadingPlanFromDocuments,
  countReadingPlanFiles,
} from "./knowledge-network-reading-plan";
import { loadChunks } from "./chat-data";
import {
  DEEP_REFS_BY_SLOT,
  DEFAULT_KB_DEEP_REF_FILES,
} from "./knowledge-network-deep-refs";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { buildKnowledgeNetworkModeInstructions } from "./knowledge-network-mode";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  KN_SLOT_BATCH_PLAN,
  type KnSlotBatchInjectionMeta,
  type KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";
import { normalizeStructuredKbSources } from "./knowledge-network-structured-kb-data";
import type { SkillIntent } from "./chat-modes";

export type BatchReadPlan = {
  batchIndex: number;
  batchSlots: CanonicalKbSlot[];
  coreRules: string[];
  deepRefs: string[];
  includesTimelineRules: boolean;
  includesMaturityRules: boolean;
  includesExamplesJson: boolean;
};

/** 按 batch slots 收窄 deep refs（非 initial/full 全 7 个） */
export function resolveDeepRefsForBatchSlots(
  batchSlots: readonly CanonicalKbSlot[],
): string[] {
  const found = new Set<(typeof DEFAULT_KB_DEEP_REF_FILES)[number]>();
  for (const slot of batchSlots) {
    for (const file of DEEP_REFS_BY_SLOT[slot] ?? []) {
      found.add(file);
    }
  }
  return DEFAULT_KB_DEEP_REF_FILES.filter((f) => found.has(f)).map(
    (f) => `references/deep/${f}`,
  );
}

export function describeBatchReadPlan(batchIndex: number): BatchReadPlan {
  const batchSlots = [...KN_SLOT_BATCH_PLAN[batchIndex]!] as CanonicalKbSlot[];
  const deepRefs = resolveDeepRefsForBatchSlots(batchSlots);
  const includesTimelineRules = batchSlots.includes("timeline-milestones");
  const coreRules = [
    "SKILL.md",
    "references/kb-schema.md",
    "references/structured-kb-data-schema.md",
    "references/slot-specific-rules.md",
    "references/slot-rendering-rules.md",
    "references/content-rules.md",
  ];
  if (batchIndex === 0) {
    coreRules.push("references/kb-config.md");
  }
  return {
    batchIndex,
    batchSlots,
    coreRules,
    deepRefs,
    includesTimelineRules,
    includesMaturityRules: batchIndex === 0,
    includesExamplesJson: batchIndex === 0,
  };
}

function buildBatchScopedRequiredReads(
  mode: KnowledgeNetworkUpdateMode,
  batchIndex: number,
  batchSlots: CanonicalKbSlot[],
): string {
  const plan = describeBatchReadPlan(batchIndex);
  const lines: string[] = [
    "",
    `【知识网络 · Slot-Batch 必读（批次 ${batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length} · ${batchSlots.join(", ")}）】`,
    "本批 **只** read_file 下列规则与 deep refs；勿重复读取其它 batch 的 deep refs 或全量 examples。",
  ];
  let n = 1;
  for (const rel of plan.coreRules) {
    lines.push(`${n++}. read_file \`${rel}\``);
  }
  if (plan.includesTimelineRules) {
    lines.push(`${n++}. read_file \`references/timeline-rules.md\``);
  }
  if (plan.includesExamplesJson) {
    lines.push(`${n++}. read_file \`examples-kb-data.json\`（仅 batch 1 参考结构）`);
  }
  for (const deepRef of plan.deepRefs) {
    lines.push(`${n++}. read_file \`${deepRef}\``);
  }
  lines.push(
    "",
    "资料读取：遵循下方 Material Hints / Reading Plan，**仅读本批 slot 相关文件**；禁止机械拉取全资料包。",
    batchIndex > 0
      ? "batch 2+：**禁止**重新创建 source id；仅引用 Worker 已登记的 Appendix A id（见 shared context）。"
      : "batch 1：在 structured-slot-batch 中登记 sources 初稿；id 由 Worker 统一规范化（U-1/A-1…）。",
  );
  return lines.join("\n");
}

export function buildSlotBatchSharedContextBlock(session: KnSlotBatchSession): string {
  const lines: string[] = ["", "【Worker · 跨 batch Shared Context（勿与下列事实矛盾）】"];
  const title = session.shell.meta?.title ?? session.projectTitle;
  const autoSummary = session.shell.meta?.autoSummary ?? session.shell.summary ?? "";
  if (title || autoSummary) {
    lines.push("", "**Global project facts**");
    if (title) lines.push(`- 标题：${title}`);
    if (autoSummary) lines.push(`- autoSummary：${autoSummary}`);
  }
  const registry = session.sourceRegistry ?? session.shell.sources ?? [];
  if (registry.length) {
    lines.push("", "**Source registry（Appendix A · Worker 已登记，勿重复 id）**");
    for (const s of registry) {
      lines.push(`- source-${s.id.replace(/^source-/, "")} · ${s.type} · ${s.title}`);
    }
  }
  if (session.batchSummaries.length) {
    lines.push("", "**Previous accepted batch summaries**");
    session.batchSummaries.forEach((s, i) => lines.push(`- 批次 ${i + 1}：${s}`));
  }
  if (session.unresolvedGaps.length) {
    lines.push("", "**Unresolved gaps（须在相关 slot 写 gaps callout，勿硬填）**");
    for (const g of session.unresolvedGaps.slice(-12)) {
      lines.push(`- ${g}`);
    }
  }
  const terms = session.shell.terms ?? [];
  if (terms.length) {
    lines.push("", "**Terms candidates（Appendix B）**");
    for (const t of terms.slice(0, 8)) {
      lines.push(`- ${t.term}：${t.definition.slice(0, 120)}`);
    }
  }
  const dd = session.shell.dataDictionary ?? [];
  if (dd.length) {
    lines.push("", "**Data dictionary candidates（Appendix C）**");
    for (const e of dd.slice(0, 6)) {
      lines.push(`- ${e.field}`);
    }
  }
  const done = Object.keys(session.slots);
  if (done.length) {
    lines.push("", `**已完成 slot（勿重复输出）**：${done.join(", ")}`);
  }
  return lines.join("\n");
}

/** Worker 合并 batch 0 sources 并登记 registry */
export function mergeSourcesIntoRegistry(
  existing: StructuredKbSource[],
  incoming: StructuredKbSource[] | undefined,
  batchIndex: number,
): { ok: true; registry: StructuredKbSource[] } | { ok: false; error: string } {
  if (!incoming?.length) {
    return { ok: true, registry: existing };
  }
  if (batchIndex > 0) {
    return {
      ok: false,
      error: "batch 2+ 禁止新增 sources 数组；请引用 shared context 中已登记 source id",
    };
  }
  const byShortId = new Map<string, StructuredKbSource>();
  for (const s of existing) {
    const shortId = s.id.trim().replace(/^source-/, "");
    if (shortId) byShortId.set(shortId, s);
  }
  for (const s of incoming) {
    const shortId = s.id.trim().replace(/^source-/, "");
    if (shortId) byShortId.set(shortId, { ...byShortId.get(shortId), ...s, id: shortId });
  }
  const merged = normalizeStructuredKbSources([...byShortId.values()]);
  if (merged.error) {
    return { ok: false, error: merged.error };
  }
  return { ok: true, registry: merged.normalized };
}

export type SlotBatchInstructionsEnv = HermesAgentEnv & { DB: D1Database };

export async function buildSlotBatchHermesInstructionsPackage(
  env: SlotBatchInstructionsEnv,
  session: KnSlotBatchSession,
  batchIndex: number,
  params: {
    projectTitle: string;
    hasExistingKb: boolean;
    files?: string[];
    repairHints?: string;
  },
): Promise<{
  instructions: string;
  userMessage: string;
  readPlan: BatchReadPlan;
  injectionMeta: KnSlotBatchInjectionMeta;
}> {
  const batchSlots = [...KN_SLOT_BATCH_PLAN[batchIndex]!] as CanonicalKbSlot[];
  const readPlan = describeBatchReadPlan(batchIndex);
  const mode = session.mode;
  const compact = session.parallelMode === true || session.architectureVersion === 2;
  const maxFilesPerSlot = compact ? 2 : batchIndex === 0 ? 3 : 2;
  let digestIncluded = false;

  let instructions = buildHermesAgentInstructions(
    env,
    "knowledge_network" as SkillIntent,
    session.projectId,
    params.projectTitle,
    {
      userId: session.userId,
      conversationId: session.conversationId,
      jobId: session.jobId,
      userMessage: session.userMessage,
      hasExistingKb: params.hasExistingKb,
      slotBatched: true,
      slotBatchCompact: compact,
      slotBatchIndex: batchIndex,
      slotBatchSlots: batchSlots,
    },
  );

  instructions += buildKnowledgeNetworkModeInstructions(mode, params.hasExistingKb);

  if (batchIndex === 0 && !compact) {
    try {
      const digest = await buildHermesMaterialsDigest(
        env,
        session.projectId,
        session.userId,
        session.conversationId,
        session.userMessage,
        params.files,
        "knowledge_network",
        mode,
      );
      if (digest) {
        digestIncluded = true;
        instructions += digest;
      }
    } catch {
      /* 非阻断 */
    }
  }

  let materialHintsFileCount = 0;
  let readingPlanMustRead = 0;
  let readingPlanShouldRead = 0;

  try {
    const documents = await loadDocumentsForMaterialHints(
      env,
      session.projectId,
      session.userId,
      session.conversationId,
    );
    if (!compact) {
      const chunks =
        documents.length > 0
          ? await loadChunks(env, session.projectId, session.userId, session.conversationId)
          : [];
      const hintsPayload = buildMaterialHintsFromDocuments({
        mode,
        userMessage: session.userMessage,
        touchedSlots: batchSlots,
        documents,
        chunks,
        maxFilesPerSlot,
        slotBatchScoped: true,
      });
      materialHintsFileCount = countMaterialHintFiles(hintsPayload);
      const hints = await buildKnowledgeNetworkMaterialHints(env, {
        projectId: session.projectId,
        userId: session.userId,
        conversationId: session.conversationId,
        userMessage: session.userMessage,
        mode,
        touchedSlots: batchSlots,
        maxFilesPerSlot,
        slotBatchScoped: true,
      });
      if (hints) instructions += hints;

      const planPayload = buildReadingPlanFromDocuments({
        mode,
        userMessage: session.userMessage,
        touchedSlots: batchSlots,
        documents,
        chunks,
        maxFilesPerSlot,
        slotBatchScoped: true,
      });
      const planCounts = countReadingPlanFiles(planPayload);
      readingPlanMustRead = planCounts.mustRead;
      readingPlanShouldRead = planCounts.shouldRead;
      const readingPlan = await buildKnowledgeNetworkReadingPlan(env, {
        projectId: session.projectId,
        userId: session.userId,
        conversationId: session.conversationId,
        userMessage: session.userMessage,
        mode,
        touchedSlots: batchSlots,
        maxFilesPerSlot,
        slotBatchScoped: true,
      });
      if (readingPlan) instructions += readingPlan;
    } else {
      materialHintsFileCount = Math.min(documents.length, maxFilesPerSlot * batchSlots.length);
    }
  } catch {
    /* 非阻断 */
  }

  const injectionMeta: KnSlotBatchInjectionMeta = {
    deepRefCount: compact ? Math.min(readPlan.deepRefs.length, 2) : readPlan.deepRefs.length,
    materialHintsFileCount,
    readingPlanMustRead,
    readingPlanShouldRead,
    digestIncluded,
  };

  if (compact) {
    instructions += buildPrepSharedContextBlock(session);
    instructions += buildBatchEvidenceHintsBlock(session, batchSlots);
    instructions += buildCompactSlotBatchWorkflow({
      mode: session.mode,
      batchIndex,
      slots: batchSlots,
      repairHints: params.repairHints,
    });
  } else {
    if (batchIndex > 0) {
      instructions += buildSlotBatchSharedContextBlock(session);
    }
    instructions += buildHermesSlotBatchWorkflow({
      mode: session.mode,
      projectTitle: session.projectTitle,
      batchIndex,
      totalBatches: KN_SLOT_BATCH_PLAN.length,
      slots: batchSlots,
      repairHints: params.repairHints,
      priorSlots: Object.keys(session.slots) as CanonicalKbSlot[],
    });
  }

  const batchSlotsLabel = batchSlots.join(", ");
  const userMessage = compact
    ? `${session.userMessage}\n\n【Worker 并行批次 ${batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length} · Compact】` +
      `生成本批 slot：${batchSlotsLabel}。只交付 structured-slot-batch JSON + sourceProposals（如需）。`
    : batchIndex === 1
      ? `${session.userMessage}\n\n【Worker 批次 2/4 · Batch2 协议】只交付一个 structured-slot-batch JSON 代码块（slots 为 object；见指令内 envelope + 组件片段）。`
      : batchIndex === 2
        ? `${session.userMessage}\n\n【Worker 批次 3/4 · Batch3 协议】只交付一个 structured-slot-batch JSON 代码块（batchIndex=2，slots 为 object；见指令内 envelope + 组件片段）。`
        : `${session.userMessage}\n\n【Worker 批次 ${batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length}】` +
          `请生成本批 slot：${batchSlotsLabel}。交付 structured-slot-batch JSON，勿写整页 HTML。`;

  return { instructions, userMessage, readPlan, injectionMeta };
}

/** slot-batched 模式下替换 hermes-agent 内 full-mode 全量 required reads */
export function buildSlotBatchRequiredReadsOverride(
  mode: KnowledgeNetworkUpdateMode,
  batchIndex: number,
  batchSlots: CanonicalKbSlot[],
): string {
  return buildBatchScopedRequiredReads(mode, batchIndex, batchSlots);
}

/** v2 并行 compact：最短必读列表 */
export function buildCompactBatchRequiredReads(batchSlots: CanonicalKbSlot[]): string {
  const deepRefs = resolveDeepRefsForBatchSlots(batchSlots).slice(0, 2);
  const lines = [
    "",
    `【知识网络 · Compact Slot-Batch（${batchSlots.join(", ")}）】`,
    "本批 **只** read_file 下列 3–4 个文件；禁止拉全量 examples / 其它 batch deep refs。",
    "1. read_file `references/slot-specific-rules.md`",
    "2. read_file `references/slot-rendering-rules.md`",
  ];
  deepRefs.forEach((ref, i) => lines.push(`${i + 3}. read_file \`${ref}\``));
  lines.push(
    "",
    "资料事实以 Worker 预处理 **Evidence Inventory / Source Registry** 为准；缺资料写 gap rows。",
  );
  return lines.join("\n");
}
