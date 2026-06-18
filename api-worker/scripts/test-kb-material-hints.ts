/**
 * Material hints unit tests
 * 用法：cd api-worker && npx tsx scripts/test-kb-material-hints.ts
 */
import {
  buildMaterialHintsFromDocuments,
  formatMaterialHintsBlock,
  MATERIAL_HINTS_JSON_MAX_CHARS,
  shouldInjectMaterialHints,
  truncateMaterialHintsPayload,
  type MaterialHintDocument,
} from "../src/knowledge-network-material-hints.ts";
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

// 1. financial model → valuation-returns full
const t1 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "更新投资回报",
  touchedSlots: ["valuation-returns"],
  documents: [financialModel],
  chunks,
  maxFilesPerSlot: 3,
});
report(
  "financial model → valuation-returns readMode=full",
  Boolean(
    t1?.slots["valuation-returns"]?.[0]?.readMode === "full" &&
      /financial/i.test(t1.slots["valuation-returns"]![0]!.filename),
  ),
);

// 2. term sheet → legal + risks (+ valuation)
const t2 = buildMaterialHintsFromDocuments({
  mode: "full",
  userMessage: "生成知识网络",
  touchedSlots: [],
  documents: [termSheet],
  chunks: [
    {
      id: "c3",
      document_id: "f-ts",
      chunk_index: 0,
      text: "shareholder ownership cap table risk breach",
      filename: "Series A Term Sheet.pdf",
      scope: "package",
    },
  ],
  maxFilesPerSlot: 3,
});
report(
  "term sheet → legal-ownership",
  Boolean(t2?.slots["legal-ownership"]?.some((e) => /term sheet/i.test(e.filename))),
);
report(
  "term sheet → risks-mitigation",
  Boolean(t2?.slots["risks-mitigation"]?.some((e) => /term sheet/i.test(e.filename))),
);
report(
  "term sheet → valuation-returns (optional/full)",
  Boolean(t2?.slots["valuation-returns"]?.length),
);

// 3. license → regulatory-compliance
const t3 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "更新监管合规",
  touchedSlots: ["regulatory-compliance"],
  documents: [licenseDoc],
  chunks: [],
  maxFilesPerSlot: 3,
});
report(
  "license/permit → regulatory-compliance",
  Boolean(t3?.slots["regulatory-compliance"]?.[0]?.evidenceType === "regulatory-license"),
);

// 4. market report → industry + comps excerpt
const t4 = buildMaterialHintsFromDocuments({
  mode: "full",
  userMessage: "行业市场对标",
  touchedSlots: [],
  documents: [marketReport],
  chunks: [],
  maxFilesPerSlot: 3,
});
const ind = t4?.slots["industry-market"]?.[0];
const comps = t4?.slots["comps-benchmark"]?.[0];
report(
  "market report → industry-market excerpt",
  ind?.readMode === "excerpt" && /market/i.test(ind.filename),
);
report(
  "market report → comps-benchmark excerpt",
  comps?.readMode === "excerpt",
);

// 5. timeline file → timeline-milestones
const t5 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "只更新项目时间轴",
  touchedSlots: ["timeline-milestones"],
  documents: [timelineDoc],
  chunks: [],
  maxFilesPerSlot: 3,
});
report(
  "timeline doc → timeline-milestones",
  Boolean(t5?.slots["timeline-milestones"]?.[0]?.evidenceType === "timeline-doc"),
);

// 6. session priority > package
const t6 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "只更新关键风险",
  touchedSlots: ["risks-mitigation"],
  documents: [
    doc({ id: "pkg", filename: "generic-risk-memo.pdf", sampleText: "risk litigation" }),
    sessionRisk,
  ],
  chunks: [
    {
      id: "cs",
      document_id: "f-sess",
      chunk_index: 0,
      text: "risk dispute red flag",
      filename: "meeting-notes-risk-update.pdf",
      scope: "session",
    },
  ],
  maxFilesPerSlot: 3,
});
const riskEntries = t6?.slots["risks-mitigation"] ?? [];
report(
  "session attachment outranks package on risks",
  riskEntries.length >= 1 && riskEntries[0]?.scope === "session",
  riskEntries.map((e) => `${e.scope}:${e.priority}`).join(", "),
);

// 7. incremental risk only outputs risks slot
const t7 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "只更新关键风险",
  touchedSlots: ["risks-mitigation"],
  documents: [financialModel, termSheet, marketReport],
  chunks,
  maxFilesPerSlot: 3,
});
report(
  "incremental risk only risks-mitigation slot",
  Boolean(t7 && Object.keys(t7.slots ?? {}).every((s) => s === "risks-mitigation")),
  Object.keys(t7?.slots ?? {}).join(", "),
);

// 7b. incremental without touched → global compact, not 13 slots
const t7b = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "更新知识网络",
  touchedSlots: [],
  documents: [financialModel, termSheet, marketReport, licenseDoc, timelineDoc, sessionRisk],
  chunks,
});
report(
  "incremental no touched uses globalFiles not 13 slots",
  Boolean(
    t7b &&
      (t7b.globalFiles?.length ?? 0) >= 1 &&
      (t7b.globalFiles?.length ?? 0) <= 5 &&
      Object.keys(t7b.slots ?? {}).length === 0,
  ),
  `global=${t7b?.globalFiles?.length ?? 0} slots=${Object.keys(t7b?.slots ?? {}).length}`,
);

const manyGlobalDocs: MaterialHintDocument[] = Array.from({ length: 12 }, (_, i) =>
  doc({
    id: `g-${i}`,
    filename: `risk-litigation-memo-${i}.pdf`,
    sampleText: "risk litigation dispute breach termination",
  }),
);
const t7c = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "泛泛更新知识网络",
  touchedSlots: [],
  documents: manyGlobalDocs,
  chunks: [],
});
report(
  "incremental no touched caps globalFiles at 5",
  (t7c?.globalFiles?.length ?? 0) === 5,
  String(t7c?.globalFiles?.length),
);

// 8. full mode caps maxFilesPerSlot
const manyDocs: MaterialHintDocument[] = Array.from({ length: 6 }, (_, i) =>
  doc({
    id: `risk-${i}`,
    filename: `risk-memo-${i}-litigation.pdf`,
    sampleText: "risk litigation dispute breach",
  }),
);
const t8 = buildMaterialHintsFromDocuments({
  mode: "full",
  userMessage: "全量重做",
  touchedSlots: [],
  documents: manyDocs,
  chunks: [],
  maxFilesPerSlot: 3,
});
report(
  "full risks slot max 3 files",
  (t8?.slots?.["risks-mitigation"]?.length ?? 0) <= 3,
  String(t8?.slots?.["risks-mitigation"]?.length),
);

// 9. reorder → no inject
report("reorder shouldInject=false", !shouldInjectMaterialHints("reorder"));
const t9 = buildMaterialHintsFromDocuments({
  mode: "reorder",
  userMessage: "重排章节",
  touchedSlots: [],
  documents: [termSheet],
  chunks: [],
});
report("reorder payload null", t9 === null);

// 10. no materials → lightweight copy
const missing = formatMaterialHintsBlock(null, { missingMaterials: true });
report(
  "no materials lightweight message",
  missing.includes("无可用项目资料 hints") && missing.includes("manifest"),
);

// 11. JSON char budget truncates by priority
const slotIds = [
  "snapshot",
  "target-overview",
  "resource-network",
  "industry-market",
  "comps-benchmark",
  "business-operations",
  "legal-ownership",
  "regulatory-compliance",
  "valuation-returns",
  "diligence-gaps",
  "risks-mitigation",
  "timeline-milestones",
  "decision-framework",
] as const;
const bulkyPayload = {
  mode: "full" as const,
  touchedSlots: [] as const,
  slots: Object.fromEntries(
    slotIds.map((slot, si) => [
      slot,
      Array.from({ length: 3 }, (_, fi) => ({
        fileId: `f-${si}-${fi}`,
        filename: `very-long-filename-for-volume-test-${slot}-${fi}-with-extra-padding.pdf`,
        scope: "package" as const,
        readMode: "excerpt" as const,
        evidenceType: "test",
        reason: "filename match; chunk hit; session attachment",
        priority: 100 - si * 3 - fi,
        parsed: true,
      })),
    ]),
  ),
};
const truncated = truncateMaterialHintsPayload(bulkyPayload, 1200);
const truncatedEntryCount = Object.values(truncated.slots ?? {}).flat().length;
const truncatedJsonLen = JSON.stringify(truncated.slots ?? {}).length;
report(
  "truncate by priority under char budget",
  truncatedJsonLen <= 1200 && truncatedEntryCount < 39,
  `entries=${truncatedEntryCount} jsonLen=${truncatedJsonLen}`,
);

// 12. reason never contains chunk body text
const t12 = buildMaterialHintsFromDocuments({
  mode: "incremental",
  userMessage: "更新风险",
  touchedSlots: ["risks-mitigation"],
  documents: [
    doc({
      id: "chunk-body",
      filename: "neutral.pdf",
      sampleText: "THIS_IS_SECRET_CHUNK_BODY_TEXT_NOT_FOR_PROMPT",
    }),
  ],
  chunks: [
    {
      id: "cx",
      document_id: "chunk-body",
      chunk_index: 0,
      text: "THIS_IS_SECRET_CHUNK_BODY_TEXT_NOT_FOR_PROMPT risk litigation",
      filename: "neutral.pdf",
      scope: "package",
    },
  ],
});
const t12Block = formatMaterialHintsBlock(t12);
report(
  "reason excludes chunk body text",
  !t12Block.includes("THIS_IS_SECRET_CHUNK_BODY_TEXT_NOT_FOR_PROMPT"),
);
const t8JsonLen = JSON.stringify({
  mode: t8!.mode,
  touchedSlots: t8!.touchedSlots,
  slots: t8!.slots,
}).length;
report(
  "full payload json within default budget",
  t8JsonLen <= MATERIAL_HINTS_JSON_MAX_CHARS,
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
