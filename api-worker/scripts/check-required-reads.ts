import {
  buildHermesKnowledgeNetworkRequiredReads,
  isVisualDebugKnRequest,
} from "../src/hermes-knowledge-network.ts";

const banned = [
  "components.html",
  "visual-style-guide.md",
  "examples-kb-data.json",
  "scripts/",
];

function check(mode: "initial" | "full" | "incremental" | "reorder", msg = "生成知识网络") {
  const r = buildHermesKnowledgeNetworkRequiredReads({
    mode,
    touchesTimeline: /timeline|时间轴/.test(msg),
    includeComponents: isVisualDebugKnRequest(msg),
    includeStyleGuide: isVisualDebugKnRequest(msg),
  });
  const files = r.split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.trim());
  const ok = files.every((f) => !banned.some((b) => f.includes(b)));
  console.log(
    JSON.stringify({
      mode,
      readCount: files.length,
      timelineRules: r.includes("timeline-rules.md"),
      bannedAbsent: ok,
      files,
    }),
  );
}

check("initial");
check("full");
check("incremental");
check("reorder");
