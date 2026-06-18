/**
 * 取消进行中的 agent job（D1 + 对话占位消息）
 * 用法：npx tsx scripts/cancel-agent-job.ts <jobId> [userId]
 */
import { cancelAgentJob, getAgentJob } from "../src/agent-jobs";

type Env = { DB: D1Database; FILES: R2Bucket; JFO_INTERNAL_KEY?: string; HERMES_BASE_URL?: string; HERMES_API_KEY?: string };

async function main() {
  const jobId = (process.argv[2] ?? "").trim();
  const userId = (process.argv[3] ?? "jensen-fang").trim();
  if (!jobId) {
    console.error("用法: npx tsx scripts/cancel-agent-job.ts <jobId> [userId]");
    process.exit(1);
  }

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<Env>({
    configPath: "./wrangler.toml",
    remoteBindings: true,
  });
  const env = proxy.env;

  const before = await getAgentJob(env, jobId, userId);
  if (!before) {
    console.error("job 不存在:", jobId);
    process.exit(1);
  }

  const result = await cancelAgentJob(env, jobId, userId);
  const after = await getAgentJob(env, jobId, userId);
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        error: result.ok ? undefined : result.error,
        jobId,
        status: after?.status,
        answerPreview: after?.answer?.slice(0, 120),
        hermesCancelAttempted: result.ok ? result.hermesCancelAttempted : undefined,
      },
      null,
      2,
    ),
  );
  await proxy.dispose();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
