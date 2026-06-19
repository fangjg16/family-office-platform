/**
 * chat_sync merge / protection unit tests
 * 用法：cd api-worker && npx tsx scripts/test-chat-sync-merge.ts
 */
import {
  isJobScopedMessageId,
  jobIdFromScopedMessageId,
  shouldProtectMessageFromSyncDelete,
  shouldSkipSyncUpsertOverwrite,
} from "../src/chat-sync-protection.ts";
import { assistantMessageIdForJob } from "../src/chat-sync.ts";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const jobId = "cf65bcb9-5ff1-40d0-a6a1-8ccc93cf58f9";
const userJobId = `user-job-${jobId}`;
const assistantJobId = assistantMessageIdForJob(jobId);

const activeJobs = new Map<string, string>([[jobId, "running"]]);
const terminalJobs = new Map<string, string>([[jobId, "cancelled"]]);

report("isJobScopedMessageId user-job", isJobScopedMessageId(userJobId));
report("isJobScopedMessageId assistant-job", isJobScopedMessageId(assistantJobId));
report("isJobScopedMessageId client id false", !isJobScopedMessageId("user-1781851528885"));
report("jobIdFromScopedMessageId", jobIdFromScopedMessageId(assistantJobId) === jobId);

report(
  "protect running pending assistant from sync delete",
  shouldProtectMessageFromSyncDelete(
    { id: assistantJobId, pending_job_id: jobId },
    activeJobs,
  ),
);
report(
  "protect user-job while job running",
  shouldProtectMessageFromSyncDelete({ id: userJobId }, activeJobs),
);
report(
  "do not protect user-job after job terminal",
  !shouldProtectMessageFromSyncDelete({ id: userJobId }, terminalJobs),
);
report(
  "do not protect ordinary client message",
  !shouldProtectMessageFromSyncDelete({ id: "user-1781851528885" }, activeJobs),
);

report(
  "skip sync upsert that clears active pending",
  shouldSkipSyncUpsertOverwrite(
    { id: assistantJobId, pending_job_id: jobId },
    { pendingJobId: null },
    activeJobs,
  ),
);
report(
  "allow sync upsert that keeps pending",
  !shouldSkipSyncUpsertOverwrite(
    { id: assistantJobId, pending_job_id: jobId },
    { pendingJobId: jobId },
    activeJobs,
  ),
);

// 模拟：PUT 载荷缺少 server 已有 job 消息 → 保护逻辑判定不得删
const serverRows = [
  { id: userJobId, pending_job_id: null },
  { id: assistantJobId, pending_job_id: jobId },
  { id: "user-1781851528885", pending_job_id: null },
];
const incomingIds = new Set(["user-1781851528885"]);
const wouldDeleteWithoutProtection = serverRows.filter((r) => !incomingIds.has(r.id));
const protectedDeletes = wouldDeleteWithoutProtection.filter((r) =>
  shouldProtectMessageFromSyncDelete(r, activeJobs),
);
report(
  "PUT missing server job messages must not delete protected rows",
  protectedDeletes.length === 2,
  `protected=${protectedDeletes.map((r) => r.id).join(",")}`,
);

// active-agent-jobs placeholder id
report(
  "assistantMessageIdForJob format",
  assistantMessageIdForJob(jobId) === assistantJobId,
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} test(s) failed.`}`);
process.exit(failed > 0 ? 1 : 0);
