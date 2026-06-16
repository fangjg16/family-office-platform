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

function check(
  mode: "initial" | "full" | "incremental" | "reorder",
  msg = "生成知识网络",
) {
  const r = buildHermesKnowledgeNetworkRequiredReads({
    mode,
    touchesTimeline: /timeline|时间轴/.test(msg),
    touchesMaturityScorecard:
      /header|评分|maturity|成熟度|项目总览|scorecard|factor\s*[ab]|综合成熟|stat[\s-]*row|覆盖度|来源多样性|两因素/i.test(
        msg,
      ),
    includeComponents: isVisualDebugKnRequest(msg),
    includeStyleGuide: isVisualDebugKnRequest(msg),
  });
  const files = r.split("\n").filter((l) => /^\d+\./.test(l)).map((l) => l.trim());
  const ok = files.every((f) => !banned.some((b) => f.includes(b)));
  const maturityScoring = files.some((f) => f.includes("maturity-scoring.md"));
  console.log(
    JSON.stringify({
      mode,
      readCount: files.length,
      timelineRules: files.some((f) => f.includes("timeline-rules.md")),
      maturityScoring,
      bannedAbsent: ok,
      files,
    }),
  );
}

check("initial");
check("full");
check("incremental");
check("incremental", "只更新项目时间轴");
check("incremental", "重算 header 成熟度评分");
check("reorder");
