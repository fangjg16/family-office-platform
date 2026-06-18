/**
 * Slot HTML Patch unit tests
 * 用法：cd api-worker && npx tsx scripts/test-slot-html-patch.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySlotHtmlPatchToKnowledgeNetworkHtml,
  extractSlotHtmlPatchFromAnswer,
  validateMergedKnowledgeNetworkAfterSlotPatch,
  validateSlotHtmlPatch,
  validateSlotPatchSourceCitations,
} from "../src/knowledge-network-slot-patch.ts";

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

const newRisksSection = `<section class="block kb-panel" id="risks-mitigation">
<h2 class="section-title"><span class="section-num">十一</span>关键风险与缓释</h2>
<table class="risk-matrix-table"><thead><tr><th>级别</th><th>风险</th><th>原因/触发</th><th>影响</th><th>证据</th><th>缓释/负责人/状态</th></tr></thead><tbody><tr><td>高</td><td>供应链中断</td><td>单一供应商</td><td>交付延迟</td><td>待核实</td><td>引入备份供应商</td></tr></tbody></table>
</section>`;

const risksPatch = {
  type: "slot-html-patch" as const,
  schemaVersion: "2.91" as const,
  mode: "incremental" as const,
  slot: "risks-mitigation" as const,
  replace: "section" as const,
  sectionHtml: newRisksSection,
  appendixUpdates: { versionLedgerRowHtml: null },
  summary: "仅更新 risks-mitigation",
};

const timelineSection = `<section class="block kb-panel" id="timeline-milestones">
<h2 class="section-title"><span class="section-num">十二</span>项目时间轴</h2>
<p class="section-sub">PROJECT TIMELINE</p>
<div class="timeline"><div class="tl-item"><span class="tl-date">2026-06-20</span><span class="tl-text"><strong>项目方签约</strong> 完成 LOI 签署。</span></div></div>
</section>`;

const timelinePatch = {
  ...risksPatch,
  slot: "timeline-milestones" as const,
  sectionHtml: timelineSection,
  summary: "仅更新 timeline-milestones",
};

const risksApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(sampleKb, risksPatch);
report("risks patch replaces section", risksApplied.ok === true);
if (risksApplied.ok) {
  report(
    "risks content updated",
    /供应链中断/.test(risksApplied.html) && !/演员授权链不闭合/.test(risksApplied.html),
  );
  const validation = validateMergedKnowledgeNetworkAfterSlotPatch(risksApplied.html, {
    previousHtml: sampleKb,
    touchesTimeline: false,
  });
  report("risks merged strict validation PASS", validation.ok, validation.error);
}

const timelineApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(sampleKb, timelinePatch);
report("timeline patch replaces section", timelineApplied.ok === true);
if (timelineApplied.ok) {
  const validation = validateMergedKnowledgeNetworkAfterSlotPatch(timelineApplied.html, {
    previousHtml: sampleKb,
    touchesTimeline: true,
  });
  report("timeline merged strict validation PASS", validation.ok, validation.error);
}

const mismatchPatch = { ...risksPatch, slot: "decision-framework" as const };
const mismatchApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(sampleKb, mismatchPatch);
report(
  "slot mismatch in sectionHtml fails",
  mismatchApplied.ok === false,
  mismatchApplied.ok ? "" : mismatchApplied.error,
);

const forbiddenPatch = {
  ...risksPatch,
  sectionHtml: `<!DOCTYPE html><html><body>${newRisksSection}</body></html>`,
};
report(
  "patch with html/body fails validation",
  validateSlotHtmlPatch(forbiddenPatch).ok === false,
);

const scriptPatch = {
  ...risksPatch,
  sectionHtml: `${newRisksSection}<script>alert(1)</script>`,
};
report(
  "patch with script fails validation",
  validateSlotHtmlPatch(scriptPatch).ok === false,
);

const configPatch = {
  ...risksPatch,
  sectionHtml: `<!-- KB-CONFIG\nschema-version: 2.91\n-->${newRisksSection}`,
};
report(
  "patch with KB-CONFIG fails validation",
  validateSlotHtmlPatch(configPatch).ok === false,
);

const missingSectionKb = sampleKb.replace(
  /<section class="block kb-panel" id="risks-mitigation">[\s\S]*?<\/section>/i,
  "",
);
const missingApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(missingSectionKb, risksPatch);
report(
  "missing target section fails",
  missingApplied.ok === false,
  missingApplied.ok ? "" : missingApplied.error,
);

const ledgerRow = "<tr><td>v2.0</td><td>2026-06-20 10:00</td><td>v1.0</td><td>Hermes</td><td>slot patch test</td></tr>";
const ledgerPatch = {
  ...risksPatch,
  appendixUpdates: { versionLedgerRowHtml: ledgerRow },
};
const ledgerApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(sampleKb, ledgerPatch);
report("versionLedgerRowHtml appends", ledgerApplied.ok === true);
if (ledgerApplied.ok) {
  report(
    "ledger row present",
    ledgerApplied.html.includes("slot patch test"),
  );
}

const answer = `已更新关键风险板块。

\`\`\`json
${JSON.stringify(risksPatch, null, 2)}
\`\`\`
`;
const extracted = extractSlotHtmlPatchFromAnswer(answer);
report("extract patch from fenced json", extracted.ok === true);
if (extracted.ok) {
  report("extracted slot", extracted.patch.slot === "risks-mitigation", extracted.patch.slot);
}

report(
  "KB-CONFIG unchanged after risks patch",
  risksApplied.ok &&
    (() => {
      const before = sampleKb.match(/<!--\s*KB-CONFIG[\s\S]*?-->/i)?.[0] ?? "";
      const after = risksApplied.html.match(/<!--\s*KB-CONFIG[\s\S]*?-->/i)?.[0] ?? "";
      return before === after && before.length > 0;
    })(),
);

const knownCitationSection = `<section class="block kb-panel" id="risks-mitigation">
<h2 class="section-title"><span class="section-num">十一</span>关键风险</h2>
<p>引用已有来源 <sup class="cite-ref"><a href="#source-U-1">[U-1]</a></sup></p>
</section>`;
const knownCitationPatch = { ...risksPatch, sectionHtml: knownCitationSection };
const knownCitationApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(
  sampleKb,
  knownCitationPatch,
);
report("known #source-U-1 citation allowed", knownCitationApplied.ok === true);

const unknownCitationSection = `<section class="block kb-panel" id="risks-mitigation">
<h2 class="section-title"><span class="section-num">十一</span>关键风险</h2>
<p>新来源 <sup class="cite-ref"><a href="#source-U-99">[U-99]</a></sup></p>
</section>`;
const unknownCitationPatch = { ...risksPatch, sectionHtml: unknownCitationSection };
const unknownCitationCheck = validateSlotPatchSourceCitations(
  sampleKb,
  unknownCitationPatch,
);
report(
  "unknown #source-U-99 citation fails",
  unknownCitationCheck.ok === false,
  unknownCitationCheck.ok ? "" : unknownCitationCheck.reason,
);

const unknownApplied = applySlotHtmlPatchToKnowledgeNetworkHtml(
  sampleKb,
  unknownCitationPatch,
);
report(
  "apply fails on unknown citation",
  unknownApplied.ok === false,
  unknownApplied.ok ? "" : unknownApplied.error,
);

const sourceIndexPatch = {
  ...risksPatch,
  appendixUpdates: {
    sourceIndexHtml: "<tr><td>bad</td></tr>",
    versionLedgerRowHtml: null,
  },
};
report(
  "sourceIndexHtml in appendixUpdates fails",
  validateSlotHtmlPatch(sourceIndexPatch).ok === false,
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
