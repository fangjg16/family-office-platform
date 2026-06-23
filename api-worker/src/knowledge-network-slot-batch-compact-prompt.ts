import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";

const SLOT_SCHEMA_HINTS: Record<CanonicalKbSlot, string> = {
  snapshot: "keyFacts[] · overview · gaps（选有材料的）",
  "target-overview": "assetSummary[] · keyClaims[] · transactionSummary[] · gaps",
  "industry-market":
    "allowed: marketDrivers | valueChain | policyContext | marketSize — 选 1–2；不足 gaps",
  "business-operations":
    "allowed: journeyMap | revenueTree | flywheel | canvas | processFlow | customerBuyer | pricing — 选 1–2 主组件；不足 operationalGaps / gaps",
  "legal-ownership": "entities[] · contractRights[] · unresolvedLegalIssues[]（gap-first）",
  "regulatory-compliance":
    "jurisdictionRows[] 和/或 regulatoryGaps[]（gap-first）；licenseRequirements 可选",
  "resource-network": "parties[] · capabilities[] · resourceGaps[]",
  "comps-benchmark": "compsRows[] · comparableGaps[]",
  "valuation-returns": "scenarios[] · cashflowGaps[] · investmentCashflow[]（勿编造 IRR）",
  "diligence-gaps": "questionGroups[]",
  "risks-mitigation": "riskRows[]（gap-first）· stopConditions[] 可选",
  "timeline-milestones": "occurred[] · inProgress[] · future[] · gaps",
  "decision-framework": "decisionTable[] · nextActions[] · goNoGoConditions[]",
};

const COMPACT_EXAMPLE = `{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "batchIndex": 0,
  "summary": "本批 1 句摘要",
  "sourceProposals": [{ "sourceKey": "prop-new-doc", "type": "用户上传", "title": "新资料名" }],
  "slots": {
    "snapshot": { "stage": "…", "keyFacts": [{ "项目项": "…", "证据/来源": "source-U-1" }] }
  }
}`;

export function buildCompactBatchSlotSchemaBlock(slots: CanonicalKbSlot[]): string {
  return slots.map((s) => `- **${s}**: ${SLOT_SCHEMA_HINTS[s]}`).join("\n");
}

export function buildCompactSlotBatchWorkflow(params: {
  mode: "initial" | "full";
  batchIndex: number;
  slots: CanonicalKbSlot[];
  repairHints?: string;
}): string {
  const slotList = params.slots.join(", ");
  const repair = params.repairHints?.trim()
    ? `\n【Hard repair only】${params.repairHints}\n只修 JSON 结构 / 幻觉 hard codes / 缺 slot payload；勿为 coverage 或分数补假事实。`
    : "";

  return `

【Slot-Batch · Compact（${params.mode} · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length}）】
**本批 slot**：${slotList}
${buildCompactBatchSlotSchemaBlock(params.slots)}

**交付**：2–3 行摘要 + **一个** \`\`\`json 代码块（type=structured-slot-batch）。
- **禁止** config/meta/sources（已在 Worker 预处理 shell）；可用 **sourceProposals** 提议新来源。
- table 用 canonical 中文列名；缺资料写 gap rows。
- **禁止**整页 HTML / 13-slot 大包 / PUT。

**示例 envelope**：
\`\`\`json
${COMPACT_EXAMPLE}
\`\`\`${repair}`;
}
