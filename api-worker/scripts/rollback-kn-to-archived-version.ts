/**
 * 将项目知识网络当前版回退为指定归档版（不新增版本号）。
 *
 *   npx tsx scripts/rollback-kn-to-archived-version.ts <projectId> <archiveVersion>
 *   npx tsx scripts/rollback-kn-to-archived-version.ts proj-535a240acf88 4
 */
import { formatKnVersionDisplay } from "../src/knowledge-network-version";
import {
  rollbackProjectKnowledgeNetwork,
  type ProjectKnowledgeNetworkEnv,
} from "../src/project-knowledge-network";

async function main() {
  const projectId = (process.argv[2] ?? "").trim();
  const archiveVersion = Number(process.argv[3]);
  if (!projectId || !Number.isFinite(archiveVersion) || archiveVersion < 1) {
    console.error(
      "用法: npx tsx scripts/rollback-kn-to-archived-version.ts <projectId> <archiveVersion>",
    );
    process.exit(1);
  }

  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<ProjectKnowledgeNetworkEnv>({
    configPath: "./wrangler.toml",
    remoteBindings: true,
  });

  try {
    const result = await rollbackProjectKnowledgeNetwork(
      proxy.env,
      projectId,
      "jensen-fang",
      archiveVersion,
    );
    const display = formatKnVersionDisplay(result.meta.version, result.meta.versionLabel);
    const removed =
      result.removedVersion != null
        ? formatKnVersionDisplay(result.removedVersion, result.removedVersionLabel)
        : "?";
    console.log(JSON.stringify({ projectId, current: display, removed }, null, 2));
    console.log("回退完成。");
  } finally {
    await proxy.dispose();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
