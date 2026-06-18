/**
 * 触发 Worker reconcile：轮询所有仍标记 running/pending 的 job（依赖已部署的 reconcileAgentJob）。
 *
 * 用法：
 *   npx tsx scripts/reconcile-stale-agent-jobs.ts
 *   npx tsx scripts/reconcile-stale-agent-jobs.ts jensen-fang jessica-hu
 */

const base = (process.argv.find((a) => a.startsWith("http")) ?? "https://jfo-api.jfo-api.workers.dev").replace(
  /\/$/,
  "",
);
const users = process.argv.slice(2).filter((a) => !a.startsWith("http"));
const targetUsers = users.length > 0 ? users : ["jensen-fang", "jessica-hu", "binghe-su", "jimmy-huang"];

async function pollJob(userId: string, jobId: string): Promise<void> {
  const url = `${base}/api/agent-jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as {
    status?: string;
    error?: string;
    progressLabel?: string;
  };
  console.log(`${userId} ${jobId.slice(0, 8)}… → ${body.status ?? res.status} ${body.error ?? body.progressLabel ?? ""}`);
}

async function reconcileUser(userId: string): Promise<void> {
  const url = `${base}/api/users/${encodeURIComponent(userId)}/active-agent-jobs`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { jobs?: { jobId: string }[] };
  const jobs = data.jobs ?? [];
  console.log(`\n[${userId}] active jobs after reconcile: ${jobs.length}`);
  for (const j of jobs) {
    await pollJob(userId, j.jobId);
  }
}

async function main(): Promise<void> {
  for (const userId of targetUsers) {
    await reconcileUser(userId);
  }
}

void main();
