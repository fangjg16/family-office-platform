/**
 * Structured Slot Patch unit tests（13 canonical slots）
 * 用法：cd api-worker && npx tsx scripts/test-structured-slot-patch.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_KB_SLOTS } from "../src/knowledge-network-html-validation.ts";
import type { CanonicalKbSlot } from "../src/knowledge-network-slot-aliases.ts";
import {
  applyStructuredSlotPatchToKnowledgeNetworkHtml,
  extractStructuredSlotPatchFromAnswer,
  rejectHtmlOrScriptInPayload,
  validateEvidenceSourceIdsAgainstAppendixA,
  validateMergedKnowledgeNetworkAfterStructuredPatch,
  validateStructuredSlotPatch,
} from "../src/knowledge-network-structured-patch.ts";
import type { StructuredSlotPatchAny } from "../src/knowledge-network-structured-patch-types.ts";

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

function extractBlock(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[0] ?? "";
}

function sectionRegex(slot: string): RegExp {
  return new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>[\\s\\S]*?<\\/section>`,
    "i",
  );
}

function makePatch(
  slot: CanonicalKbSlot,
  payload: StructuredSlotPatchAny["payload"],
  extra?: Partial<StructuredSlotPatchAny>,
): StructuredSlotPatchAny {
  return {
    type: "structured-slot-patch",
    schemaVersion: "2.91",
    mode: "incremental",
    slot,
    operation: "replace-slot-data",
    payload,
    summary: `测试更新 ${slot}`,
    ...extra,
  } as StructuredSlotPatchAny;
}

const MINIMAL_PAYLOADS: Record<CanonicalKbSlot, StructuredSlotPatchAny["payload"]> = {
  snapshot: {
    stage: "试点验证",
    status: "资料请求中",
    keyFacts: [
      { 项目项: "测试项", 内容: "结构化 patch 渲染", 证据: "内部测试" },
    ],
    gaps: [{ text: "样例缺口", confidence: "gap" }],
  },
  "target-overview": {
    assetSummary: [
      {
        "资产/权利/能力": "测试资产",
        "定义与范围": "单元测试",
        "可投资性": "待验证",
        "关键证据/缺口": "无",
      },
    ],
  },
  "industry-market": {
    marketDrivers: [
      {
        主题: "需求",
        "事实/数据": "测试数据",
        投资含义: "测试含义",
        来源: "公开资料",
      },
    ],
  },
  "business-operations": {
    journeyMap: {
      stages: ["获客", "交付", "复购"],
      lanes: [{ label: "主路径", nodes: ["线索", "签约", "续约"] }],
    },
    customerBuyer: [
      {
        "客户/受众/付费方": "企业客户",
        需求: "降本",
        "获客/渠道": "直销",
        验证状态: "测试中",
      },
    ],
  },
  "legal-ownership": {
    entities: [
      {
        "主体/权利": "项目公司",
        "角色/归属": "SPV",
        "限制/负担": "无",
        "证据/缺口": "待补",
      },
    ],
    relationshipEdges: [
      { relation: "控股", from: "母公司", to: "项目公司", status: "待定" },
    ],
  },
  "regulatory-compliance": {
    jurisdictionRows: [
      {
        "监管/规则": "数据合规",
        适用原因: "处理用户数据",
        "状态/许可": "评估中",
        "红线/下一步": "法务确认",
      },
    ],
  },
  "resource-network": {
    parties: [
      {
        "主体/资源": "技术供应商",
        "关系与作用": "交付能力",
        "强度/可验证性": "中",
        "依赖与风险": "单点依赖",
      },
    ],
  },
  "comps-benchmark": {
    compsRows: [
      {
        可比对象: "同业 A",
        可比逻辑: "商业模式相近",
        "指标/倍数": "待收集",
        "可借鉴/差异": "规模差异",
      },
    ],
  },
  "valuation-returns": {
    scenarios: [
      { label: "Base", value: "待测算", detail: "试点后更新" },
      { label: "Downside", value: "不可测", detail: "授权未闭合" },
    ],
    sensitivityItems: [
      {
        敏感变量: "买量 ROI",
        影响方向: "回收周期",
        "阈值/区间": "1.0x",
        观察方式: "后台数据",
      },
    ],
  },
  "diligence-gaps": {
    questionGroups: [
      {
        priority: "P1",
        title: "P1 测试组",
        questions: [
          {
            question: "授权范围是否闭合？",
            whyItMatters: "影响商业化",
            owner: "法务",
            requiredEvidence: "合同样本",
          },
        ],
      },
    ],
  },
  "risks-mitigation": {
    riskRows: [
      {
        level: "高",
        risk: "授权链未闭合",
        cause: "合同缺失",
        impact: "无法投放",
        mitigation: "上线前法务审阅",
        evidenceSourceIds: ["U-1"],
      },
    ],
  },
  "timeline-milestones": {
    occurred: [
      {
        date: "2026-06-20",
        title: "项目方资料请求",
        detail: "向项目方发送尽调清单。",
        phase: "occurred",
      },
    ],
    inProgress: [
      {
        title: "法务初筛",
        detail: "审阅授权样本。",
        phase: "inProgress",
      },
    ],
    future: [
      {
        date: "T+14",
        title: "试点决策",
        detail: "根据资料完整性决定试点规模。",
        phase: "future",
      },
    ],
  },
  "decision-framework": {
    recommendation: "建议继续资料请求，暂缓正式投资。",
    decisionTable: [
      {
        选项: "继续推进",
        好处: "保留窗口期",
        "代价/风险": "资料缺口",
        适用条件: "7 天内补齐 P1 资料",
      },
    ],
    nextActions: [
      {
        下一步: "收取合同样本",
        Owner: "项目方",
        时间: "T+3",
        交付物: "授权合同",
      },
    ],
  },
};

for (const slot of CANONICAL_KB_SLOTS) {
  const patch = makePatch(slot, MINIMAL_PAYLOADS[slot]);
  const validated = validateStructuredSlotPatch(patch);
  report(`${slot} validateStructuredSlotPatch`, validated.ok, validated.ok ? "" : (validated as { reason: string }).reason);

  const applied = applyStructuredSlotPatchToKnowledgeNetworkHtml(sampleKb, patch);
  report(`${slot} apply patch`, applied.ok, applied.ok ? "" : applied.error);

  if (applied.ok) {
    report(
      `${slot} target section updated`,
      sectionRegex(slot).test(applied.html) &&
        applied.html.includes(`id="${slot}"`),
    );

    const otherSlots = CANONICAL_KB_SLOTS.filter((s) => s !== slot);
    const othersUnchanged = otherSlots.every((s) => {
      const before = extractBlock(sampleKb, sectionRegex(s));
      const after = extractBlock(applied.html, sectionRegex(s));
      return before === after && before.length > 0;
    });
    report(`${slot} non-target slots unchanged`, othersUnchanged);

    const kbConfigBefore = extractBlock(sampleKb, /<!--\s*KB-CONFIG[\s\S]*?-->/i);
    const kbConfigAfter = extractBlock(applied.html, /<!--\s*KB-CONFIG[\s\S]*?-->/i);
    report(`${slot} KB-CONFIG unchanged`, kbConfigBefore === kbConfigAfter && kbConfigBefore.length > 0);

    const navBefore = extractBlock(sampleKb, /<nav\s+class=["']kb-nav["'][\s\S]*?<\/nav>/i);
    const navAfter = extractBlock(applied.html, /<nav\s+class=["']kb-nav["'][\s\S]*?<\/nav>/i);
    report(`${slot} nav unchanged`, navBefore === navAfter && navBefore.length > 0);

    const validation = validateMergedKnowledgeNetworkAfterStructuredPatch(applied.html, {
      previousHtml: sampleKb,
      touchesTimeline: slot === "timeline-milestones",
    });
    report(`${slot} strict validation`, validation.ok, validation.error);
  }
}

const unknownSourcePatch = makePatch("risks-mitigation", {
  riskRows: [
    {
      level: "高",
      risk: "测试",
      evidenceSourceIds: ["U-99"],
    },
  ],
});
const unknownErr = validateEvidenceSourceIdsAgainstAppendixA(
  sampleKb,
  unknownSourcePatch.payload,
);
report("unknown source id rejected", unknownErr != null, unknownErr ?? "");

const unknownApplied = applyStructuredSlotPatchToKnowledgeNetworkHtml(
  sampleKb,
  unknownSourcePatch,
);
report("apply fails on unknown source", unknownApplied.ok === false, unknownApplied.error);

const htmlPayloadPatch = makePatch("snapshot", {
  keyFacts: [{ 项目项: "<script>alert(1)</script>", 内容: "x", 证据: "y" }],
});
report(
  "HTML/script in payload rejected",
  rejectHtmlOrScriptInPayload(htmlPayloadPatch.payload) != null,
);

const industryTimelinePatch = makePatch("timeline-milestones", {
  occurred: [
    {
      date: "2026-01-01",
      title: "行业趋势报告发布",
      detail: "宏观市场规模上升",
      phase: "occurred",
    },
  ],
});
const industryValidated = validateStructuredSlotPatch(industryTimelinePatch);
report(
  "industry event in timeline rejected",
  !industryValidated.ok || ("blocked" in industryValidated && industryValidated.blocked),
  industryValidated.ok ? "" : (industryValidated as { reason: string }).reason,
);

const blockedPatch = makePatch(
  "risks-mitigation",
  { riskRows: [{ level: "高", risk: "需新来源" }] },
  { status: "requires_full_update", summary: "需新增 Appendix A 来源" },
);
const blockedValidated = validateStructuredSlotPatch(blockedPatch);
report("requires_full_update marked blocked", blockedValidated.ok && "blocked" in blockedValidated && blockedValidated.blocked);
const blockedApplied = applyStructuredSlotPatchToKnowledgeNetworkHtml(sampleKb, blockedPatch);
report("blocked patch does not merge HTML", blockedApplied.ok === false);
report(
  "blocked patch leaves KB unchanged",
  blockedApplied.ok === false &&
    extractBlock(sampleKb, sectionRegex("risks-mitigation")) ===
      extractBlock(sampleKb, sectionRegex("risks-mitigation")),
);

const emptyTimelinePatch = makePatch("timeline-milestones", { occurred: [], inProgress: [], future: [] });
const emptyTimelineApplied = applyStructuredSlotPatchToKnowledgeNetworkHtml(
  sampleKb,
  emptyTimelinePatch,
);
report("empty timeline renders gap state", emptyTimelineApplied.ok === true);
if (emptyTimelineApplied.ok) {
  const section = extractBlock(emptyTimelineApplied.html, sectionRegex("timeline-milestones"));
  report(
    "empty timeline has gap callout",
    /暂无|gap|资料缺口/i.test(section) && !/<div class="tl-item"/i.test(section),
  );
}

const risksPatch = makePatch("risks-mitigation", MINIMAL_PAYLOADS["risks-mitigation"]);
const answer = `已更新风险板块。\n\n\`\`\`json\n${JSON.stringify(risksPatch, null, 2)}\n\`\`\`\n`;
const extracted = extractStructuredSlotPatchFromAnswer(answer);
report("extract from fenced json", extracted.ok === true);
if (extracted.ok && !("blocked" in extracted)) {
  report("extracted slot", extracted.patch.slot === "risks-mitigation", extracted.patch.slot);
}

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
