/**
 * 取消进行中的 agent job（D1 + 对话占位消息）
 * 用法：npx tsx scripts/cancel-agent-job.ts <jobId> [userId]
 */
import { failAgentJob, getAgentJobById } from "../src/agent-jobs";

type Env = { DB: D1Database; FILES: R2Bucket; JFO_INTERNAL_KEY?: string };

async function main() {
  const jobId = (process.argv[2] ?? "").trim();
  if (!jobId) {
    console.error("用法: npx tsx scripts/cancel-agent-job.ts <jobId>");
    process.exit(1);
  }

  const answer =
    "任务已由用户取消。\n\n（Hermes 后台 Run 可能仍在执行，但平台不再等待其结果；可重新发起 slot patch 测试。）";

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<Env>({
    configPath: "./wrangler.toml",
    remoteBindings: true,
  });
  const env = proxy.env;

  const row = await getAgentJobById(env, jobId);
  if (!row) {
    console.error("job 不存在:", jobId);
    process.exit(1);
  }
  if (row.status !== "pending" && row.status !== "running") {
    console.log(JSON.stringify({ jobId, status: row.status, note: "已是终态，无需取消" }));
    await proxy.dispose();
    return;
  }

  await failAgentJob(env, jobId, "用户取消", answer);
  const after = await getAgentJobById(env, jobId);
  console.log(
    JSON.stringify(
      {
        jobId,
        status: after?.status,
        error: after?.error,
        answerPreview: after?.answer?.slice(0, 120),
      },
      null,
      2,
    ),
  );
  await proxy.dispose();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
