/**
 * Timeline eligibility gate — generic fixture tests (not project-specific).
 * 用法：cd api-worker && npx tsx scripts/validate-timeline-eligibility-fixtures.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectSuspiciousIndustryTimeline,
  validateKnowledgeNetworkHtml,
} from "../src/knowledge-network-html-validation.ts";
import { buildHermesKnowledgeNetworkRequiredReads } from "../src/hermes-knowledge-network.ts";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(
  here,
  "../../hermes-railway/skills/knowledge-base-generation/examples",
);

let failed = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function wrapTimelineSection(inner: string): string {
  return `<section class="block kb-panel" id="timeline">${inner}</section>`;
}

// Fixture 1: project-eligible events (generic deal workflow)
const fixtureProjectEvents = wrapTimelineSection(`
<h3>8.1 已发生关键事件</h3>
<div class="timeline project-timeline">
  <div class="tl-item"><span class="tl-date">2026-03-10</span><span class="tl-text"><strong>项目方首次正式介绍标的与交易结构</strong></span></div>
  <div class="tl-item"><span class="tl-date">2026-04-02</span><span class="tl-text"><strong>卖方签署保密协议并开放数据室</strong></span></div>
</div>
<h3>8.2 正在推进</h3>
<div class="timeline project-timeline"><div class="tl-item pending"><span class="tl-text"><strong>补充 KYC 与资产权属文件</strong> — 交易对手控制</span></div></div>
<h3>8.3 未来关键节点</h3>
<table><thead><tr><th>节点</th><th>预计时间</th></tr></thead><tbody><tr><td>监管审批窗口关闭前提交申报材料</td><td>2026-Q3</td></tr></tbody></table>
`);

// Fixture 2: stub — no eligible project events
const fixtureStubOnly = wrapTimelineSection(`
<h3>8.1 已发生关键事件</h3>
<div class="callout missing"><div class="callout-title">暂无已核实的项目级时间轴事件</div>
<p>待项目方/交易对手提供会议记录、签约节点或审批状态。</p></div>
<h3>8.2 正在推进</h3>
<p class="section-lead">暂无推进中事项。</p>
<h3>8.3 未来关键节点</h3>
<table><thead><tr><th>节点</th><th>预计时间</th></tr></thead><tbody><tr><td>待定 — 待项目资料确认关键节点</td><td>待定</td></tr></tbody></table>
`);

// Fixture 3: industry misuse — dated market/industry news (should warn)
const fixtureIndustryMisuse = wrapTimelineSection(`
<h3>8.1 已发生关键事件</h3>
<div class="timeline project-timeline">
  <div class="tl-item"><span class="tl-date">2026-01</span><span class="tl-text"><strong>行业市场规模突破万亿，技术趋势推动渗透率提升</strong></span></div>
  <div class="tl-item"><span class="tl-date">2026-03</span><span class="tl-text"><strong>头部平台发布新产品，算力成本持续下降，赛道格局洗牌</strong></span></div>
</div>
<h3>8.2 正在推进</h3>
<div class="timeline project-timeline"><div class="tl-item pending"><span class="tl-text"><strong>宏观背景政策酝酿中</strong></span></div></div>
<h3>8.3 未来关键节点</h3>
<table><thead><tr><th>节点</th></tr></thead><tbody><tr><td>预计行业爆发拐点</td></tr></tbody></table>
`);

console.log("=== Timeline eligibility fixtures ===\n");

report(
  "fixture 1 project events — no industry warning",
  detectSuspiciousIndustryTimeline(fixtureProjectEvents) === undefined,
  detectSuspiciousIndustryTimeline(fixtureProjectEvents),
);

report(
  "fixture 2 stub only — no industry warning",
  detectSuspiciousIndustryTimeline(fixtureStubOnly) === undefined,
  detectSuspiciousIndustryTimeline(fixtureStubOnly),
);

const misuseWarn = detectSuspiciousIndustryTimeline(fixtureIndustryMisuse);
report(
  "fixture 3 industry misuse — should warn",
  typeof misuseWarn === "string" && misuseWarn.includes("eligibility"),
  misuseWarn ?? "no warning",
);

const sample = readFileSync(join(examplesDir, "sample-output.html"), "utf8");
report(
  "sample-output.html — no false positive industry warning",
  detectSuspiciousIndustryTimeline(sample.replace(/<!--[\s\S]*?-->/g, "")) === undefined,
  detectSuspiciousIndustryTimeline(sample.replace(/<!--[\s\S]*?-->/g, "")),
);

const sampleStrict = validateKnowledgeNetworkHtml(sample, { strict: true, mode: "full" });
report(
  "sample-output strict full — no industry misuse warning",
  sampleStrict.ok && !sampleStrict.warning?.includes("疑似填入行业"),
  sampleStrict.warning,
);

const fullReads = buildHermesKnowledgeNetworkRequiredReads({
  mode: "full",
  touchesTimeline: false,
});
report(
  "full KB mode always includes timeline-rules.md",
  fullReads.includes("references/timeline-rules.md"),
);

const reorderReads = buildHermesKnowledgeNetworkRequiredReads({ mode: "reorder" });
report(
  "reorder mode excludes timeline-rules.md",
  !reorderReads.includes("references/timeline-rules.md"),
);

console.log("");
if (failed === 0) {
  console.log("All timeline eligibility checks passed.");
  process.exit(0);
}
console.error(`${failed} check(s) failed.`);
process.exit(1);
