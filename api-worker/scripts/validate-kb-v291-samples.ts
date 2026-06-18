/**
 * v2.91 KB sample validation
 * 用法：cd api-worker && npx tsx scripts/validate-kb-v291-samples.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLegacySlotInvalidFixture,
  validateKnowledgeNetworkHtml,
  validateSampleOutputChecks,
} from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, "../../hermes-railway/skills/opportunistic-investments-hermes");
const legacyV28Sample = join(
  here,
  "../../hermes-railway/skills/knowledge-base-generation/examples/sample-output.html",
);

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const sample = readFileSync(join(skillDir, "sample-output.html"), "utf8");
const reordered = readFileSync(join(skillDir, "sample-output-reordered.html"), "utf8");

console.log("=== v2.91 KB validation (Worker validateKnowledgeNetworkHtml) ===\n");

const sampleChecks = validateSampleOutputChecks(sample);
report("sample-output.html validateSampleOutputChecks", sampleChecks.ok, sampleChecks.errors.join("; "));

const strictSample = validateKnowledgeNetworkHtml(sample, { strict: true, mode: "initial" });
report("sample-output strict initial", strictSample.ok, strictSample.error);

const strictFull = validateKnowledgeNetworkHtml(sample, { strict: true, mode: "full" });
report("sample-output strict full", strictFull.ok, strictFull.error);

const reorderResult = validateKnowledgeNetworkHtml(reordered, {
  strict: true,
  mode: "reorder",
  previousHtml: sample,
});
report("sample-output-reordered reorder vs original", reorderResult.ok, reorderResult.error);

const incomplete = buildLegacySlotInvalidFixture(sample);
const incompleteResult = validateKnowledgeNetworkHtml(incomplete, {
  strict: true,
  mode: "full",
});
report(
  "incomplete 10-slot fixture must be REJECTED",
  !incompleteResult.ok,
  incompleteResult.error,
);

let legacyV28Ok = false;
try {
  const legacyV28 = readFileSync(legacyV28Sample, "utf8");
  const legacyResult = validateKnowledgeNetworkHtml(legacyV28, { strict: true, mode: "full" });
  legacyV28Ok = !legacyResult.ok;
  report("legacy v2.8 11-slot sample rejected", legacyV28Ok, legacyResult.error);
} catch {
  report("legacy v2.8 sample file present", false, "missing knowledge-base-generation/examples/sample-output.html");
}

const template = readFileSync(join(skillDir, "assets/kb-template.html"), "utf8");
report("assets/kb-template.html has revealAnchor", /revealAnchor/i.test(template));

const deepDir = join(skillDir, "references/deep");
const deepFiles = ["knowledge-base-generation.md", "project-intake.md", "public-info-search.md", "dd-claim-audit.md", "compliance-check.md", "risk-matrix.md", "returns-analysis.md"];
for (const f of deepFiles) {
  try {
    readFileSync(join(deepDir, f), "utf8");
    report(`deep ref ${f}`, true);
  } catch {
    report(`deep ref ${f}`, false, "missing");
  }
}

console.log(`\n${failed === 0 ? "All checks passed." : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
