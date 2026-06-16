/**
 * Maturity scorecard strict validation fixtures
 * 用法：cd api-worker && npx tsx scripts/validate-maturity-scorecard-fixtures.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateKnowledgeNetworkHtml } from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = join(
  here,
  "../../hermes-railway/skills/knowledge-base-generation/examples/sample-output.html",
);

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function patchStatValues(html: string, a: string, b: string, c: string): string {
  return html
    .replace(
      /(<div class="stat-item stat-item-a">[\s\S]*?<div class="stat-value">)[^<]*(<\/div>)/i,
      `$1${a}$2`,
    )
    .replace(
      /(<div class="stat-item stat-item-b">[\s\S]*?<div class="stat-value">)[^<]*(<\/div>)/i,
      `$1${b}$2`,
    )
    .replace(
      /(<div class="stat-item stat-item-c">[\s\S]*?<div class="stat-value">)[^<]*(<\/div>)/i,
      `$1${c}$2`,
    );
}

const sample = readFileSync(samplePath, "utf8");

const good = patchStatValues(sample, "64%", "55%", "60%");
const bad = patchStatValues(sample, "7/11", "6", "C+");

const goodResult = validateKnowledgeNetworkHtml(good, { strict: true, mode: "full" });
report(
  "64% / 55% / 60% strict full",
  goodResult.ok,
  goodResult.error,
);

const badResult = validateKnowledgeNetworkHtml(bad, { strict: true, mode: "full" });
report(
  "7/11 / 6 / C+ rejected",
  !badResult.ok &&
    badResult.error ===
      "Maturity scorecard main values must be percentages; move counts/letter grades to notes.",
  badResult.error,
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
