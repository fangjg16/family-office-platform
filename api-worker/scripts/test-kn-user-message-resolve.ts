/**
 * resolveKnUserMessage / slot patch finalize routing tests
 * 用法：cd api-worker && npx tsx scripts/test-kn-user-message-resolve.ts
 */
import { detectKnowledgeNetworkUpdateMode } from "../src/knowledge-network-mode.ts";
import {
  pickKnUserMessageContent,
  type KnUserMessageLookupRow,
} from "../src/kn-job-user-message.ts";
import { userMessageIdForJob, assistantMessageIdForJob } from "../src/chat-sync.ts";
import { resolveKnowledgeNetworkSlotsFromMessage } from "../src/knowledge-network-slot-aliases.ts";
import { shouldUseSlotHtmlPatchMode } from "../src/knowledge-network-slot-patch.ts";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const jobId = "3d83afb1-c87c-4fd0-9e5d-56f0e52f69e4";
const convId = "proj-535a240acf88-main";
const userJobId = userMessageIdForJob(jobId);
const assistantJobId = assistantMessageIdForJob(jobId);

const risksUserText =
  "只更新关键风险板块：在现有风险矩阵基础上，补充一条【监管政策突变】为中风险。请只引用当前 Appendix A 已有来源，不要新增 source id。交付 slot-html-patch JSON，不要整页 HTML。";

/** 生产场景：user-job pending 为 null；assistant-job 带 pending_job_id */
const productionRows: KnUserMessageLookupRow[] = [
  {
    id: "user-1781853953043",
    role: "user",
    content: risksUserText,
    sort_index: 8,
    pending_job_id: null,
  },
  {
    id: userJobId,
    role: "user",
    content: risksUserText,
    sort_index: 9,
    pending_job_id: null,
  },
  {
    id: "assistant-1781853953045",
    role: "assistant",
    content: "",
    sort_index: 10,
    pending_job_id: null,
  },
  {
    id: assistantJobId,
    role: "assistant",
    content: "已提交深度分析任务…",
    sort_index: 11,
    pending_job_id: jobId,
  },
];

const resolved = pickKnUserMessageContent(productionRows, jobId, convId);
report(
  "user-job-* with null pending resolves user text",
  resolved === risksUserText,
  resolved.slice(0, 40),
);

// 旧逻辑仅 pending_job_id 在用户行上会失败
const legacyPendingOnly = productionRows.find(
  (r) => r.role === "user" && (r.pending_job_id ?? "").trim() === jobId,
);
report("legacy pending-only lookup finds nothing", !legacyPendingOnly);

const slots = resolveKnowledgeNetworkSlotsFromMessage(resolved);
const mode = detectKnowledgeNetworkUpdateMode(resolved, true);
report("touchedSlots includes risks-mitigation", slots.includes("risks-mitigation"), slots.join(","));
report("mode is incremental", mode === "incremental", mode);
report(
  "slot patch mode enabled after resolve",
  shouldUseSlotHtmlPatchMode(mode, slots),
);

// fallback: pending_job_id on user row
const pendingUserRows: KnUserMessageLookupRow[] = [
  {
    id: "user-legacy",
    role: "user",
    content: "更新关键风险板块",
    sort_index: 1,
    pending_job_id: jobId,
  },
  {
    id: assistantJobId,
    role: "assistant",
    content: "…",
    sort_index: 2,
    pending_job_id: jobId,
  },
];
report(
  "fallback pending_job_id on user row",
  pickKnUserMessageContent(pendingUserRows, jobId, convId) === "更新关键风险板块",
);

// fallback: user message before assistant-job by sort_index
const sortFallbackRows: KnUserMessageLookupRow[] = [
  {
    id: "user-ephemeral",
    role: "user",
    content: "只更新关键风险板块",
    sort_index: 4,
    pending_job_id: null,
  },
  {
    id: assistantJobId,
    role: "assistant",
    content: "…",
    sort_index: 5,
    pending_job_id: jobId,
  },
];
report(
  "fallback user row before assistant-job sort_index",
  pickKnUserMessageContent(sortFallbackRows, jobId, convId) === "只更新关键风险板块",
);

// empty when no match
report(
  "returns empty when no user message found",
  pickKnUserMessageContent([], jobId, convId) === "",
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} test(s) failed.`}`);
process.exit(failed > 0 ? 1 : 0);
