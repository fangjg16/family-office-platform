#!/usr/bin/env node
/**
 * 本地 opportunistic-investments-hermes → Railway /opt/data/skills
 * 用法: node hermes-railway/sync-opportunistic-skill-railway.mjs
 */
import { spawnSync, spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const RAILWAY = process.platform === "win32" ? "railway.cmd" : "railway";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(root, "hermes-railway", "skills", "opportunistic-investments-hermes");
const tmpDir = path.join(os.tmpdir(), "jfo-hermes-sync");
const tarPath = path.join(tmpDir, "oih-skill.tgz");
const b64Path = path.join(tmpDir, "oih-skill.b64");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${r.status}): ${r.stderr || r.stdout}`);
  }
  return r;
}

function railway(args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(RAILWAY, ["ssh", "-s", "hermes-agent", "--", ...args], {
      stdio: [stdin ? "pipe" : "inherit", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`railway ssh exit ${code}`))));
    child.on("error", reject);
  });
}

if (!existsSync(skillDir)) {
  console.error("missing", skillDir);
  process.exit(1);
}
mkdirSync(tmpDir, { recursive: true });

console.log("=== pack ===");
run("tar", ["-czf", tarPath, "-C", path.join(root, "hermes-railway", "skills"), "opportunistic-investments-hermes"]);
const b64 = readFileSync(tarPath).toString("base64");
console.log(`tar ${Math.round(readFileSync(tarPath).length / 1024)} KB`);

console.log("=== upload base64 to /opt/data/oih-skill.b64 ===");
await railway(["bash", "-c", "cat > /opt/data/oih-skill.b64"], b64);

const verify = `
set -euo pipefail
export HERMES_SKILLS_DIR=/opt/data/skills
mkdir -p "$HERMES_SKILLS_DIR" /opt/data/kb /opt/data/logs
test -s /opt/data/oih-skill.b64
base64 -d /opt/data/oih-skill.b64 | tar -xzf - -C "$HERMES_SKILLS_DIR"
rm -f /opt/data/oih-skill.b64
KB="$HERMES_SKILLS_DIR/opportunistic-investments-hermes"
LEGACY="$HERMES_SKILLS_DIR/knowledge-base-generation"
DEPRECATED="$HERMES_SKILLS_DIR/knowledge-base-generation_deprecated"
if [ -d "$LEGACY" ] && [ "$(basename "$LEGACY")" = "knowledge-base-generation" ]; then
  rm -rf "$DEPRECATED" 2>/dev/null || true
  mv "$LEGACY" "$DEPRECATED"
  echo "DEPRECATED $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DEPRECATED/DEPRECATED"
fi
test -f "$KB/SKILL.md"
test -f "$KB/references/kb-fragment-batch-schema.md"
grep -q 'JSON escaping' "$KB/references/kb-fragment-batch-schema.md"
grep -q '禁止 Hermes 自评' "$KB/references/kb-fragment-batch-schema.md"
test -f "$KB/examples-kb-fragment-batch-risks-diligence.json"
grep -q 'details class="oq-group"' "$KB/examples-kb-fragment-batch-risks-diligence.json"
grep -q '#source-index' "$KB/assets/kb-template.html"
test -f "$KB/examples-kb-fragment-batch-business-ops.json"
echo OK: opportunistic-investments-hermes synced at $KB
ls -1 "$KB"/examples-kb-fragment-batch*.json
`.trim();

console.log("=== extract + verify ===");
await railway(["bash", "-s"], verify);

console.log("=== done ===");
