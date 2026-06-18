/**
 * 将 D1 中的 KB 版本历史写回当前 HTML 附录 D（不升版本）。
 *
 *   npx tsx scripts/refresh-kn-version-ledger.ts [projectId]
 *   npx tsx scripts/refresh-kn-version-ledger.ts proj-535a240acf88
 */
import { refreshProjectKnowledgeNetworkVersionLedger } from "../src/project-knowledge-network";

type Env = { DB: D1Database; FILES: R2Bucket };

async function main() {
  const projectId = (process.argv[2] ?? "").trim();
  if (!projectId) {
    console.error("用法: npx tsx scripts/refresh-kn-version-ledger.ts <projectId>");
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.error("需要 CLOUDFLARE_ACCOUNT_ID 与 CLOUDFLARE_API_TOKEN，或在本机 wrangler dev 环境运行。");
    process.exit(1);
  }

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<Env>({ configPath: "./wrangler.toml" });
  const env = proxy.env;

  const result = await refreshProjectKnowledgeNetworkVersionLedger(env, projectId);
  console.log(JSON.stringify({ projectId, ...result }, null, 2));
  await proxy.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
