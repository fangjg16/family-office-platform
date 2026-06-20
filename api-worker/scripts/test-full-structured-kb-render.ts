/**
 * Full Structured KB Data → Worker HTML renderer tests
 * 用法：cd api-worker && npx tsx scripts/test-full-structured-kb-render.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_KB_SLOTS,
  KB_APPENDIX_SLOTS,
  extractAppendixASourceIdSet,
  validateKnowledgeNetworkHtmlForWrite,
} from "../src/knowledge-network-html-validation.ts";
import { renderAppendixVersionLedgerPlaceholder } from "../src/knowledge-network-full-renderer.ts";
import {
  assertWorkerKbTemplateMarkers,
  compareKbTemplateWithHermesSkill,
  loadWorkerKbTemplate,
} from "../src/knowledge-network-kb-template.ts";
import {
  buildKnVersionLedgerRows,
  mergeKnVersionLedgerHtml,
} from "../src/knowledge-network-version-ledger.ts";
import {
  extractStructuredKbDataFromJson,
  normalizeStructuredKbSources,
  renderStructuredKbDataToHtml,
  validateStructuredKbData,
} from "../src/knowledge-network-structured-kb-data.ts";
import type { StructuredKbData } from "../src/knowledge-network-structured-kb-data-types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures/full-structured-kb-data-pet-rich.json");
const hermesTemplatePath = join(
  here,
  "../../hermes-railway/skills/opportunistic-investments-hermes/assets/kb-template.html",
);

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function loadFixture(): StructuredKbData {
  const extracted = extractStructuredKbDataFromJson(readFileSync(fixturePath, "utf8"));
  if (!extracted.ok) throw new Error(extracted.reason);
  return extracted.data;
}

const fixture = loadFixture();

report("fixture extractStructuredKbDataFromJson", true);

const validated = validateStructuredKbData(fixture);
report("validateStructuredKbData", validated.ok, validated.ok ? "" : validated.reason);

const rendered = renderStructuredKbDataToHtml(fixture);
report("renderStructuredKbDataToHtml", rendered.ok, rendered.ok ? "" : rendered.reason);

if (!rendered.ok) {
  console.log("\nRenderer failed; skipping HTML assertions.");
  process.exit(1);
}

const html = rendered.html;

const strict = validateKnowledgeNetworkHtmlForWrite(html, { mode: "full", strict: true });
report(
  "validateKnowledgeNetworkHtmlForWrite full strict",
  strict.ok,
  strict.ok ? strict.warning ?? "" : strict.error,
);

for (const slot of CANONICAL_KB_SLOTS) {
  report(`section id=${slot}`, new RegExp(`\\bid=["']${slot}["']`, "i").test(html));
}

for (const appendix of KB_APPENDIX_SLOTS) {
  report(`appendix id=${appendix}`, new RegExp(`\\bid=["']${appendix}["']`, "i").test(html));
}

report("KB-CONFIG schema-version 2.91", /schema-version:\s*2\.91/i.test(html));
report("KB-CONFIG quality-coverage", /quality-coverage:\s*\d+/i.test(html));
report("nav aria-label", /class=["']kb-nav["']/i.test(html));
report("overview panel", /\bid=["']overview["']/i.test(html));
report("revealAnchor JS", /function revealAnchor\(anchorId\)/.test(html));

const appendixIds = extractAppendixASourceIdSet(html);
const citeRefs = [...html.matchAll(/href=["']#(source-[A-Za-z0-9_-]+)["']/gi)].map((m) => m[1]);
const orphanCites = citeRefs.filter((id) => !appendixIds.has(id));
report(
  "all cite-ref targets in Appendix A",
  orphanCites.length === 0,
  orphanCites.length ? orphanCites.join(", ") : "",
);

report(
  "Appendix D placeholder (no Hermes rows)",
  html.includes("<!-- WORKER_VERSION_LEDGER -->"),
);

const dupSources = normalizeStructuredKbSources([
  { id: "U-1", type: "用户", title: "a" },
  { id: "U-1", type: "用户", title: "b" },
]);
report("duplicate source id reject", Boolean(dupSources.error));

const withVersionLedger = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
withVersionLedger.versionLedger = [{ version: "v9", time: "x" }];
const badExtract = extractStructuredKbDataFromJson(JSON.stringify(withVersionLedger));
report("reject versionLedger in JSON", !badExtract.ok);

const ledgerRows = buildKnVersionLedgerRows(
  [],
  {
    version: 1,
    versionLabel: null,
    updatedAt: "2026-06-20T00:00:00.000Z",
    updatedBy: "jensen-fang",
    changelog: "structured-full fixture",
  },
);
const mergedLedger = mergeKnVersionLedgerHtml(html, [], {
  version: 1,
  versionLabel: null,
  updatedAt: "2026-06-20T00:00:00.000Z",
  updatedBy: "jensen-fang",
  changelog: "structured-full fixture",
}).html;
report(
  "D1 merge replaces placeholder",
  !mergedLedger.includes("<!-- WORKER_VERSION_LEDGER -->") &&
    mergedLedger.includes("structured-full fixture") &&
    ledgerRows.length === 1,
);

const workerMarkers = assertWorkerKbTemplateMarkers();
report("worker kb-template markers", workerMarkers.length === 0, workerMarkers.join("; "));

const hermesTemplate = readFileSync(hermesTemplatePath, "utf8");
const drift = compareKbTemplateWithHermesSkill(hermesTemplate);
report("worker vs hermes template drift", drift.length === 0, drift.join("; "));

report("embedded template loads", loadWorkerKbTemplate().length > 1000);
report(
  "version ledger placeholder export",
  renderAppendixVersionLedgerPlaceholder().includes('id="version-ledger"'),
);

console.log(`\nHTML length: ${html.length} bytes`);
console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
