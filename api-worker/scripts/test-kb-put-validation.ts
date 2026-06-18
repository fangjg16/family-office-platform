/**
 * Simulates Worker PUT validation path for v2.91 sample HTML (no live HTTP).
 * 用法：cd api-worker && npx tsx scripts/test-kb-put-validation.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateKnowledgeNetworkHtml } from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, "../../hermes-railway/skills/opportunistic-investments-hermes");

const modes = ["initial", "full", "incremental", "reorder"] as const;
const sample = readFileSync(join(skillDir, "sample-output.html"), "utf8");
const reordered = readFileSync(join(skillDir, "sample-output-reordered.html"), "utf8");

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

console.log("=== mock PUT validation (validateKnowledgeNetworkHtml strict) ===\n");

for (const mode of ["initial", "full", "incremental"] as const) {
  const r = validateKnowledgeNetworkHtml(sample, { strict: true, mode });
  report(`sample-output mode=${mode}`, r.ok, r.error);
}

const reorder = validateKnowledgeNetworkHtml(reordered, {
  strict: true,
  mode: "reorder",
  previousHtml: sample,
});
report("sample-output-reordered mode=reorder", reorder.ok, reorder.error);

const putScript = readFileSync(join(skillDir, "scripts/jfo_kb_put.sh"), "utf8");
report("jfo_kb_put.sh exists in skill tree", putScript.includes("schema-version"));
report("jfo_kb_put.sh uses JFO_INTERNAL_KEY", putScript.includes("JFO_INTERNAL_KEY"));
report("jfo_kb_put.sh uses curl PUT only", putScript.includes("curl -sS") && putScript.includes("--data-binary"));

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
