/**
 * KB validation policy tests (citation repair / duplicate / scorecard / upload)
 * 用法：cd api-worker && npx tsx scripts/test-kb-validation-policy.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLegacySlotInvalidFixture,
  findDuplicateAppendixSourceIds,
  repairOrphanCitationLinks,
  validateKnowledgeNetworkHtml,
  validateKnowledgeNetworkHtmlForWrite,
} from "../src/knowledge-network-html-validation.ts";
import {
  applyStructuredSlotPatchToKnowledgeNetworkHtml,
  validateEvidenceSourceIdsAgainstAppendixA,
  validateMergedKnowledgeNetworkAfterStructuredPatch,
} from "../src/knowledge-network-structured-patch.ts";
import {
  applySlotHtmlPatchToKnowledgeNetworkHtml,
  validateSlotPatchSourceCitations,
} from "../src/knowledge-network-slot-patch.ts";
import { buildHermesKnowledgeNetworkRequiredReads } from "../src/hermes-knowledge-network.ts";
import { resolveKnowledgeNetworkSlotsFromMessage } from "../src/knowledge-network-slot-aliases.ts";

const here = dirname(fileURLToPath(import.meta.url));
const sampleKb = readFileSync(
  join(here, "../../hermes-railway/skills/opportunistic-investments-hermes/sample-output.html"),
  "utf8",
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

const orphanCitationKb = sampleKb.replace(
  '<sup class="cite-ref"><a href="#source-A-3">[A-3]</a></sup>',
  '<sup class="cite-ref"><a href="#source-A-99">[A-99]</a></sup>',
);

const fullOrphan = validateKnowledgeNetworkHtml(orphanCitationKb, {
  strict: true,
  mode: "full",
});
report(
  "raw full mode orphan citation still strict-fails (pre-repair)",
  !fullOrphan.ok,
  fullOrphan.error,
);

const repairedWrite = validateKnowledgeNetworkHtmlForWrite(orphanCitationKb, {
  strict: true,
  mode: "full",
});
report("full orphan citation repaired for write", repairedWrite.ok, repairedWrite.error);
report(
  "full orphan citation write returns warning",
  Boolean(repairedWrite.warning?.includes("source-A-99")),
  repairedWrite.warning,
);
if (repairedWrite.html) {
  report(
    "repaired html uses cite-gap",
    repairedWrite.html.includes('class="cite-gap"') &&
      repairedWrite.html.includes("[A-99 来源待补]"),
  );
  report(
    "cite-gap has no orphan href (no revealAnchor target)",
    !repairedWrite.html.includes('href="#source-A-99"'),
  );
  report(
    "cite-gap replaced anchor with non-clickable span",
    /<sup class="cite-ref"><span class="cite-gap">\[A-99 来源待补\]<\/span><\/sup>/.test(
      repairedWrite.html,
    ),
  );
  report(
    "repaired html passes strict full validation",
    validateKnowledgeNetworkHtml(repairedWrite.html, { strict: true, mode: "full" }).ok,
  );
}

const initialOrphan = validateKnowledgeNetworkHtmlForWrite(orphanCitationKb, {
  strict: true,
  mode: "initial",
});
report("initial orphan citation repaired for write", initialOrphan.ok, initialOrphan.error);

const structuredPatch = {
  type: "structured-slot-patch" as const,
  schemaVersion: "2.91" as const,
  mode: "incremental" as const,
  slot: "risks-mitigation" as const,
  operation: "replace-slot-data" as const,
  payload: {
    riskRows: [
      {
        level: "高",
        risk: "测试",
        evidenceSourceIds: ["U-99"],
      },
    ],
  },
  summary: "test",
};

const unknownStructured = validateEvidenceSourceIdsAgainstAppendixA(
  sampleKb,
  structuredPatch.payload,
);
report("structured unknown source hard rejected", unknownStructured != null);

const unknownStructuredApply = applyStructuredSlotPatchToKnowledgeNetworkHtml(
  sampleKb,
  structuredPatch,
);
report(
  "structured unknown source apply fails",
  !unknownStructuredApply.ok,
  unknownStructuredApply.ok ? "" : unknownStructuredApply.error,
);

const risksSection = `<section class="block kb-panel" id="risks-mitigation">
<h2 class="section-title"><span class="section-num">十一</span>关键风险</h2>
<p><sup class="cite-ref"><a href="#source-U-99">[U-99]</a></sup></p>
</section>`;
const htmlPatch = {
  type: "slot-html-patch" as const,
  schemaVersion: "2.91" as const,
  mode: "incremental" as const,
  slot: "risks-mitigation" as const,
  replace: "section" as const,
  sectionHtml: risksSection,
  summary: "test",
};
const unknownHtmlPatch = validateSlotPatchSourceCitations(sampleKb, htmlPatch);
report(
  "slot-html-patch unknown source hard rejected",
  !unknownHtmlPatch.ok,
  unknownHtmlPatch.ok ? "" : unknownHtmlPatch.reason,
);
const unknownHtmlApply = applySlotHtmlPatchToKnowledgeNetworkHtml(sampleKb, htmlPatch);
report(
  "slot-html-patch unknown source apply fails",
  !unknownHtmlApply.ok,
);

const dupKb = sampleKb.replace(
  /(<section[^>]*id=["']source-index["'][\s\S]*?<tbody>)([\s\S]*?)(<\/tbody>)/i,
  '$1$2<tr><td><span id="source-A-1">A-1-dup</span></td><td>dup</td><td>dup</td><td>dup</td><td>dup</td><td>dup</td></tr>$3',
);
report(
  "duplicate appendix source id detected",
  findDuplicateAppendixSourceIds(dupKb).includes("source-A-1"),
);
const dupWrite = validateKnowledgeNetworkHtmlForWrite(dupKb, { strict: true, mode: "full" });
report("duplicate appendix source id hard reject on write", !dupWrite.ok, dupWrite.error);
report(
  "duplicate error lists repeated id",
  dupWrite.error?.includes("source-A-1") ?? false,
  dupWrite.error,
);

const badScorecard = patchStatValues(sampleKb, "7/11", "6", "C+");
const scorecardWrite = validateKnowledgeNetworkHtmlForWrite(badScorecard, {
  strict: true,
  mode: "full",
});
report("full bad scorecard normalized for write", scorecardWrite.ok, scorecardWrite.error);
report(
  "full bad scorecard write warning",
  Boolean(scorecardWrite.warning?.includes("成熟度")),
  scorecardWrite.warning,
);
if (scorecardWrite.html) {
  report(
    "normalized scorecard values are percentages or em-dash",
    /stat-value">63\.6%</.test(scorecardWrite.html) &&
      /stat-value">6%</.test(scorecardWrite.html) &&
      /stat-value">—</.test(scorecardWrite.html),
  );
}

const badScorecardIncremental = validateKnowledgeNetworkHtml(badScorecard, {
  strict: true,
  mode: "incremental",
});
report(
  "incremental mode skips scorecard hard reject",
  badScorecardIncremental.ok,
  badScorecardIncremental.error,
);

const structuredOnBadScorecard = applyStructuredSlotPatchToKnowledgeNetworkHtml(
  badScorecard,
  {
    type: "structured-slot-patch",
    schemaVersion: "2.91",
    mode: "incremental",
    slot: "risks-mitigation",
    operation: "replace-slot-data",
    payload: {
      riskRows: [{ level: "中", risk: "结构化 patch 不应被 scorecard 阻断" }],
    },
    summary: "test",
  },
);
report(
  "structured patch on bad scorecard kb still applies",
  structuredOnBadScorecard.ok,
  structuredOnBadScorecard.ok ? "" : structuredOnBadScorecard.error,
);

const incompleteKb = buildLegacySlotInvalidFixture(sampleKb);
const uploadReject = validateKnowledgeNetworkHtmlForWrite(incompleteKb, {
  strict: true,
  mode: "full",
  browserUpload: true,
});
report(
  "browser upload rejects incomplete 13-slot kb",
  !uploadReject.ok,
  uploadReject.error,
);

const legacyV28 = sampleKb.replace(/id="snapshot"/, 'id="assets"');
const legacyUpload = validateKnowledgeNetworkHtmlForWrite(legacyV28, {
  strict: true,
  mode: "full",
  browserUpload: true,
});
report(
  "browser upload rejects legacy v2.8 anchor",
  !legacyUpload.ok,
  legacyUpload.error,
);

const uploadOk = validateKnowledgeNetworkHtmlForWrite(sampleKb, {
  strict: true,
  mode: "full",
  browserUpload: true,
});
report("browser upload accepts valid sample kb", uploadOk.ok, uploadOk.error);

const repairOnly = repairOrphanCitationLinks(orphanCitationKb);
report(
  "repairOrphanCitationLinks removes bad href",
  !repairOnly.html.includes('href="#source-A-99"'),
);

const kbWithLegacyOrphan = sampleKb.replace(
  /(<section[^>]*id=["']snapshot["'][\s\S]*?<td>AI 内容版权)/,
  '<sup class="cite-ref"><a href="#source-A-99">[A-99]</a></sup> $1',
);
const legacyOrphanIncremental = validateKnowledgeNetworkHtml(kbWithLegacyOrphan, {
  strict: true,
  mode: "incremental",
});
report(
  "incremental merge tolerates pre-existing orphan citations",
  legacyOrphanIncremental.ok,
  legacyOrphanIncremental.error,
);
const patchOnLegacyOrphan = applyStructuredSlotPatchToKnowledgeNetworkHtml(
  kbWithLegacyOrphan,
  {
    type: "structured-slot-patch",
    schemaVersion: "2.91",
    mode: "incremental",
    slot: "risks-mitigation",
    operation: "replace-slot-data",
    payload: {
      riskRows: [{ level: "中", risk: "旧页 orphan 不应阻断无关 slot" }],
    },
    summary: "test",
  },
);
report(
  "structured patch on kb with legacy orphan applies",
  patchOnLegacyOrphan.ok,
  patchOnLegacyOrphan.ok ? "" : patchOnLegacyOrphan.error,
);
if (patchOnLegacyOrphan.ok) {
  const mergedValidation = validateMergedKnowledgeNetworkAfterStructuredPatch(
    patchOnLegacyOrphan.html,
    { previousHtml: kbWithLegacyOrphan, touchesTimeline: false },
  );
  report(
    "structured patch merge passes with legacy orphan elsewhere",
    mergedValidation.ok,
    mergedValidation.error,
  );
}

const riskReads = buildHermesKnowledgeNetworkRequiredReads({
  mode: "incremental",
  touchedSlots: resolveKnowledgeNetworkSlotsFromMessage("只更新关键风险"),
  slotPatchMode: true,
});
report(
  "required-reads single-slot primary is structured-slot-patch",
  riskReads.includes("structured-slot-patch") &&
    riskReads.includes("backward-compatible fallback") &&
    !/正常路径.*slot-html-patch/.test(riskReads),
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
