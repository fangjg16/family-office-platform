/**
 * KB-CONFIG schema-version parser tests (PUT + fallback 共用 validateKnowledgeNetworkHtml)
 * 用法：cd api-worker && npx tsx scripts/test-kb-config-schema.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractKbConfigCommentBody,
  parseKbConfigSchemaVersion,
  validateKnowledgeNetworkHtml,
} from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const samplePath = join(
  here,
  "../../hermes-railway/skills/opportunistic-investments-hermes/sample-output.html",
);
const sample = readFileSync(samplePath, "utf8");

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

report("sample parseKbConfigSchemaVersion", parseKbConfigSchemaVersion(sample) === "2.91");
report("sample extractKbConfigCommentBody", Boolean(extractKbConfigCommentBody(sample)));

const strictSample = validateKnowledgeNetworkHtml(sample, { strict: true, mode: "full" });
report("sample strict full PUT path", strictSample.ok, strictSample.error);

const noSchema = sample.replace(/schema-version:\s*2\.91/i, "");
const noSchemaResult = validateKnowledgeNetworkHtml(noSchema, { strict: true, mode: "full" });
report(
  "missing schema-version must fail",
  !noSchemaResult.ok && /schema-version/.test(noSchemaResult.error ?? ""),
  noSchemaResult.error,
);

const jsonOnlyBad = sample.replace(
  /<!--\s*KB-CONFIG[\s\S]*?-->/i,
  '<script type="application/json" id="kb-config">{"schema-version":"2.91"}</script>',
);
const jsonOnlyResult = validateKnowledgeNetworkHtml(jsonOnlyBad, { strict: true, mode: "full" });
report(
  "JSON-only without KB-CONFIG comment must fail",
  !jsonOnlyResult.ok,
  jsonOnlyResult.error,
);

const jsonInsideComment = sample.replace(
  /schema-version:\s*2\.91/i,
  '"schema-version": "2.91"',
);
const jsonInsideResult = validateKnowledgeNetworkHtml(jsonInsideComment, {
  strict: true,
  mode: "full",
});
report(
  "JSON key inside comment (no line format) must fail",
  !jsonInsideResult.ok,
  jsonInsideResult.error,
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
