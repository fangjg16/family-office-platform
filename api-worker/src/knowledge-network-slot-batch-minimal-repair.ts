import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { buildRisksGapFirstRepairHint } from "./knowledge-network-risks-gap-first";
import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";

const SLOT_SCHEMA_SNIPPET: Partial<Record<CanonicalKbSlot, string>> = {
  "industry-market":
    '"marketDrivers":[{"主题":"…","事实/数据":"…","投资含义":"…","来源":"…"}]',
  "business-operations":
    '"operationalGaps":[{"待验证假设":"…","为什么关键":"…","验证方式":"…"}] 或 journeyMap/revenueTree 等 allowed 组件',
  "legal-ownership":
    '"unresolvedLegalIssues":[{"issue":"…","whyItMatters":"…","requiredEvidence":"…","owner":"…","decisionImpact":"…"}]',
  "regulatory-compliance":
    '"regulatoryGaps":[{"jurisdiction":"…","requirement":"…","currentEvidence":"未提供","gap":"待确认","nextAction":"…","riskLevel":"高"}]',
  "resource-network": '"parties":[…],"resourceGaps":[…]',
  "comps-benchmark": '"compsRows":[…],"comparableGaps":[…]',
  "valuation-returns": '"scenarios":[…],"cashflowGaps":[…]',
  "diligence-gaps": '"questionGroups":[{"priority":"P1","questions":[{"question":"…"}]}]',
  "risks-mitigation":
    '"riskRows":[{"level":"中","risk":"待验证：…","cause":"缺…资料","impact":"影响…","mitigation":"补…","evidenceSourceIds":[]}]',
  "timeline-milestones":
    '"occurred":[],"inProgress":[],"future":[],"gaps":[{"text":"…","confidence":"gap"}]',
  "decision-framework":
    '"recommendation":"…","decisionTable":[…],"nextActions":[…]',
};

function slotHints(failedSlots: CanonicalKbSlot[], issueCodes: string[]): string {
  const lines: string[] = [];
  if (
    failedSlots.includes("risks-mitigation") ||
    issueCodes.includes("risk_rows_missing") ||
    issueCodes.includes("fabricated_risk")
  ) {
    lines.push(buildRisksGapFirstRepairHint());
  }
  if (
    failedSlots.includes("business-operations") ||
    issueCodes.includes("unmapped_row_keys") ||
    issueCodes.includes("invalid_component_type")
  ) {
    if (failedSlots.includes("business-operations")) {
      lines.push(
        "business-operations：unmapped 列名 → 改 canonical；无事实勿放空 row，删或写 operationalGaps。",
      );
    }
  }
  if (failedSlots.includes("regulatory-compliance")) {
    lines.push(
      "regulatory-compliance：jurisdictionRows 无法映射 → regulatoryGaps gap-first；禁止 0% 填充行。",
    );
  }
  if (
    failedSlots.includes("legal-ownership") ||
    failedSlots.includes("regulatory-compliance")
  ) {
    lines.push(
      "legal/regulatory：缺口行 gap-first，禁止无证据写「已取得/有效」许可。",
    );
  }
  for (const slot of failedSlots) {
    const snippet = SLOT_SCHEMA_SNIPPET[slot];
    if (snippet) lines.push(`${slot} 最小字段：${snippet}`);
  }
  return lines.join("\n");
}

/** 最短 hard repair：仅错误 + 最小 schema，不重塞完整示例/instructions */
export function buildMinimalSlotBatchRepairPrompt(params: {
  repairMessage: string;
  failedSlots: CanonicalKbSlot[];
  batchIndex: number;
  mode: KnowledgeNetworkUpdateMode;
  issueCodes?: string[];
}): string {
  const batchSlots = [...KN_SLOT_BATCH_PLAN[params.batchIndex]!];
  const focus =
    params.failedSlots.length > 0 ? params.failedSlots : (batchSlots as CanonicalKbSlot[]);
  const hints = slotHints(focus, params.issueCodes ?? []);

  return `【hard repair · 仅一次 · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length}】

Hard 错误：${params.repairMessage.trim()}

修 slot：${focus.join(", ")}
${hints ? `\n${hints}\n` : ""}
交付：仅一个 json 代码块
{"type":"structured-slot-batch","schemaVersion":"2.91","mode":"${params.mode}","batchIndex":${params.batchIndex},"summary":"…","slots":{${batchSlots.map((s) => `"${s}":{…}`).join(",")}}}

禁止重读全量 rules/examples；只修上述 hard 错误；coverage/Factor A 不补假事实。`;
}
