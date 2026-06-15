/**
 * 本地验收 v2.8 KB HTML 校验（sample-output + reorder）
 * 用法：cd api-worker && npx tsx scripts/validate-kb-v28-samples.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_KB_SLOTS,
  validateKnowledgeNetworkHtml,
  validateSampleOutputChecks,
} from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(
  here,
  "../../hermes-railway/skills/knowledge-base-generation/examples",
);

function read(name: string): string {
  return readFileSync(join(examplesDir, name), "utf8");
}

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

console.log("=== v2.8 KB validation (Worker validateKnowledgeNetworkHtml) ===\n");

const sample = read("sample-output.html");
const sampleChecks = validateSampleOutputChecks(sample);
report("sample-output.html validateSampleOutputChecks", sampleChecks.ok);
if (!sampleChecks.ok) {
  for (const e of sampleChecks.errors) console.log(`       ${e}`);
}
for (const slot of CANONICAL_KB_SLOTS) {
  report(`  slot #${slot}`, sampleChecks.checks[`slot_${slot}`] === true);
}
report("  revealAnchor", sampleChecks.checks.hasRevealAnchor === true);
report("  citation #source-U-1", sampleChecks.checks.citationU1 === true);
report("  appendix id=source-U-1", sampleChecks.checks.appendixU1 === true);

const strictSample = validateKnowledgeNetworkHtml(sample, {
  strict: true,
  mode: "initial",
});
report("sample-output strict initial", strictSample.ok, strictSample.error);

const reordered = read("sample-output-reordered.html");
const reorderResult = validateKnowledgeNetworkHtml(reordered, {
  strict: true,
  mode: "reorder",
  previousHtml: sample,
});
report("sample-output-reordered reorder vs original", reorderResult.ok, reorderResult.error);

const assetsTemplate = readFileSync(
  join(
    here,
    "../../hermes-railway/skills/knowledge-base-generation/assets/kb-template.html",
  ),
  "utf8",
);
report("assets/kb-template.html has revealAnchor", /revealAnchor/i.test(assetsTemplate));

console.log("");
if (failed === 0) {
  console.log("All checks passed.");
  process.exit(0);
}
console.error(`${failed} check(s) failed.`);
process.exit(1);
