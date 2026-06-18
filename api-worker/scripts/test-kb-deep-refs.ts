/**
 * Deep refs routing unit tests
 * 用法：cd api-worker && npx tsx scripts/test-kb-deep-refs.ts
 */
import { resolveKnowledgeNetworkSlotsFromMessage } from "../src/knowledge-network-slot-aliases.ts";
import {
  DEFAULT_KB_DEEP_REFS,
  resolveKnowledgeNetworkDeepRefs,
} from "../src/knowledge-network-deep-refs.ts";

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const allSeven = DEFAULT_KB_DEEP_REFS;

report(
  "initial → 7 deep refs",
  resolveKnowledgeNetworkDeepRefs("initial", []).length === 7,
  String(resolveKnowledgeNetworkDeepRefs("initial", []).length),
);

report(
  "full → 7 deep refs",
  resolveKnowledgeNetworkDeepRefs("full", []).length === 7,
);

report(
  "reorder → 0 deep refs",
  resolveKnowledgeNetworkDeepRefs("reorder", ["risks-mitigation"]).length === 0,
);

const timelineSlots = resolveKnowledgeNetworkSlotsFromMessage("只更新项目时间轴");
const timelineDeep = resolveKnowledgeNetworkDeepRefs("incremental", timelineSlots);
report(
  "incremental 时间轴 → 0 deep refs",
  timelineDeep.length === 0,
  timelineDeep.join(", "),
);

const riskSlots = resolveKnowledgeNetworkSlotsFromMessage("只更新关键风险");
const riskDeep = resolveKnowledgeNetworkDeepRefs("incremental", riskSlots);
report(
  "incremental 风险 → risk-matrix + compliance + returns",
  riskDeep.length === 3 &&
    riskDeep.some((p) => p.includes("risk-matrix")) &&
    riskDeep.some((p) => p.includes("compliance-check")),
  riskDeep.join(", "),
);

const complianceSlots = resolveKnowledgeNetworkSlotsFromMessage("更新监管合规");
const complianceDeep = resolveKnowledgeNetworkDeepRefs("incremental", complianceSlots);
report(
  "incremental 合规 → compliance + dd-claim-audit",
  complianceDeep.length === 2 &&
    complianceDeep.some((p) => p.includes("compliance-check")),
  complianceDeep.join(", "),
);

const returnsSlots = resolveKnowledgeNetworkSlotsFromMessage("只更新投资回报");
const returnsDeep = resolveKnowledgeNetworkDeepRefs("incremental", returnsSlots);
report(
  "incremental 回报 → returns-analysis + dd-claim-audit",
  returnsDeep.length === 2 && returnsDeep.some((p) => p.includes("returns-analysis")),
  returnsDeep.join(", "),
);

report(
  "incremental 无点名 slot → 0 deep refs",
  resolveKnowledgeNetworkDeepRefs("incremental", []).length === 0,
);

report(
  "initial deep refs match DEFAULT order",
  JSON.stringify(resolveKnowledgeNetworkDeepRefs("initial", [])) === JSON.stringify([...allSeven]),
);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
