import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type {
  BusinessOperationsPayload,
  CompsBenchmarkPayload,
  DecisionFrameworkPayload,
  DiligenceGapsPayload,
  GapCallout,
  IndustryMarketPayload,
  LegalOwnershipPayload,
  MetricCard,
  NarrativeBlock,
  QuestionGroup,
  RegulatoryCompliancePayload,
  RelationshipEdge,
  ResourceNetworkPayload,
  RiskRow,
  RisksMitigationPayload,
  ScenarioRow,
  SnapshotPayload,
  StructuredSlotPatchAny,
  SlotPayloadBySlot,
  TableRow,
  TargetOverviewPayload,
  TimelineItem,
  TimelineMilestonesPayload,
  ValuationReturnsPayload,
} from "./knowledge-network-structured-patch-types";

export const CHINESE_SLOT_NUMERALS = [
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三",
] as const;

export const SLOT_DEFAULT_TITLES: Record<CanonicalKbSlot, { num: string; title: string }> = {
  snapshot: { num: "一", title: "项目快照" },
  "target-overview": { num: "二", title: "资产构成 / 标的概况" },
  "industry-market": { num: "三", title: "行业背景与市场格局" },
  "business-operations": { num: "四", title: "业务模式与运营假设" },
  "resource-network": { num: "五", title: "资源网络与关键协作" },
  "legal-ownership": { num: "六", title: "法律结构与权属关系" },
  "regulatory-compliance": { num: "七", title: "监管合规与许可路径" },
  "comps-benchmark": { num: "八", title: "市场对标与可比案例" },
  "valuation-returns": { num: "九", title: "投资回报与敏感性分析" },
  "diligence-gaps": { num: "十", title: "待确认问题 / 尽调缺口" },
  "risks-mitigation": { num: "十一", title: "关键风险与缓释" },
  "timeline-milestones": { num: "十二", title: "项目时间轴" },
  "decision-framework": { num: "十三", title: "决策框架" },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractFencedJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const m of text.matchAll(re)) {
    const body = m[1]?.trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

export function sectionReplaceRegex(slot: string): RegExp {
  return new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>[\\s\\S]*?<\\/section>`,
    "i",
  );
}

export function extractSectionTitleBlock(previousHtml: string, slot: CanonicalKbSlot): string {
  const sectionMatch = previousHtml.match(sectionReplaceRegex(slot));
  if (!sectionMatch) {
    const d = SLOT_DEFAULT_TITLES[slot];
    return `<h2 class="section-title"><span class="section-num">${d.num}</span>${esc(d.title)}</h2>`;
  }
  const h2 = sectionMatch[0].match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
  if (h2?.[0]) return h2[0];
  const d = SLOT_DEFAULT_TITLES[slot];
  return `<h2 class="section-title"><span class="section-num">${d.num}</span>${esc(d.title)}</h2>`;
}

function normalizeSourceIdLocal(id: string): string {
  const t = id.trim();
  return t.startsWith("source-") ? t : `source-${t}`;
}

function renderEvidenceCell(ids?: string[]): string {
  if (!ids?.length) return "待核实";
  return ids
    .map((raw) => {
      const id = normalizeSourceIdLocal(raw);
      const label = id.replace(/^source-/, "");
      return `<sup class="cite-ref"><a href="#${esc(id)}">[${esc(label)}]</a></sup>`;
    })
    .join(" ");
}

function renderGapCallouts(gaps?: GapCallout[]): string {
  if (!gaps?.length) return "";
  return gaps
    .map((g) => {
      const title =
        g.confidence === "low" ? "低置信度" : g.confidence === "gap" ? "资料缺口" : "备注";
      return `<aside class="callout warning"><div class="callout-title">${esc(title)}</div><p>${esc(g.text)}</p></aside>`;
    })
    .join("");
}

function renderNarratives(blocks?: NarrativeBlock[]): string {
  if (!blocks?.length) return "";
  return blocks
    .map((b) => {
      const h = b.heading ? `<h3>${esc(b.heading)}</h3>` : "";
      const ps = b.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
      return `${h}${ps}`;
    })
    .join("");
}

function renderMetricCards(cards?: MetricCard[]): string {
  if (!cards?.length) return "";
  return `<div class="valuation-grid">${cards
    .map(
      (c) =>
        `<div class="valuation-box"><div class="valuation-label">${esc(c.label)}</div>` +
        `<div class="valuation-value">${esc(c.value)}</div>` +
        `${c.note ? `<div class="valuation-note">${esc(c.note)}</div>` : ""}</div>`,
    )
    .join("")}</div>`;
}

function renderTable(
  headers: string[],
  rows: TableRow[],
  columnKeys: string[],
): string {
  if (!rows.length) return "";
  const head = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = rows
    .map(
      (row) =>
        `<tr>${columnKeys.map((k) => `<td>${esc(String(row[k] ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderRelationshipTable(edges?: RelationshipEdge[]): string {
  if (!edges?.length) return "";
  return renderTable(
    ["关系", "从", "到", "状态", "风险"],
    edges.map((e) => ({
      relation: e.relation,
      from: e.from,
      to: e.to,
      status: e.status ?? "",
      risk: e.risk ?? "",
    })),
    ["relation", "from", "to", "status", "risk"],
  );
}

function scenarioVariantClass(label: string): string {
  const l = label.toLowerCase();
  if (/down|悲观|下行|bear/.test(l)) return "down";
  if (/up|乐观|上行|bull/.test(l)) return "up";
  return "base";
}

function renderScenarioCards(scenarios?: ScenarioRow[]): string {
  if (!scenarios?.length) return "";
  return `<div class="scenario-cards">${scenarios
    .map(
      (s) =>
        `<div class="scenario-card ${scenarioVariantClass(s.label)}"><div class="sc-label">${esc(s.label)}</div>` +
        `<div class="sc-irr">${esc(s.value)}</div>` +
        `${s.detail ? `<div class="sc-detail">${esc(s.detail)}</div>` : ""}</div>`,
    )
    .join("")}</div>`;
}

function riskLevelClass(level: string): string {
  const l = level.trim();
  if (/critical|极高|致命|5/i.test(l)) return "risk-level-critical";
  if (/高|high|4/i.test(l)) return "risk-level-high";
  if (/中|medium|3/i.test(l)) return "risk-level-medium";
  return "risk-level-low";
}

function renderOneLineJudgment(text?: string): string {
  if (!text?.trim()) return "";
  return (
    `<aside class="callout info"><div class="callout-title">一句话判断</div>` +
    `<p>${esc(text.trim())}</p></aside>`
  );
}

function renderJourneyMap(
  journey?: BusinessOperationsPayload["journeyMap"],
): string {
  if (!journey?.stages?.length) return "";
  const cols = journey.stages.length;
  const stages = journey.stages.map((s) => `<div class="journey-stage">${esc(s)}</div>`).join("");
  const lanes = (journey.lanes ?? [])
    .map((lane) => {
      const label = `<div class="journey-lane-label">${esc(lane.label)}</div>`;
      const nodes = lane.nodes.map((n) => `<div class="journey-node">${esc(n)}</div>`).join("");
      return label + nodes;
    })
    .join("");
  return `<div class="journey-wrap"><div class="journey" style="--journey-cols:${cols}"><div class="journey-corner"></div>${stages}${lanes}</div></div>`;
}

function renderTimelineBlock(
  title: string,
  items: TimelineItem[],
  cssClass = "",
): string {
  if (!items.length) return "";
  const inner = items
    .map((item) => {
      const date = item.phase === "inProgress" ? "进行中" : item.date ?? "待定";
      const cls =
        item.phase === "inProgress"
          ? "tl-item timeline-ongoing"
          : item.phase === "future"
            ? "tl-item timeline-deadline"
            : "tl-item";
      const evidence = item.evidenceSourceIds?.length
        ? ` ${renderEvidenceCell(item.evidenceSourceIds)}`
        : "";
      return `<div class="${cls}"><span class="tl-date">${esc(date)}</span>` +
        `<span class="tl-text"><strong>${esc(item.title)}</strong> ${esc(item.detail)}${evidence}</span></div>`;
    })
    .join("");
  return `<h3>${esc(title)}</h3><div class="timeline project-timeline ${cssClass}">${inner}</div>`;
}

function renderQuestionGroups(groups: QuestionGroup[]): string {
  return groups
    .map((g) => {
      const title = g.title ?? g.priority;
      const prioTag =
        g.priority === "P1" || g.priority === "最高"
          ? "P1"
          : g.priority === "P2"
            ? "P2"
            : "P3";
      const rows = g.questions.map((q) => ({
        question: q.question,
        strength: q.requiredEvidence ? "待补证据" : "待核实",
        owner: q.owner ?? "待定",
        urgency: q.priority ?? g.priority,
        action: q.requiredEvidence ?? q.whyItMatters ?? "",
      }));
      const table = renderTable(
        ["问题/主张", "证据强度", "Owner", "紧急程度/阻塞", "需要资料/动作"],
        rows,
        ["question", "strength", "owner", "urgency", "action"],
      );
      return `<div class="oq-group"><h3><span class="badge badge-red">${esc(prioTag)}</span> ${esc(title)}</h3>${table}</div>`;
    })
    .join("");
}

function renderRiskMatrix(rows: RiskRow[]): string {
  if (!rows.length) return "";
  const body = rows
    .map((r) => {
      const cause = [r.cause, r.trigger].filter(Boolean).join("；");
      const mitigation = r.mitigation ?? "";
      const evidence = renderEvidenceCell(r.evidenceSourceIds);
      return `<tr><td><span class="risk-level ${riskLevelClass(r.level)}">${esc(r.level)}</span></td><td>${esc(r.risk)}</td><td>${esc(cause)}</td>` +
        `<td>${esc(r.impact ?? "")}</td><td>${evidence}</td><td>${esc(mitigation)}</td></tr>`;
    })
    .join("");
  return `<table class="risk-matrix-table"><thead><tr><th>级别</th><th>风险</th><th>原因/触发</th>` +
    `<th>影响</th><th>证据</th><th>缓释/负责人/状态</th></tr></thead><tbody>${body}</tbody></table>`;
}

export function renderSlotPayloadByCanonicalSlot(
  slot: CanonicalKbSlot,
  payload: StructuredSlotPatchAny["payload"],
): string {
  switch (slot) {
    case "snapshot": {
      const p = payload as SnapshotPayload;
      const facts =
        p.keyFacts ??
        [
          p.stage ? { 项目项: "当前阶段", 内容: p.stage, 证据: "" } : null,
          p.status ? { 项目项: "状态", 内容: p.status, 证据: "" } : null,
        ].filter(Boolean) as TableRow[];
      const table = renderTable(
        ["项目项", "内容", "证据/来源"],
        facts.map((r) => ({
          col1: r["项目项"] ?? r.label ?? r.key ?? "",
          col2: r["内容"] ?? r.value ?? "",
          col3: r["证据/来源"] ?? r.evidence ?? "",
        })),
        ["col1", "col2", "col3"],
      );
      return (
        renderOneLineJudgment(p.oneLineJudgment) +
        renderMetricCards(p.maturityMetrics) +
        renderNarratives(p.overview) +
        table +
        renderGapCallouts(p.gaps)
      );
    }
    case "target-overview": {
      const p = payload as TargetOverviewPayload;
      return (
        renderNarratives(p.businessSummary) +
        renderTable(
          ["资产/权利/能力", "定义与范围", "可投资性", "关键证据/缺口"],
          p.assetSummary ?? [],
          ["资产/权利/能力", "定义与范围", "可投资性", "关键证据/缺口"],
        ) +
        renderTable(
          ["交易要素", "内容", "证据/缺口"],
          p.transactionSummary ?? [],
          ["交易要素", "内容", "证据/缺口"],
        ) +
        renderTable(
          ["关键主张", "依据", "缺口"],
          p.keyClaims ?? [],
          ["关键主张", "依据", "缺口"],
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "industry-market": {
      const p = payload as IndustryMarketPayload;
      return (
        renderTable(
          ["主题", "事实/数据", "投资含义", "来源"],
          p.marketDrivers ?? p.marketSize ?? [],
          ["主题", "事实/数据", "投资含义", "来源"],
        ) +
        renderTable(
          ["价值链环节", "描述", "壁垒/机会"],
          p.valueChain ?? [],
          ["价值链环节", "描述", "壁垒/机会"],
        ) +
        renderTable(
          ["政策/监管", "要点", "影响"],
          p.policyContext ?? [],
          ["政策/监管", "要点", "影响"],
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "business-operations": {
      const p = payload as BusinessOperationsPayload;
      return (
        renderJourneyMap(p.journeyMap) +
        renderTable(
          ["应用/产品场景", "价值主张", "证据/缺口"],
          p.revenueTree ?? [],
          ["应用/产品场景", "价值主张", "证据/缺口"],
        ) +
        renderNarratives(p.flywheel) +
        renderTable(
          ["客户/受众/付费方", "需求", "获客/渠道", "验证状态"],
          p.customerBuyer ?? [],
          ["客户/受众/付费方", "需求", "获客/渠道", "验证状态"],
        ) +
        renderTable(
          ["收入来源", "定价/费率", "成本/履约", "单位经济/KPI"],
          p.pricing ?? [],
          ["收入来源", "定价/费率", "成本/履约", "单位经济/KPI"],
        ) +
        renderTable(
          ["瓶颈", "影响", "缓释"],
          p.operatingBottlenecks ?? p.supplyChain ?? [],
          ["瓶颈", "影响", "缓释"],
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "legal-ownership": {
      const p = payload as LegalOwnershipPayload;
      return (
        renderTable(
          ["主体/权利", "角色/归属", "限制/负担", "证据/缺口"],
          p.entities ?? p.ownershipClaims ?? [],
          ["主体/权利", "角色/归属", "限制/负担", "证据/缺口"],
        ) +
        renderTable(
          ["合同权利", "范围", "限制", "证据"],
          p.contractRights ?? [],
          ["合同权利", "范围", "限制", "证据"],
        ) +
        renderRelationshipTable(p.relationshipEdges) +
        renderGapCallouts(p.unresolvedLegalIssues)
      );
    }
    case "regulatory-compliance": {
      const p = payload as RegulatoryCompliancePayload;
      return (
        renderTable(
          ["监管/规则", "适用原因", "状态/许可", "红线/下一步"],
          p.jurisdictionRows ?? p.complianceRisks ?? [],
          ["监管/规则", "适用原因", "状态/许可", "红线/下一步"],
        ) +
        renderTable(
          ["许可要求", "状态", "负责人"],
          p.licenseRequirements ?? [],
          ["许可要求", "状态", "负责人"],
        ) +
        renderTable(
          ["审批路径", "步骤", "时间"],
          p.approvalPath ?? [],
          ["审批路径", "步骤", "时间"],
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "resource-network": {
      const p = payload as ResourceNetworkPayload;
      return (
        renderTable(
          ["主体/资源", "关系与作用", "强度/可验证性", "依赖与风险"],
          p.parties ?? p.resources ?? [],
          ["主体/资源", "关系与作用", "强度/可验证性", "依赖与风险"],
        ) +
        renderTable(
          ["能力", "来源", "缺口"],
          p.capabilities ?? [],
          ["能力", "来源", "缺口"],
        ) +
        renderRelationshipTable(p.relationshipEdges) +
        renderGapCallouts(p.missingResources)
      );
    }
    case "comps-benchmark": {
      const p = payload as CompsBenchmarkPayload;
      return (
        renderTable(
          ["可比对象", "可比逻辑", "指标/倍数", "可借鉴/差异"],
          p.compsRows ?? [],
          ["可比对象", "可比逻辑", "指标/倍数", "可借鉴/差异"],
        ) +
        renderTable(
          ["交易案例", "条款", "启示"],
          p.transactionCases ?? [],
          ["交易案例", "条款", "启示"],
        ) +
        renderGapCallouts(p.relevanceNotes)
      );
    }
    case "valuation-returns": {
      const p = payload as ValuationReturnsPayload;
      const metrics: MetricCard[] =
        p.benchmarkMetrics?.map((r) => ({
          label: r["指标"] ?? r.label ?? "",
          value: r["数值"] ?? r.value ?? "",
          note: r["说明"] ?? r.note,
        })) ?? [];
      return (
        renderMetricCards(metrics) +
        renderScenarioCards(p.scenarios) +
        renderTable(
          ["资金用途", "金额/比例", "说明"],
          p.investmentCashflow ?? [],
          ["资金用途", "金额/比例", "说明"],
        ) +
        renderTable(
          ["敏感变量", "影响方向", "阈值/区间", "观察方式"],
          p.sensitivityItems ?? [],
          ["敏感变量", "影响方向", "阈值/区间", "观察方式"],
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "diligence-gaps": {
      const p = payload as DiligenceGapsPayload;
      return renderQuestionGroups(p.questionGroups);
    }
    case "risks-mitigation": {
      const p = payload as RisksMitigationPayload;
      return (
        renderRiskMatrix(p.riskRows) +
        renderTable(
          ["停推条件", "触发动作", "Owner"],
          p.stopConditions ?? [],
          ["停推条件", "触发动作", "Owner"],
        )
      );
    }
    case "timeline-milestones": {
      const p = payload as TimelineMilestonesPayload;
      const occurred = p.occurred ?? [];
      const inProgress = p.inProgress ?? [];
      const future = p.future ?? [];
      const hasAny = occurred.length + inProgress.length + future.length > 0;
      const sub =
        `<p class="section-sub">PROJECT TIMELINE · 仅记录项目自身节点，不放行业动向、市场趋势或研究动作</p>`;
      if (!hasAny) {
        return (
          sub +
          renderGapCallouts(
            p.gaps ?? [{ text: "暂无已记录的项目级时间节点。", confidence: "gap" }],
          )
        );
      }
      return (
        sub +
        renderTimelineBlock("8.1 已发生关键事件", occurred) +
        renderTimelineBlock("8.2 正在推进", inProgress) +
        renderTimelineBlock("8.3 未来关键节点", future) +
        renderGapCallouts(p.gaps)
      );
    }
    case "decision-framework": {
      const p = payload as DecisionFrameworkPayload;
      const rec = p.recommendation
        ? `<aside class="callout info"><div class="callout-title">条件式建议</div><p>${esc(p.recommendation)}</p></aside>`
        : "";
      return (
        rec +
        renderTable(
          ["投资论点", "证据", "前置条件", "反证/风险"],
          p.goNoGoConditions ?? [],
          ["投资论点", "证据", "前置条件", "反证/风险"],
        ) +
        renderTable(
          ["选项", "好处", "代价/风险", "适用条件"],
          p.decisionTable ?? [],
          ["选项", "好处", "代价/风险", "适用条件"],
        ) +
        renderTable(
          ["下一步", "Owner", "时间", "交付物"],
          p.nextActions ?? [],
          ["下一步", "Owner", "时间", "交付物"],
        ) +
        renderTable(
          ["触发器", "条件", "动作"],
          p.triggers ?? [],
          ["触发器", "条件", "动作"],
        ) +
        renderGapCallouts(p.openConditions)
      );
    }
    default:
      return "";
  }
}


export function renderCanonicalSlotSection(
  slot: CanonicalKbSlot,
  payload: SlotPayloadBySlot[CanonicalKbSlot],
  options?: { numeral?: string; title?: string },
): string {
  const d = SLOT_DEFAULT_TITLES[slot];
  const num = options?.numeral ?? d.num;
  const title = options?.title ?? d.title;
  const titleBlock = `<h2 class="section-title"><span class="section-num">${esc(num)}</span>${esc(title)}</h2>`;
  const body = renderSlotPayloadByCanonicalSlot(slot, payload);
  return `<section class="block kb-panel" id="${slot}">${titleBlock}${body}</section>`;
}

export function resolveSlotNumeral(
  displayOrder: readonly CanonicalKbSlot[],
  slot: CanonicalKbSlot,
): string {
  const idx = displayOrder.indexOf(slot);
  if (idx >= 0 && idx < CHINESE_SLOT_NUMERALS.length) return CHINESE_SLOT_NUMERALS[idx]!;
  return SLOT_DEFAULT_TITLES[slot].num;
}
