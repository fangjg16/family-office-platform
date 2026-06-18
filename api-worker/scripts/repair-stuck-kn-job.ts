/**
 * 修复「KN 已 PUT 但 agent_jobs 仍 running、对话无消息」的卡死任务。
 *
 * 用法（部署含 finalizeAgentJobAfterKnPut 的 Worker 后）：
 *   curl "https://jfo-api.jfo-api.workers.dev/api/agent-jobs/JOB_ID?userId=USER_ID"
 *
 * 轮询接口会先尝试 finalizeAgentJobAfterKnPut，再写回 user/assistant 消息。
 *
 * PET 示例：
 *   curl "https://jfo-api.jfo-api.workers.dev/api/agent-jobs/c379f423?userId=jensen-fang"
 */

const jobId = (process.argv[2] ?? "c379f423").trim();
const userId = (process.argv[3] ?? "jensen-fang").trim();
const base = (process.argv[4] ?? "https://jfo-api.jfo-api.workers.dev").replace(/\/$/, "");

async function main(): Promise<void> {
  const url = `${base}/api/agent-jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  console.log(res.status, JSON.stringify(body, null, 2));
  if (!res.ok) process.exit(1);
  const status = (body as { status?: string }).status;
  if (status !== "completed" && status !== "failed") {
    console.error("任务仍未终态，请稍后重试或检查 D1 agent_jobs / project_knowledge_networks");
    process.exit(2);
  }
}

void main();
