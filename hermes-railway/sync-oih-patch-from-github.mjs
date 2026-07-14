#!/usr/bin/env node
/**
 * Sync only patched opportunistic-investments-hermes files via GitHub raw + railway ssh.
 * Avoids large stdin base64 (broken on Windows railway ssh).
 *
 * Usage: node hermes-railway/sync-oih-patch-from-github.mjs [sha]
 */
import { spawn } from "node:child_process";

const RAILWAY = process.platform === "win32" ? "railway.cmd" : "railway";
const SHA = process.argv[2] || "597eccc";
const RAW = `https://raw.githubusercontent.com/fangjg16/family-office-platform/${SHA}/hermes-railway/skills/opportunistic-investments-hermes`;

const script = `
set -euo pipefail
KB=/opt/data/skills/opportunistic-investments-hermes
mkdir -p "$KB/references"
curl -fsSL "${RAW}/SKILL.md" -o "$KB/SKILL.md"
curl -fsSL "${RAW}/examples-kb-fragment-batch.json" -o "$KB/examples-kb-fragment-batch.json"
curl -fsSL "${RAW}/references/kb-fragment-batch-schema.md" -o "$KB/references/kb-fragment-batch-schema.md"
grep -q '禁止 Hermes 自评' "$KB/references/kb-fragment-batch-schema.md"
grep -q 'Do not.*include.*maturity\\|Do not include .maturity.\\|Factor A/B are computed by .Worker' "$KB/SKILL.md" || grep -q 'computed by \\*\\*Worker\\*\\*' "$KB/SKILL.md"
echo OK_SYNCED sha=${SHA}
grep -n '禁止 Hermes 自评' "$KB/references/kb-fragment-batch-schema.md" | head -n 1
`.trim();

function railwayBashS(stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(RAILWAY, ["ssh", "-s", "hermes-agent", "--", "bash", "-s"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
      // filter noisy "Using SSH key" only
      const s = d.toString();
      if (!s.includes("Using SSH key")) process.stderr.write(d);
    });
    child.on("close", (code) => {
      if (code === 0 && out.includes("OK_SYNCED")) resolve({ out, err });
      else reject(new Error(`railway ssh exit ${code}\nstdout:\n${out}\nstderr:\n${err}`));
    });
    child.on("error", reject);
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

console.log(`=== sync OIH patch from GitHub ${SHA} ===`);
await railwayBashS(script);
console.log("=== done ===");
