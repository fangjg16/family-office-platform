import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

export type SlotQualityIssue = {
  slot: CanonicalKbSlot;
  code: string;
  message: string;
};

export type FullKbQualityResult = {
  ok: boolean;
  coverageScore: number;
  slotScores: Record<CanonicalKbSlot, number>;
  issues: SlotQualityIssue[];
  repairHints: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arrLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function textLen(v: unknown): number {
  if (typeof v !== "string") return 0;
  return v.trim().length;
}

function narrativeParagraphs(payload: Record<string, unknown>, key: string): number {
  const blocks = payload[key];
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((n, b) => {
    if (!isRecord(b)) return n;
    const ps = b.paragraphs;
    return n + (Array.isArray(ps) ? ps.filter((p) => textLen(p) > 20).length : 0);
  }, 0);
}

function tableRows(payload: Record<string, unknown>, ...keys: string[]): number {
  let max = 0;
  for (const key of keys) {
    max = Math.max(max, arrLen(payload[key]));
  }
  return max;
}

function evaluateSlot(slot: CanonicalKbSlot, payload: unknown): { score: number; issues: SlotQualityIssue[] } {
  const issues: SlotQualityIssue[] = [];
  if (!isRecord(payload)) {
    return {
      score: 0,
      issues: [{ slot, code: "payload_missing", message: "payload 须为对象" }],
    };
  }
  const p = payload;
  let score = 0;
  let maxScore = 0;
  const need = (cond: boolean, points: number, code: string, message: string) => {
    maxScore += points;
    if (cond) score += points;
    else issues.push({ slot, code, message });
  };

  switch (slot) {
    case "snapshot": {
      need(textLen(p.stage) > 0, 8, "stage", "缺少 stage/阶段");
      need(textLen(p.status) > 0, 8, "status", "缺少 status/状态");
      need(tableRows(p, "keyFacts") >= 6, 20, "keyFacts", "keyFacts 至少 6 行（含主体/技术/产品/阶段/融资/gating）");
      need(
        textLen(p.oneLineJudgment) >= 20 || narrativeParagraphs(p, "overview") >= 1,
        12,
        "judgment",
        "缺少 oneLineJudgment 或 overview 叙述",
      );
      need(arrLen(p.gaps) >= 1, 12, "gaps", "须列出资料缺口 callout");
      break;
    }
    case "target-overview": {
      need(tableRows(p, "assetSummary") >= 3, 25, "assetSummary", "assetSummary 至少 3 项");
      need(
        tableRows(p, "keyClaims") >= 2 || narrativeParagraphs(p, "businessSummary") >= 2,
        20,
        "claims",
        "缺少 keyClaims 或 businessSummary 段落",
      );
      need(arrLen(p.gaps) >= 1, 10, "gaps", "须列出证据/缺口");
      break;
    }
    case "industry-market": {
      need(tableRows(p, "marketDrivers", "marketSize") >= 3, 25, "drivers", "marketDrivers 至少 3 条");
      need(tableRows(p, "valueChain") >= 2, 15, "valueChain", "缺少价值链 rows");
      need(
        tableRows(p, "policyContext") >= 1 || tableRows(p, "comparableSignals") >= 1,
        10,
        "policy",
        "缺少政策或可比信号",
      );
      need(arrLen(p.gaps) >= 1, 10, "gaps", "须列出行业资料缺口");
      break;
    }
    case "business-operations": {
      const hasJourney = isRecord(p.journeyMap) && arrLen(p.journeyMap.stages) >= 2;
      need(hasJourney, 20, "journey", "须含 journeyMap（≥2 stages）");
      need(
        tableRows(p, "revenueTree") >= 2 || narrativeParagraphs(p, "flywheel") >= 1,
        15,
        "revenue",
        "缺少 revenueTree 或 flywheel",
      );
      need(tableRows(p, "customerBuyer") >= 2, 15, "customer", "customerBuyer 至少 2 行");
      need(
        tableRows(p, "pricing") >= 1 || tableRows(p, "operatingBottlenecks", "supplyChain") >= 1,
        10,
        "ops",
        "缺少定价/供应链/瓶颈",
      );
      break;
    }
    case "legal-ownership": {
      need(tableRows(p, "entities", "ownershipClaims") >= 2, 25, "entities", "entities 至少 2 项");
      need(
        tableRows(p, "contractRights", "licenseRights") >= 1 || arrLen(p.relationshipEdges) >= 1,
        15,
        "rights",
        "缺少合同/IP 或关系边",
      );
      need(arrLen(p.unresolvedLegalIssues) >= 1, 10, "legal_gaps", "须列未决法律问题/缺口");
      break;
    }
    case "regulatory-compliance": {
      need(tableRows(p, "jurisdictionRows", "complianceRisks") >= 2, 25, "jurisdiction", "监管 rows 至少 2 条");
      need(
        tableRows(p, "licenseRequirements", "approvalPath") >= 1,
        15,
        "license",
        "缺少许可/审批路径",
      );
      need(arrLen(p.gaps) >= 1, 10, "gaps", "须列合规缺口");
      break;
    }
    case "resource-network": {
      need(tableRows(p, "parties", "resources") >= 3, 25, "parties", "parties 至少 3 项");
      need(
        tableRows(p, "capabilities", "dependencies") >= 1 || arrLen(p.relationshipEdges) >= 1,
        15,
        "capabilities",
        "缺少能力/依赖关系",
      );
      need(arrLen(p.missingResources) >= 1, 10, "missing", "须列缺失资源");
      break;
    }
    case "comps-benchmark": {
      need(tableRows(p, "compsRows") >= 2, 25, "comps", "compsRows 至少 2 条");
      need(
        tableRows(p, "transactionCases", "benchmarkMetrics") >= 1,
        15,
        "transactions",
        "缺少交易案例或指标",
      );
      need(arrLen(p.relevanceNotes) >= 1, 10, "notes", "须说明可比适用性/缺口");
      break;
    }
    case "valuation-returns": {
      need(arrLen(p.scenarios) >= 3, 25, "scenarios", "scenarios 须含 base/upside/downside 共 ≥3");
      need(tableRows(p, "sensitivityItems") >= 2, 15, "sensitivity", "sensitivityItems 至少 2 条");
      need(
        tableRows(p, "investmentCashflow", "returnDrivers", "downsideCases") >= 1,
        10,
        "cashflow",
        "缺少投资人现金流/下行情景",
      );
      need(arrLen(p.gaps) >= 1, 10, "gaps", "须列估值缺口");
      break;
    }
    case "diligence-gaps": {
      const groups = Array.isArray(p.questionGroups) ? p.questionGroups : [];
      const priorities = new Set(groups.map((g) => (isRecord(g) ? String(g.priority ?? "") : "")));
      need(groups.length >= 2, 20, "groups", "questionGroups 至少 2 组");
      need(priorities.has("P1") || priorities.has("最高"), 15, "p1", "须含 P1/最高优先级组");
      const qCount = groups.reduce((n, g) => n + (isRecord(g) ? arrLen(g.questions) : 0), 0);
      need(qCount >= 5, 25, "questions", "尽调问题至少 5 条");
      break;
    }
    case "risks-mitigation": {
      need(tableRows(p, "riskRows") >= 5, 35, "risks", "riskRows 至少 5 条");
      const withMitigation = (Array.isArray(p.riskRows) ? p.riskRows : []).filter(
        (r) => isRecord(r) && textLen(r.mitigation) > 5,
      ).length;
      need(withMitigation >= 3, 15, "mitigation", "至少 3 条风险含缓释措施");
      break;
    }
    case "timeline-milestones": {
      const occurred = arrLen(p.occurred);
      const inProgress = arrLen(p.inProgress);
      const future = arrLen(p.future);
      const total = occurred + inProgress + future;
      need(total >= 3, 25, "timeline_nodes", "timeline 至少 3 个节点（已发生/推进中/未来）");
      need(occurred >= 1, 10, "occurred", "须含已发生节点");
      need(future >= 1 || inProgress >= 1, 10, "forward", "须含推进中或未来节点");
      break;
    }
    case "decision-framework": {
      need(textLen(p.recommendation) >= 15, 20, "recommendation", "缺少 recommendation");
      need(tableRows(p, "decisionTable") >= 2, 20, "decisionTable", "decisionTable 至少 2 行");
      need(tableRows(p, "nextActions") >= 2, 20, "nextActions", "nextActions 至少 2 条");
      need(
        tableRows(p, "goNoGoConditions", "triggers") >= 1,
        10,
        "conditions",
        "缺少 go/no-go 或触发条件",
      );
      break;
    }
    default:
      break;
  }

  const normalized = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score: normalized, issues };
}

export function validateFullStructuredKbQuality(data: StructuredKbData): FullKbQualityResult {
  const slotScores = {} as Record<CanonicalKbSlot, number>;
  const issues: SlotQualityIssue[] = [];
  const repairHints: string[] = [];

  for (const slot of CANONICAL_KB_SLOTS) {
    const payload = data.slots[slot as keyof SlotPayloadBySlot];
    const ev = evaluateSlot(slot, payload);
    slotScores[slot] = ev.score;
    issues.push(...ev.issues);
    for (const issue of ev.issues) {
      repairHints.push(`${slot}: ${issue.message}`);
    }
  }

  const coverageScore = Math.round(
    CANONICAL_KB_SLOTS.reduce((sum, s) => sum + slotScores[s], 0) / CANONICAL_KB_SLOTS.length,
  );

  const failingSlots = CANONICAL_KB_SLOTS.filter((s) => slotScores[s] < 55).length;
  const ok = coverageScore >= 62 && failingSlots <= 3;

  return { ok, coverageScore, slotScores, issues, repairHints };
}

export function buildStructuredKbRepairMessage(result: FullKbQualityResult): string {
  const top = result.repairHints.slice(0, 8);
  return (
    `structured-kb-data 未达 full KB 质量门槛（coverage ${result.coverageScore}/100）。` +
    `请补全以下字段后重新交付 JSON（勿写 HTML）：\n- ${top.join("\n- ")}` +
    (result.repairHints.length > 8 ? `\n…另有 ${result.repairHints.length - 8} 项` : "")
  );
}
