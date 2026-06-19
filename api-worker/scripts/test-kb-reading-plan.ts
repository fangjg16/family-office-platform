/**
 * Reading Plan unit tests
 * 用法：cd api-worker && npx tsx scripts/test-kb-reading-plan.ts
 */
import { CANONICAL_KB_SLOTS } from "../src/knowledge-network-html-validation.ts";
import {
  buildMaterialHintsFromDocuments,
  type MaterialHintDocument,
} from "../src/knowledge-network-material-hints.ts";
import {
  buildReadingPlanFromDocuments,
  buildReadingPlanFromHints,
  formatReadingPlanBlock,
  READING_PLAN_JSON_MAX_CHARS,
  shouldInjectReadingPlan,
  truncateReadingPlanPayload,
  type ReadingPlanPayload,
} from "../src/knowledge-network-reading-plan.ts";
import type { ChunkRow } from "../src/search.ts";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function doc(
  partial: Partial<MaterialHintDocument> & Pick<MaterialHintDocument, "id" | "filename">,
): MaterialHintDocument {
  return {
    scope: "package",
    mime: "application/pdf",
    parsed: true,
    chunkCount: 3,
    sampleText: "",
    ...partial,
  };
}

const chunks: ChunkRow[] = [
  {
    id: "c1",
    document_id: "f-model",
    chunk_index: 0,
    text: "IRR sensitivity and cash flow waterfall assumptions",
    filename: "Financial Model.xlsx",
    scope: "package",
  },
  {
    id: "c2",
    document_id: "f-risk",
    chunk_index: 0,
    text: "litigation risk and termination penalty clauses",
    filename: "Term Sheet.pdf",
    scope: "package",
  },
];

const financialModel = doc({
  id: "f-model",
  filename: "Project Financial Model v3.xlsx",
  mime: "application/vnd.ms-excel",
  sampleText: "IRR MOIC valuation waterfall",
});

const termSheet = doc({
  id: "f-ts",
  filename: "Series A Term Sheet.pdf",
  sampleText: "investment agreement breach termination",
});

const licenseDoc = doc({
  id: "f-lic",
  filename: "Drug License Permit Approval.pdf",
  sampleText: "regulatory filing and compliance permit",
});

const marketReport = doc({
  id: "f-mkt",
  filename: "Global Peptide Market Research Report 2025.pdf",
  sampleText: "market size industry benchmark comparable transactions",
});

const timelineDoc = doc({
  id: "f-tl",
  filename: "Project Timeline Milestones.pdf",
  sampleText: "closing signing approval date meeting schedule",
});

const sessionRisk = doc({
  id: "f-sess",
  filename: "meeting-notes-risk-update.pdf",
  scope: "session",
  sampleText: "red flag dispute risk mitigation",
});

// 1. full mode → 13-slot compact plan, JSON budget
const fullPlan = buildReadingPlanFromDocuments({
  mode: "full",
  userMessage: "全量重做知识网络",
  touchedSlots: [],
  documents: [financialModel, termSheet, licenseDoc, marketReport, timelineDoc],
  chunks,
  maxFilesPerSlot: 3,
});
const fullSlotKeys = Object.keys(fullPlan?.slots ?? {});
const fullJsonLen = JSON.stringify(fullPlan ?? {}).length;
report(
  "full mode has 13 slot plans",
  fullSlotKeys.length === CANONICAL_KB_SLOTS.length,
  String(fullSlotKeys.length),
);
report(
  "full mode JSON under budget",
  fullJsonLen <= READING_PLAN_JSON_MAX_CHARS + 200,
  String(fullJsonLen),
);
report(
  "full block mentions route not conclusion",
  formatReadingPlanBlock(fullPlan).includes("阅读路线") &&
    formatReadingPlanBlock(fullPlan).includes("不得支撑强结论"),
);

// 2. single-slot incremental risks → risks + cross slots only
const risksPlan = buildReadingPlanFromDocuments({
  mode: "incremental",
  userMessage: "更新风险章节",
  touchedSlots: ["risks-mitigation"],
  documents: [termSheet, licenseDoc, financialModel, sessionRisk],
  chunks,
  maxFilesPerSlot: 5,
});
const risksSlotKeys = Object.keys(risksPlan?.slots ?? {});
report(
  "incremental risks includes primary slot",
  risksSlotKeys.includes("risks-mitigation"),
);
report(
  "incremental risks does not expand 13 slots",
  risksSlotKeys.length < 13 && risksSlotKeys.length >= 1,
  String(risksSlotKeys.length),
);
report(
  "incremental risks may include cross-slot files",
  risksSlotKeys.some((s) =>
    ["legal-ownership", "regulatory-compliance", "valuation-returns"].includes(s),
  ) || (risksPlan?.slots?.["risks-mitigation"]?.mustRead.length ?? 0) > 0,
);

// 3. single-slot timeline → no industry news routing
const timelinePlan = buildReadingPlanFromDocuments({
  mode: "incremental",
  userMessage: "更新时间轴",
  touchedSlots: ["timeline-milestones"],
  documents: [marketReport, timelineDoc],
  chunks: [],
  maxFilesPerSlot: 5,
});
const tlMust = timelinePlan?.slots?.["timeline-milestones"]?.mustRead ?? [];
const tlShould = timelinePlan?.slots?.["timeline-milestones"]?.shouldRead ?? [];
const tlFiles = [...tlMust, ...tlShould].map((f) => f.filename);
report(
  "timeline routes project timeline doc",
  tlFiles.some((f) => /timeline|milestone/i.test(f)),
  tlFiles.join(", "),
);
report(
  "timeline excludes industry market report",
  !tlFiles.some((f) => /market\s*research|industry/i.test(f)),
  tlFiles.join(", "),
);
report(
  "timeline stopRule forbids industry news",
  (timelinePlan?.slots?.["timeline-milestones"]?.stopRule ?? "").includes("行业新闻"),
);

// 4. incremental no touched → global compact only
const globalPlan = buildReadingPlanFromDocuments({
  mode: "incremental",
  userMessage: "泛泛更新",
  touchedSlots: [],
  documents: [termSheet, financialModel, licenseDoc, timelineDoc, marketReport],
  chunks,
});
report(
  "incremental no touched has globalReadOrder",
  (globalPlan?.globalReadOrder?.length ?? 0) > 0,
  String(globalPlan?.globalReadOrder?.length),
);
report(
  "incremental no touched has no slots key",
  !globalPlan?.slots || Object.keys(globalPlan.slots).length === 0,
);

// 5. reorder → no inject
report("reorder shouldInject=false", !shouldInjectReadingPlan("reorder"));
const reorderPlan = buildReadingPlanFromDocuments({
  mode: "reorder",
  userMessage: "重排章节",
  touchedSlots: [],
  documents: [termSheet],
  chunks: [],
});
report("reorder plan null", reorderPlan === null);

// 6. no materials → lightweight copy
const missing = formatReadingPlanBlock(null, { missingMaterials: true });
report(
  "no materials lightweight message",
  missing.includes("无可用项目资料 reading plan") && missing.includes("gap"),
);

// 7. regulatory-compliance objective / stopRule
const regPlan = buildReadingPlanFromDocuments({
  mode: "incremental",
  userMessage: "监管合规",
  touchedSlots: ["regulatory-compliance"],
  documents: [licenseDoc],
  chunks: [],
});
const regSlot = regPlan?.slots?.["regulatory-compliance"];
report(
  "regulatory objective mentions permit",
  (regSlot?.objective ?? "").includes("监管"),
);
report(
  "regulatory stopRule forbids industry fill",
  (regSlot?.stopRule ?? "").includes("gap"),
);

// 8. hints → plan roundtrip
const hints = buildMaterialHintsFromDocuments({
  mode: "full",
  userMessage: "全量",
  touchedSlots: [],
  documents: [financialModel, termSheet],
  chunks,
});
const fromHints = buildReadingPlanFromHints(hints);
report("buildReadingPlanFromHints works", fromHints?.mode === "full");

// 9. truncate under char budget
const bulkyPlan: ReadingPlanPayload = {
  mode: "full",
  touchedSlots: [],
  globalReadOrder: Array.from({ length: 8 }, (_, i) => ({
    fileId: `g-${i}`,
    filename: `long-global-file-name-padding-${i}.pdf`,
    readMode: "full" as const,
    reason: "priority test",
    suggestedSlots: ["risks-mitigation"] as const,
  })),
  slots: Object.fromEntries(
    CANONICAL_KB_SLOTS.map((slot, si) => [
      slot,
      {
        objective: SLOT_OBJECTIVE_PLACEHOLDER(slot),
        mustRead: Array.from({ length: 2 }, (_, fi) => ({
          fileId: `f-${si}-${fi}`,
          filename: `slot-${slot}-file-${fi}-extra-long-name.pdf`,
          readMode: "full" as const,
          reason: "test",
        })),
        shouldRead: [
          {
            fileId: `s-${si}`,
            filename: `should-${slot}.pdf`,
            readMode: "excerpt" as const,
            reason: "test",
          },
        ],
        stopRule: "test stop",
      },
    ]),
  ),
};
function SLOT_OBJECTIVE_PLACEHOLDER(slot: string) {
  return `objective for ${slot} with padding text`;
}
const truncated = truncateReadingPlanPayload(bulkyPlan, hints, 2500);
const truncatedLen = JSON.stringify(truncated).length;
report(
  "truncate under char budget",
  truncatedLen <= 2500,
  String(truncatedLen),
);

// 10. plan file refs have no chunk text
const sampleBlock = formatReadingPlanBlock(fullPlan);
report(
  "plan has no chunk body",
  !sampleBlock.includes("IRR sensitivity") && !sampleBlock.includes("chunk_index"),
);

console.log(`\n${failed === 0 ? "All reading-plan tests passed." : `${failed} test(s) failed.`}`);
process.exit(failed > 0 ? 1 : 0);
