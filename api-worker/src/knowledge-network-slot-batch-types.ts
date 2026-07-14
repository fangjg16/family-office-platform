import type { KnGenerationMode } from "./knowledge-network-generation-mode";
import type { MaterialSnapshot } from "./knowledge-network-material-snapshot";
import type { SlotFragmentDeliveryStatus } from "./knowledge-network-fragment-types";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";
import type {
  StructuredKbData,
  StructuredKbSource,
} from "./knowledge-network-structured-kb-data-types";

export const STRUCTURED_SLOT_BATCH_TYPE = "structured-slot-batch" as const;

/** 公开检索执行遥测（允许 ≠ 已执行） */
export type KnPublicSearchTelemetry = {
  /** 政策允许公开检索 */
  allowed: boolean;
  /** 动态路由曾要求 public-info-search（Skill 或 deep-ref） */
  routingRequested: boolean;
  /** Hermes 或 Worker 侧曾尝试检索（以提案/路由为准） */
  attempted: boolean;
  /** 至少新增一条公开/第三方来源 */
  succeeded: boolean;
  /** 本 Job 经 sourceProposals 新增的公开类来源数 */
  sourcesAdded: number;
  notes: string[];
};

/** Full structured 生成批次（6 批 × 13 slot · 拆分重 batch） */
export const KN_SLOT_BATCH_PLAN: readonly (readonly CanonicalKbSlot[])[] = [
  ["snapshot", "target-overview", "industry-market"],
  ["business-operations", "legal-ownership", "regulatory-compliance"],
  ["resource-network", "comps-benchmark"],
  ["valuation-returns"],
  ["diligence-gaps", "risks-mitigation"],
  ["timeline-milestones", "decision-framework"],
] as const;

export type KnSlotBatchPhase =
  | "preprocessing"
  | "waiting_batches"
  | "waiting_capacity"
  | "waiting_hermes"
  | "processing"
  | "between_batches"
  | "appendix_wrapup"
  | "assembling"
  | "publishing"
  | "done"
  | "failed";

export type EvidenceInventoryItem = {
  id: string;
  sourceId: string;
  title: string;
  type: string;
  excerpt: string;
  relevantSlots: CanonicalKbSlot[];
};

export type KnSlotBatchPrep = {
  completedAt: string;
  evidenceInventory: EvidenceInventoryItem[];
  projectShell: {
    config: StructuredKbData["config"];
    meta: StructuredKbData["meta"];
    summary?: string;
  };
  sourceRegistry: StructuredKbSource[];
};

export type KnSlotBatchRunState = {
  batchIndex: number;
  runId?: string;
  status: "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";
  merged?: boolean;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

/** Worker publishing 子步骤（诊断 / 超时） */
export type KnPublishStep =
  | "assembling"
  | "quality_gate"
  | "rendering_html"
  | "validating_html"
  | "writing_r2"
  | "updating_d1"
  | "syncing_chat"
  | "completed"
  | "failed";

export type KnSlotBatchInjectionMeta = {
  deepRefCount: number;
  materialHintsFileCount: number;
  readingPlanMustRead: number;
  readingPlanShouldRead: number;
  digestIncluded: boolean;
};

export type KnSlotBatchTiming = {
  batchIndex: number;
  slots: CanonicalKbSlot[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  repairAttempted?: boolean;
  repairStartedAt?: string;
  repairDurationMs?: number;
  /** 首轮 Hermes 回复是否成功解析 structured-slot-batch JSON */
  jsonParsed?: boolean;
  /** repair 轮是否返回有效 JSON；null=未触发 repair */
  repairJsonValid?: boolean | null;
  /** 本批各 slot quality（batch 完成后写入） */
  slotResults?: KnSlotBatchSlotResult[];
  injectionMeta?: KnSlotBatchInjectionMeta;
};

export type KnSlotQualityRecord = {
  score: number;
  /** coverage target 通过（fact + gap rows） */
  ok: boolean;
  /** 无幻觉/空 payload 等 hard issue */
  hardOk?: boolean;
  issues: string[];
  gapFirstMode?: boolean;
  factCoverage?: number;
  gapCoverage?: number;
};

export type KnSlotBatchSlotResult = KnSlotQualityRecord & { slot: CanonicalKbSlot };

export type KnSlotBatchSession = {
  version: 1 | 2;
  /** v2：预处理 + 并行 batch */
  architectureVersion?: 2;
  parallelMode?: boolean;
  jobId: string;
  projectId: string;
  userId: string;
  conversationId: string;
  mode: "initial" | "full";
  projectTitle: string;
  userMessage: string;
  currentBatchIndex: number;
  phase: KnSlotBatchPhase;
  /** batch 0 可写入 shell（config/meta/sources 初稿） */
  shell: Partial<
    Pick<
      StructuredKbData,
      "config" | "meta" | "sources" | "terms" | "dataDictionary" | "summary" | "maturity"
    >
  >;
  slots: Partial<{ [K in CanonicalKbSlot]: SlotPayloadBySlot[K] }>;
  /** fragment 模式：Hermes 交付的 section HTML */
  fragments?: Partial<Record<CanonicalKbSlot, string>>;
  appendixFragments?: Partial<Record<"glossary" | "data-dictionary", string>>;
  generationMode?: KnGenerationMode;
  materialSnapshot?: MaterialSnapshot;
  fragmentDelivery?: Partial<
    Record<CanonicalKbSlot | "glossary" | "data-dictionary", { delivery: SlotFragmentDeliveryStatus; batchIndex?: number }>
  >;
  /** D-α：assemble 时 Worker 注入 stub 的 canonical slot（非 Hermes 交付） */
  workerStubSlots?: CanonicalKbSlot[];
  /** D-α：assemble 时 Worker 注入 stub 的附录 B/C */
  workerStubAppendix?: ("glossary" | "data-dictionary")[];
  /** 同 Job 内 B/C 全文收尾 */
  appendixWrapupRunId?: string;
  appendixWrapupCompleted?: boolean;
  appendixWrapupRepairAttempts?: number;
  /** Hermes B/C 收尾失败后改用 Worker stub（审计用，非静默） */
  appendixWrapupFellBackToStub?: boolean;
  /** 公开检索：允许 / 尝试 / 成功 / 新增来源数 */
  publicSearchTelemetry?: KnPublicSearchTelemetry;
  slotQuality: Partial<Record<CanonicalKbSlot, KnSlotQualityRecord>>;
  batchTimings: KnSlotBatchTiming[];
  currentRunId?: string;
  batchRepairAttempts: Partial<Record<number, number>>;
  /** 单 Hermes run 超时后的重试次数（每 batch 最多 1 次） */
  batchRunTimeoutRetries?: Partial<Record<number, number>>;
  /** Worker 统一 Appendix A source id 登记 */
  sourceRegistry?: import("./knowledge-network-structured-kb-data-types").StructuredKbSource[];
  prep?: KnSlotBatchPrep;
  batchRuns?: KnSlotBatchRunState[];
  /** v2 并行 Hermes 上限（1–4） */
  parallelLimit?: number;
  pendingSourceProposals?: import("./knowledge-network-source-proposals").SourceProposalInput[];
  proposalKeyToId?: Record<string, string>;
  batchSummaries: string[];
  unresolvedGaps: string[];
  /** 最近一次 batch 的 read plan（诊断 / smoke 用） */
  /** batch 2 smoke：仅验收 batchIndex=1，成功后不入库 */
  smokeBatch2Only?: boolean;
  /** batch 3 smoke：仅验收 batchIndex=2，成功后不入库 */
  smokeBatch3Only?: boolean;
  lastReadPlan?: import("./knowledge-network-slot-batch-instructions").BatchReadPlan;
  lastError?: string;
  /** publishing 诊断 */
  currentPublishStep?: KnPublishStep;
  publishStartedAt?: string;
  publishStepStartedAt?: string;
  publishError?: string;
  /** 渲染后 HTML 字节数（未写入 R2 前） */
  assembledHtmlBytes?: number;
  createdAt: string;
  updatedAt: string;
};

export type StructuredSlotBatchPayload = {
  type: typeof STRUCTURED_SLOT_BATCH_TYPE;
  schemaVersion: "2.91";
  mode?: "initial" | "full";
  batchIndex: number;
  summary?: string;
  status?: "ready" | "blocked";
  blockedReason?: string;
  config?: StructuredKbData["config"];
  meta?: Partial<StructuredKbData["meta"]>;
  sources?: StructuredKbSource[];
  /** 临时来源提议；用 sourceKey 引用，Worker 分配最终 U-N/A-N */
  sourceProposals?: (StructuredKbSource & { sourceKey?: string })[];
  terms?: StructuredKbData["terms"];
  dataDictionary?: StructuredKbData["dataDictionary"];
  slots: {
    slot: CanonicalKbSlot;
    payload: SlotPayloadBySlot[CanonicalKbSlot];
    status?: "ready" | "draft";
  }[];
};

export function knSlotBatchSessionR2Key(projectId: string, jobId: string): string {
  return `projects/${projectId}/kn-slot-batch/${jobId}.json`;
}
