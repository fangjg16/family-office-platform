import {
  buildHermesKnowledgeNetworkFileProtocol,
  buildHermesKnowledgeNetworkRequiredReads,
  buildHermesKnowledgeNetworkSlotPatchWorkflow,
  isVisualDebugKnRequest,
} from "../src/hermes-knowledge-network.ts";
import { resolveKnowledgeNetworkSlotsFromMessage } from "../src/knowledge-network-slot-aliases.ts";
import {
  DEFAULT_KB_DEEP_REFS,
  resolveKnowledgeNetworkDeepRefs,
} from "../src/knowledge-network-deep-refs.ts";
import { shouldUseSlotHtmlPatchMode } from "../src/knowledge-network-slot-patch.ts";

const banned = [
  "components.html",
  "visual-style-guide.md",
  "examples-kb-data.json",
  "scripts/",
];

function deepRefFiles(files: string[]): string[] {
  return files.filter((f) => f.includes("references/deep/"));
}

function check(
  mode: "initial" | "full" | "incremental" | "reorder",
  msg = "生成知识网络",
) {
  const touchedSlots = resolveKnowledgeNetworkSlotsFromMessage(msg);
  const slotPatchMode = shouldUseSlotHtmlPatchMode(mode, touchedSlots);
  const r = buildHermesKnowledgeNetworkRequiredReads({
    mode,
    touchedSlots,
    slotPatchMode,
    touchesTimeline: /timeline|时间轴/.test(msg),
    touchesMaturityScorecard:
      /header|评分|maturity|成熟度|项目总览|scorecard|factor\s*[ab]|综合成熟|stat[\s-]*row|覆盖度|来源多样性|两因素/i.test(
        msg,
      ),
    includeComponents: isVisualDebugKnRequest(msg),
    includeStyleGuide: isVisualDebugKnRequest(msg),
  });
  const files = r.split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.trim());
  const deepRefs = deepRefFiles(files);
  const expectedDeep = resolveKnowledgeNetworkDeepRefs(mode, touchedSlots);
  const ok = files.every((f) => !banned.some((b) => f.includes(b)));
  const deepOk =
    deepRefs.length === expectedDeep.length &&
    expectedDeep.every((d) => deepRefs.some((f) => f.includes(d)));

  console.log(
    JSON.stringify({
      mode,
      msg: msg.length > 40 ? `${msg.slice(0, 40)}…` : msg,
      readCount: files.length,
      deepRefCount: deepRefs.length,
      deepRefsOk: deepOk,
      touchedSlots,
      slotPatchMode,
      timelineRules: files.some((f) => f.includes("timeline-rules.md")),
      maturityScoring: files.some((f) => f.includes("maturity-scoring.md")),
      bannedAbsent: ok,
      deepRefs,
    }),
  );

  if (!ok || !deepOk) process.exitCode = 1;
}

console.log("=== required reads · deep refs phase 2 ===\n");
check("initial");
check("full");
check("incremental");
check("incremental", "只更新项目时间轴");
check("incremental", "只更新关键风险");
check("incremental", "更新监管合规");
check("incremental", "重算 header 成熟度评分");
check("reorder");

console.log(`\nDEFAULT_KB_DEEP_REFS (${DEFAULT_KB_DEEP_REFS.length}):`, DEFAULT_KB_DEEP_REFS.join(", "));

console.log("\n=== slot patch mode (incremental · single slot) ===\n");
const riskMsg = "只更新关键风险";
const riskSlots = resolveKnowledgeNetworkSlotsFromMessage(riskMsg);
const riskPatchMode = shouldUseSlotHtmlPatchMode("incremental", riskSlots);
const riskWorkflow = buildHermesKnowledgeNetworkSlotPatchWorkflow(
  "https://jfo-api.example",
  "proj-test",
  "测试项目",
  riskSlots[0]!,
);
const riskFileProtocol = buildHermesKnowledgeNetworkFileProtocol(
  "https://jfo-api.example",
  "proj-test",
  "user-test",
  "job-test",
  "测试项目",
  "incremental",
);
const riskReads = buildHermesKnowledgeNetworkRequiredReads({
  mode: "incremental",
  touchedSlots: riskSlots,
  slotPatchMode: riskPatchMode,
});
console.log(
  JSON.stringify({
    riskPatchMode,
    riskSlots,
    workflowHasSlotPatch: riskWorkflow.includes("slot-html-patch"),
    workflowNoPutStep: !riskWorkflow.includes("**C. PUT"),
    workflowNoPutScriptInvocation: !/jfo_kb_put\.sh\s*\\/i.test(riskWorkflow),
    workflowForbidsWholePageProtocol: !riskWorkflow.includes("一次回复双交付"),
    fileProtocolHasPutScript: riskFileProtocol.includes("jfo_kb_put.sh"),
    readsMentionCitationRule: riskReads.includes("禁止") && riskReads.includes("Appendix A"),
  }),
);
if (
  !riskPatchMode ||
  !riskWorkflow.includes("slot-html-patch") ||
  riskWorkflow.includes("**C. PUT") ||
  /jfo_kb_put\.sh\s*\\/i.test(riskWorkflow) ||
  riskWorkflow.includes("一次回复双交付") ||
  !riskReads.includes("Appendix A")
) {
  process.exitCode = 1;
}

const timelineMsg = "只更新项目时间轴";
const timelineSlots = resolveKnowledgeNetworkSlotsFromMessage(timelineMsg);
const timelinePatchMode = shouldUseSlotHtmlPatchMode("incremental", timelineSlots);
const timelineReads = buildHermesKnowledgeNetworkRequiredReads({
  mode: "incremental",
  touchedSlots: timelineSlots,
  slotPatchMode: timelinePatchMode,
  touchesTimeline: true,
});
const timelineDeep = resolveKnowledgeNetworkDeepRefs("incremental", timelineSlots);
console.log(
  JSON.stringify({
    timelinePatchMode,
    timelineDeepCount: timelineDeep.length,
    timelineRules: timelineReads.includes("timeline-rules.md"),
    timelineReadsSlotPatch: timelineReads.includes("slot-html-patch"),
  }),
);
if (
  timelineDeep.length !== 0 ||
  !timelineReads.includes("timeline-rules.md") ||
  !timelineReads.includes("slot-html-patch")
) {
  process.exitCode = 1;
}

const reorderReads = buildHermesKnowledgeNetworkRequiredReads({ mode: "reorder" });
if (!reorderReads.includes("重排模式") || reorderReads.includes("slot-html-patch")) {
  process.exitCode = 1;
}
console.log("reorder unchanged:", reorderReads.includes("重排模式"));
