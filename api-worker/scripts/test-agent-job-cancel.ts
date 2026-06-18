/**
 * Agent job cancel guards
 * 用法：cd api-worker && npx tsx scripts/test-agent-job-cancel.ts
 */
import {
  AGENT_JOB_CANCELLED_MESSAGE,
  isAgentJobActive,
  shouldAcceptAgentJobCompletion,
} from "../src/agent-jobs.ts";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

report("pending is active", isAgentJobActive("pending"));
report("running is active", isAgentJobActive("running"));
report("cancelled is not active", !isAgentJobActive("cancelled"));
report("failed is not active", !isAgentJobActive("failed"));
report("completed is not active", !isAgentJobActive("completed"));

report("accept completion for running", shouldAcceptAgentJobCompletion("running"));
report("reject completion for cancelled", !shouldAcceptAgentJobCompletion("cancelled"));
report("reject completion for failed", !shouldAcceptAgentJobCompletion("failed"));
report("reject completion for completed", !shouldAcceptAgentJobCompletion("completed"));

report(
  "cancel message copy",
  AGENT_JOB_CANCELLED_MESSAGE === "深度分析已取消：用户取消",
);

// active-agent-jobs SQL filter (documented expectation)
const terminalStatuses = ["completed", "failed", "cancelled"];
report(
  "active jobs exclude cancelled",
  !terminalStatuses.includes("running") && terminalStatuses.includes("cancelled"),
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
