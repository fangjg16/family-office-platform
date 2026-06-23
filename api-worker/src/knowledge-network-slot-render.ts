import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  countRichRowsForSpec,
  filterValidRowsForColumns,
  isMeaningfulCell,
  pickRowCell,
  rowHasContentButNoMapping,
} from "./knowledge-network-content-row-quality";
import { isGapMarkedRow, splitFactAndGapRows } from "./knowledge-network-coverage-target";
import { normalizeSlotPayload } from "./knowledge-network-slot-normalizer";
import { ROW_SPECS } from "./knowledge-network-row-columns";
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

function esc(s: string | undefined | null): string {
  const t = s == null ? "" : String(s);
  return t
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

function renderMissingCallout(points: string | string[]): string {
  const items = Array.isArray(points) ? points : [points];
  return (
    `<aside class="callout missing"><div class="callout-title">缺乏资料</div><ul>` +
    items.map((p) => `<li>${esc(p)}</li>`).join("") +
    `</ul></aside>`
  );
}

function renderGapCallouts(gaps?: GapCallout[]): string {
  if (!gaps?.length) return "";
  return gaps
    .map((g) => {
      if (g.confidence === "gap") return renderMissingCallout(g.text);
      const title =
        g.confidence === "low" ? "低置信度" : "备注";
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

function renderGapLabel(text: string): string {
  return renderMissingCallout(text);
}

function renderStructuredGapTable(
  title: string,
  headers: string[],
  rows: TableRow[] | undefined,
  specKey: keyof typeof ROW_SPECS,
): string {
  const spec = ROW_SPECS[specKey];
  const valid = filterValidRowsForColumns(rows, spec.columns);
  if (!valid.length) return "";
  const head = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = valid
    .map((row) => {
      const r = row as Record<string, unknown>;
      return `<tr class="gap-row">${spec.columns
        .map((keys) => {
          const cell = pickRowCell(r, [...keys]);
          return `<td>${renderTableCellContent(cell, true)}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");
  return `<h3>${esc(title)}</h3><table class="gap-coverage-table">${head}<tbody>${body}</tbody></table>`;
}

function legalFactSufficient(p: LegalOwnershipPayload): boolean {
  return (
    countRichRowsForSpec(p.contractRights, ROW_SPECS.contractRights) >= 1 ||
    filterValidRowsForColumns(p.licenseRights, ROW_SPECS.contractRights.columns).length >= 1 ||
    (p.relationshipEdges?.length ?? 0) >= 1
  );
}

function regulatoryFactSufficient(p: RegulatoryCompliancePayload): boolean {
  const j =
    filterValidRowsForColumns(p.jurisdictionRows, ROW_SPECS.jurisdictionRows.columns).length +
    filterValidRowsForColumns(p.complianceRisks, ROW_SPECS.jurisdictionRows.columns).length;
  return (
    j >= 2 &&
    (countRichRowsForSpec(p.licenseRequirements, ROW_SPECS.licenseRequirements) >= 1 ||
      filterValidRowsForColumns(p.approvalPath, ROW_SPECS.approvalPath.columns).length >= 1)
  );
}

function collectLegalGapRows(p: LegalOwnershipPayload): TableRow[] {
  const raw = [...(p.legalGapRows ?? []), ...((p.unresolvedLegalIssues ?? []) as TableRow[])];
  return filterValidRowsForColumns(raw, ROW_SPECS.legalGapRows.columns);
}

function collectRegulatoryGapRows(p: RegulatoryCompliancePayload): TableRow[] {
  const raw = [
    ...(p.regulatoryGaps ?? []),
    ...(p.approvalPath ?? []),
    ...((p.gaps ?? []) as TableRow[]),
  ];
  return filterValidRowsForColumns(raw, ROW_SPECS.regulatoryGapRows.columns);
}

function renderTableCellContent(value: string, isGapRow: boolean): string {
  if (isMeaningfulCell(value)) return esc(value);
  if (isGapRow) return '<span class="tag tag-gap">待验证</span>';
  return '<span class="cell-muted">—</span>';
}

function renderTable(
  headers: string[],
  rows: TableRow[],
  columns: readonly (readonly string[])[],
): string {
  const valid = filterValidRowsForColumns(rows, columns);
  if (!valid.length) return "";
  const head = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = valid
    .map((row) => {
      const r = row as Record<string, unknown>;
      const isGapRow = isGapMarkedRow(r);
      const cells = columns.map((keys) => pickRowCell(r, [...keys]));
      const meaningful = cells.filter((c) => isMeaningfulCell(c)).length;
      if (meaningful === 0) return "";
      if (!isGapRow && meaningful < Math.ceil(columns.length / 2)) return "";
      return `<tr class="${isGapRow ? "gap-row" : ""}">${cells
        .map((c) => `<td>${renderTableCellContent(c, isGapRow)}</td>`)
        .join("")}</tr>`;
    })
    .filter(Boolean)
    .join("");
  if (!body) return "";
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderMappingWarning(label: string, paths: string[]): string {
  const sample = paths.slice(0, 3).join("；");
  const more = paths.length > 3 ? ` 等 ${paths.length} 条` : "";
  return `<aside class="callout warning"><div class="callout-title">字段映射警告</div><p>${esc(label)}：${esc(sample)}${esc(more)} — 列名无法识别，需 repair。</p></aside>`;
}

function renderTableOrGap(
  label: string,
  headers: string[],
  rows: TableRow[] | undefined,
  specKey: keyof typeof ROW_SPECS,
): string {
  const spec = ROW_SPECS[specKey];
  const columns = spec.columns;
  const valid = filterValidRowsForColumns(rows, columns);
  const unmapped =
    rows?.filter((r) => rowHasContentButNoMapping(r as Record<string, unknown>, columns)) ?? [];
  const partialEmpty =
    rows?.filter((r) => {
      const row = r as Record<string, unknown>;
      if (rowHasContentButNoMapping(row, columns)) return false;
      return !filterValidRowsForColumns([r], columns).length && Object.keys(row).length > 0;
    }) ?? [];

  let out = "";
  if (valid.length) {
    out += renderTable(headers, valid, columns);
  } else if (rows?.length) {
    out += renderGapLabel(`${label}：现有 row 字段无法映射或无有效内容，待补资料或改写为 gap。`);
  } else {
    out += renderGapLabel(`${label}：暂无有效数据。`);
  }
  if (unmapped.length) {
    out += renderMappingWarning(
      `${label} 有 ${unmapped.length} 条 row 字段无法映射`,
      unmapped.map((_, i) => `${label}[${i}]`),
    );
  } else if (partialEmpty.length && valid.length) {
    out += renderMappingWarning(
      `${label} 有 ${partialEmpty.length} 条 row 被丢弃（别名映射后无效）`,
      partialEmpty.map((_, i) => `${label}[partial-${i}]`),
    );
  }
  return out;
}

function renderRelationshipTable(edges?: RelationshipEdge[]): string {
  if (!edges?.length) return "";
  const rows = edges
    .map((e) => ({
      relation: e.relation,
      from: e.from,
      to: e.to,
      status: e.status ?? "",
      risk: e.risk ?? "",
    }))
    .filter((r) => Object.values(r).some((v) => isMeaningfulCell(v)));
  if (!rows.length) return renderGapLabel("关系网络：暂无有效关系边。");
  return renderTable(
    ["关系", "从", "到", "状态", "风险"],
    rows,
    [
      ["relation", "关系"],
      ["from", "从"],
      ["to", "到"],
      ["status", "状态"],
      ["risk", "风险"],
    ],
  );
}

function scenarioVariantClass(label: string): string {
  const l = label.toLowerCase();
  if (/down|悲观|下行|bear/.test(l)) return "down";
  if (/up|乐观|上行|bull/.test(l)) return "up";
  return "base";
}

function renderScenarioCards(scenarios?: ScenarioRow[]): string {
  const valid = (scenarios ?? []).filter(
    (s) => isMeaningfulCell(s.label) && isMeaningfulCell(s.value ?? s.detail),
  );
  if (!valid.length) return renderGapLabel("情景分析：缺少 base/upside/downside 有效情景。");
  return `<div class="scenario-cards">${valid
    .map((s) => {
      const value = String(s.value ?? "");
      const isGapScenario = /无法量化|待建模|gap|缺口|待确认/i.test(`${value} ${s.detail ?? ""}`);
      const valueClass = isGapScenario ? "sc-gap" : "sc-irr";
      return (
        `<div class="scenario-card ${scenarioVariantClass(s.label)}"><div class="sc-label">${esc(s.label)}</div>` +
        `<div class="${valueClass}">${esc(value)}</div>` +
        `${s.detail ? `<div class="sc-detail">${esc(s.detail)}</div>` : ""}</div>`
      );
    })
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

function renderProcessFlow(steps?: TableRow[]): string {
  if (!steps?.length) return "";
  const valid = steps.filter((s) =>
    Object.values(s as Record<string, unknown>).some((v) => isMeaningfulCell(v)),
  );
  if (!valid.length) return "";
  let out = '<div class="process-flow">';
  for (let i = 0; i < valid.length; i++) {
    const step = valid[i] as Record<string, unknown>;
    const cls = i === valid.length - 1 ? "pf-step pf-step-end" : "pf-step";
    out +=
      `<div class="${cls}"><div class="pf-step-label">${esc(pickRowCell(step, ["title", "name", "stage"]))}</div>` +
      `<div class="pf-step-body">${esc(pickRowCell(step, ["detail", "text", "description"]))}</div>` +
      `<div class="pf-step-margin">${esc(pickRowCell(step, ["value", "margin", "kpi"]))}</div></div>`;
    if (i < valid.length - 1) out += '<div class="pf-arrow">→</div>';
  }
  out += "</div>";
  return out;
}

function renderBmc(canvas?: Record<string, string[] | string>): string {
  if (!canvas || !Object.keys(canvas).length) return "";
  const cells: Array<[string, string, string]> = [
    ["bmc-kp", "Key Partners", "keyPartners"],
    ["bmc-ka", "Key Activities", "keyActivities"],
    ["bmc-kr", "Key Resources", "keyResources"],
    ["bmc-vp", "Value Proposition", "valueProposition"],
    ["bmc-cr", "Customer Relationships", "customerRelationships"],
    ["bmc-ch", "Channels", "channels"],
    ["bmc-cs", "Customer Segments", "customerSegments"],
    ["bmc-cost", "Cost Structure", "costStructure"],
    ["bmc-rev", "Revenue Streams", "revenueStreams"],
  ];
  let out = '<div class="bmc">';
  for (const [cls, label, key] of cells) {
    const raw = canvas[key];
    const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    out += `<div class="bmc-cell ${cls}"><h5>${esc(label)}</h5><ul>`;
    for (const item of items) {
      if (isMeaningfulCell(item)) out += `<li>${esc(String(item))}</li>`;
    }
    out += "</ul></div>";
  }
  out += "</div>";
  return out;
}

function renderFlywheelBlock(flywheel?: NarrativeBlock[] | TableRow[]): string {
  if (!Array.isArray(flywheel) || flywheel.length === 0) return "";
  if (flywheel.every((f) => isRecord(f) && !("paragraphs" in f))) {
    return renderTable(
      ["飞轮环节", "增强机制", "待验证指标"],
      flywheel as TableRow[],
      [
        ["step", "name", "环节"],
        ["mechanism", "增强机制"],
        ["metric", "待验证指标"],
      ],
    );
  }
  return renderNarratives(flywheel as NarrativeBlock[]);
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

function priorityBadgeClass(priority: string): string {
  if (priority === "P1" || priority === "最高") return "badge-red";
  if (priority === "P2") return "badge-amber";
  return "badge-gray";
}

function renderQuestionGroups(groups?: QuestionGroup[]): string {
  if (!groups?.length) {
    return `<div class="oq-group"><h3>尽调缺口</h3>${renderGapLabel("暂无有效问题组。")}</div>`;
  }
  return groups
    .map((g) => {
      const title = g.title ?? g.priority ?? "尽调缺口";
      const validQs = filterValidRowsForColumns(
        g.questions,
        ROW_SPECS.diligenceQuestion.columns,
        0.4,
      );
      const body =
        validQs.length > 0
          ? renderTable(
              ["问题/主张", "证据强度", "Owner", "紧急程度/阻塞", "需要资料/动作"],
              validQs,
              ROW_SPECS.diligenceQuestion.columns,
            )
          : renderGapLabel("问题组字段无法映射或暂无有效行。");
      return `<div class="oq-group"><h3>${esc(title)}</h3>${body}</div>`;
    })
    .join("");
}

function renderRiskMatrix(rows: RiskRow[]): string {
  const riskCols: (readonly string[])[] = [
    ["level", "severity", "级别"],
    ["risk", "title", "name", "风险"],
    ["cause", "reason", "原因"],
    ["trigger", "condition", "触发"],
    ["impact", "effect", "影响"],
    ["mitigation", "remedy", "缓释"],
    ["owner", "status", "负责人"],
  ];
  const valid = filterValidRowsForColumns(rows as TableRow[], riskCols.slice(0, 5));
  if (!valid.length) return renderGapLabel("风险矩阵：暂无有效风险行。");
  const body = valid
    .map((row) => {
      const r = row as Record<string, unknown> & RiskRow;
      const level = pickRowCell(r, ["level", "severity", "级别"]) || r.level || "";
      const mitigation = [pickRowCell(r, ["mitigation", "remedy"]), r.owner, r.status]
        .filter(Boolean)
        .join(" · ");
      const evidence = renderEvidenceCell(r.evidenceSourceIds);
      return (
        `<tr><td><span class="risk-level ${riskLevelClass(level)}">${esc(level)}</span></td>` +
        `<td>${esc(pickRowCell(r, ["risk", "title", "name"]))}</td>` +
        `<td>${esc(pickRowCell(r, ["cause", "reason"]))}</td>` +
        `<td>${esc(pickRowCell(r, ["trigger", "condition"]))}</td>` +
        `<td>${esc(pickRowCell(r, ["impact", "effect"]))}</td>` +
        `<td>${evidence}</td>` +
        `<td>${esc(mitigation)}</td></tr>`
      );
    })
    .join("");
  return (
    `<table class="risk-matrix-table"><thead><tr><th>级别</th><th>风险</th><th>原因</th>` +
    `<th>触发条件</th><th>影响</th><th>证据</th><th>缓释/负责人/状态</th></tr></thead><tbody>${body}</tbody></table>`
  );
}

export function renderSlotPayloadByCanonicalSlot(
  slot: CanonicalKbSlot,
  payload: StructuredSlotPatchAny["payload"],
): string {
  const { payload: adapted } = normalizeSlotPayload(slot, payload);
  switch (slot) {
    case "snapshot": {
      const p = adapted as SnapshotPayload;
      const facts =
        p.keyFacts ??
        [
          p.stage ? { 项目项: "当前阶段", 内容: p.stage, 证据: "" } : null,
          p.status ? { 项目项: "状态", 内容: p.status, 证据: "" } : null,
        ].filter(Boolean) as TableRow[];
      const table = renderTable(
        ["项目项", "内容", "证据/来源"],
        facts,
        ROW_SPECS.keyFacts.columns,
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
      const p = adapted as TargetOverviewPayload;
      return (
        renderNarratives(p.businessSummary) +
        renderTableOrGap(
          "资产构成",
          ["资产/权利/能力", "定义与范围", "可投资性", "关键证据/缺口"],
          p.assetSummary,
          "assetSummary",
        ) +
        renderTableOrGap(
          "交易要素",
          ["交易要素", "内容", "证据/缺口"],
          p.transactionSummary,
          "transactionSummary",
        ) +
        renderTableOrGap(
          "关键主张",
          ["关键主张", "依据", "缺口"],
          p.keyClaims,
          "keyClaims",
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "industry-market": {
      const p = adapted as IndustryMarketPayload;
      return (
        renderTableOrGap(
          "市场驱动",
          ["主题", "事实/数据", "投资含义", "来源"],
          p.marketDrivers ?? p.marketSize,
          "marketDrivers",
        ) +
        renderTableOrGap(
          "价值链",
          ["价值链环节", "描述", "壁垒/机会"],
          p.valueChain,
          "valueChain",
        ) +
        renderTableOrGap(
          "政策/监管",
          ["政策/监管", "要点", "影响"],
          p.policyContext,
          "policyContext",
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "business-operations": {
      const p = adapted as BusinessOperationsPayload;
      const journey = renderJourneyMap(p.journeyMap ?? p.journey);
      const processFlow = renderProcessFlow(p.processFlow);
      const bmc = renderBmc(p.canvas);
      const revenuePrimary = p.revenueTree?.length
        ? renderTable(
            ["收入层级", "驱动", "假设", "证据"],
            p.revenueTree,
            ROW_SPECS.revenueTree.columns,
          )
        : "";
      const flywheel = renderFlywheelBlock(p.flywheel);
      const ecosystem = p.ecosystemMap?.length
        ? renderTable(
            ["节点", "关系", "价值流"],
            p.ecosystemMap,
            [
              ["node", "party", "节点"],
              ["relationship", "关系"],
              ["valueFlow", "价值流"],
            ],
          )
        : "";
      const primary =
        journey ||
        processFlow ||
        bmc ||
        revenuePrimary ||
        flywheel ||
        ecosystem ||
        renderGapLabel("该板块暂无足够可核实资料。请补充项目方文件、交易资料或独立来源。");
      return (
        primary +
        renderTableOrGap(
          "收入树 / 运营验证",
          ["应用/产品场景", "价值主张", "证据/缺口"],
          p.revenueTree ?? p.valueChain,
          "revenueTree",
        ) +
        renderTableOrGap(
          "客户/付费方",
          ["客户/受众/付费方", "需求", "获客/渠道", "验证状态"],
          p.customerBuyer,
          "customerBuyer",
        ) +
        renderTableOrGap(
          "定价与单位经济",
          ["产品", "价格区间", "对比基准", "溢价逻辑"],
          p.pricing,
          "pricing",
        ) +
        renderTableOrGap(
          "运营瓶颈/供应链",
          ["瓶颈", "影响", "缓释"],
          p.operatingBottlenecks ?? p.supplyChain,
          "operatingBottlenecks",
        ) +
        renderTableOrGap(
          "待验证假设",
          ["待验证假设", "为什么关键", "验证方式"],
          p.operationalGaps,
          "operationalGaps",
        ) +
        renderGapCallouts(p.gaps)
      );
    }
    case "legal-ownership": {
      const p = adapted as LegalOwnershipPayload;
      const factOk = legalFactSufficient(p);
      const gapRows = collectLegalGapRows(p);
      let out = renderTableOrGap(
        "法律主体",
        ["主体/权利", "角色/归属", "限制/负担", "证据/缺口"],
        p.entities ?? p.ownershipClaims,
        "entities",
      );
      if (factOk) {
        out += renderTableOrGap(
          "合同权利",
          ["合同类型", "对手方", "关键条款", "缺口"],
          p.contractRights,
          "contractRights",
        );
        out += renderRelationshipTable(p.relationshipEdges);
      }
      if (gapRows.length > 0 || !factOk) {
        out += renderStructuredGapTable(
          "法律缺口 / 权属待确认",
          ["待确认事项", "为何重要", "所需证据", "责任方", "决策影响", "风险级别"],
          gapRows,
          "legalGapRows",
        );
      }
      if (!factOk && gapRows.length === 0) {
        out += renderGapCallouts(p.unresolvedLegalIssues as GapCallout[] | undefined);
      }
      return out;
    }
    case "regulatory-compliance": {
      const p = adapted as RegulatoryCompliancePayload;
      const factOk = regulatoryFactSufficient(p);
      const gapRows = collectRegulatoryGapRows(p);
      let out = "";
      if (factOk) {
        out += renderTableOrGap(
          "监管合规",
          ["监管/规则", "适用原因", "状态/许可", "红线/下一步"],
          p.jurisdictionRows ?? p.complianceRisks,
          "jurisdictionRows",
        );
        out += renderTableOrGap(
          "许可要求",
          ["许可", "发证机关", "状态", "缺口"],
          p.licenseRequirements,
          "licenseRequirements",
        );
      }
      if (gapRows.length > 0 || !factOk) {
        out += renderStructuredGapTable(
          "监管缺口 / 验证路径",
          ["辖区", "监管要求", "现有证据", "缺口", "下一步", "风险级别"],
          gapRows,
          "regulatoryGapRows",
        );
      } else if (factOk) {
        out += renderTableOrGap(
          "审批路径",
          ["审批路径", "步骤", "时间"],
          p.approvalPath,
          "approvalPath",
        );
      }
      if (!factOk && gapRows.length === 0) {
        out += renderGapCallouts(p.gaps as GapCallout[] | undefined);
      }
      return out;
    }
    case "resource-network": {
      const p = adapted as ResourceNetworkPayload;
      const parties = splitFactAndGapRows(p.parties ?? p.resources, "parties");
      const capabilities = splitFactAndGapRows(p.capabilities, "capabilities");
      const edges = splitFactAndGapRows(
        (p.relationshipEdges ?? []) as unknown as TableRow[],
        "relationshipEdges",
      );
      let out = "";
      if (parties.factRows.length) {
        out += `<h3>已确认主体/资源</h3>${renderTable(
          ["主体/资源", "关系与作用", "强度/可验证性", "依赖与风险"],
          parties.factRows as TableRow[],
          ROW_SPECS.parties.columns,
        )}`;
      }
      if (capabilities.factRows.length) {
        out += `<h3>已确认能力</h3>${renderTable(
          ["能力", "来源", "缺口"],
          capabilities.factRows as TableRow[],
          ROW_SPECS.capabilities.columns,
        )}`;
      }
      if (edges.factRows.length) {
        out += `<h3>已确认关系边</h3>${renderTable(
          ["关系/合作", "从", "到", "状态", "风险"],
          edges.factRows as TableRow[],
          ROW_SPECS.relationshipEdges.columns,
        )}`;
      }
      const resourceGapRows = [
        ...(parties.gapRows as TableRow[]),
        ...(capabilities.gapRows as TableRow[]),
        ...(edges.gapRows as TableRow[]),
        ...filterValidRowsForColumns(p.resourceGaps, ROW_SPECS.resourceGaps.columns),
        ...filterValidRowsForColumns(p.missingParties as TableRow[] | undefined, ROW_SPECS.resourceGaps.columns),
        ...filterValidRowsForColumns(p.capabilityGaps, ROW_SPECS.capabilityGaps.columns),
        ...filterValidRowsForColumns(p.relationshipGaps, ROW_SPECS.relationshipGaps.columns),
      ];
      if (resourceGapRows.length) {
        out += renderStructuredGapTable(
          "资源网络缺口 / 待验证",
          ["主体", "角色", "证据", "依赖", "缺口", "下一步"],
          resourceGapRows,
          "resourceGaps",
        );
      }
      if (!out) {
        out += renderGapLabel("资源网络：资料不足，待补 confirmed rows 或 resourceGaps。");
      }
      return out + renderGapCallouts(p.missingResources as GapCallout[] | undefined);
    }
    case "comps-benchmark": {
      const p = adapted as CompsBenchmarkPayload;
      const comps = splitFactAndGapRows(p.compsRows, "compsRows");
      let out = "";
      if (comps.factRows.length) {
        out += `<h3>已确认可比</h3>${renderTable(
          ["可比对象", "可比逻辑", "指标/倍数", "可借鉴/差异"],
          comps.factRows as TableRow[],
          ROW_SPECS.compsRows.columns,
        )}`;
      }
      const compGapRows = [
        ...(comps.gapRows as TableRow[]),
        ...filterValidRowsForColumns(p.comparableGaps, ROW_SPECS.comparableGaps.columns),
      ];
      if (compGapRows.length) {
        out += renderStructuredGapTable(
          "可比缺口 / 待验证",
          ["缺口", "原因", "所需资料", "对估值启示", "下一步"],
          compGapRows,
          "comparableGaps",
        );
      }
      if (p.transactionCasesNote?.trim()) {
        out += `<aside class="callout warning"><div class="callout-title">交易案例说明</div><p>${esc(p.transactionCasesNote.trim())}</p></aside>`;
      }
      const cases = filterValidRowsForColumns(p.transactionCases, ROW_SPECS.transactionCases.columns);
      if (cases.length) {
        out += renderTable(
          ["交易案例", "条款", "启示"],
          cases,
          ROW_SPECS.transactionCases.columns,
        );
      }
      if (!out) {
        out += renderGapLabel("市场对标：无真实可比时请写 comparableGaps + transactionCasesNote。");
      }
      return out + renderGapCallouts(p.relevanceNotes as GapCallout[] | undefined);
    }
    case "valuation-returns": {
      const p = adapted as ValuationReturnsPayload;
      const metrics: MetricCard[] =
        p.benchmarkMetrics?.map((r) => ({
          label: r["指标"] ?? r.label ?? "",
          value: r["数值"] ?? r.value ?? "",
          note: r["说明"] ?? r.note,
        })) ?? [];
      const cashflow = splitFactAndGapRows(p.investmentCashflow, "investmentCashflow");
      let out = renderMetricCards(metrics) + renderScenarioCards(p.scenarios);
      if (cashflow.factRows.length) {
        out += `<h3>投资现金流（已确认）</h3>${renderTable(
          ["资金用途", "金额/比例", "说明"],
          cashflow.factRows as TableRow[],
          ROW_SPECS.investmentCashflow.columns,
        )}`;
      }
      const cashflowGapRows = [
        ...(cashflow.gapRows as TableRow[]),
        ...filterValidRowsForColumns(p.cashflowGaps, ROW_SPECS.cashflowGaps.columns),
      ];
      if (cashflowGapRows.length) {
        out += renderStructuredGapTable(
          "现金流缺口 / 待建模",
          ["缺口", "原因", "所需资料", "下一步", "对回报影响"],
          cashflowGapRows,
          "cashflowGaps",
        );
      }
      out += renderTableOrGap(
        "建模假设",
        ["假设", "Base", "Upside", "Downside", "证据"],
        p.returnDrivers ?? p.assumptions,
        "sensitivityItems",
      );
      out += renderTableOrGap(
        "敏感性分析",
        ["敏感变量", "影响方向", "阈值/区间", "观察方式"],
        p.sensitivityItems,
        "sensitivityItems",
      );
      if (!cashflow.factRows.length && !cashflowGapRows.length) {
        out += renderGapLabel("投资回报：缺投资额/估值/股权比例时不得写 IRR/MOIC，请补 cashflowGaps。");
      }
      return out + renderGapCallouts(p.gaps);
    }
    case "diligence-gaps": {
      const p = adapted as DiligenceGapsPayload;
      return renderQuestionGroups(p.questionGroups);
    }
    case "risks-mitigation": {
      const p = adapted as RisksMitigationPayload;
      return (
        renderRiskMatrix(p.riskRows) +
        renderTableOrGap(
          "停推条件",
          ["停推条件", "触发动作", "Owner"],
          p.stopConditions,
          "stopConditions",
        )
      );
    }
    case "timeline-milestones": {
      const p = adapted as TimelineMilestonesPayload;
      const occurred = p.occurred ?? [];
      const inProgress = p.inProgress ?? [];
      const future = p.future ?? [];
      const hasAny = occurred.length + inProgress.length + future.length > 0;
      const sub =
        `<p class="section-sub">PROJECT TIMELINE · 仅记录项目自身节点，不放行业动向、市场趋势或研究动作</p>`;
      if (!hasAny) {
        return (
          sub +
          `<h3>8.1 已发生关键事件</h3>` +
          renderGapCallouts(
            p.gaps ?? [{ text: "暂无已记录的项目级时间节点。", confidence: "gap" }],
          ) +
          `<h3>8.2 正在推进</h3>` +
          renderGapLabel("暂无正在推进的项目级节点。") +
          `<h3>8.3 未来关键节点</h3>` +
          renderGapLabel("暂无未来项目级关键节点。")
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
      const p = adapted as DecisionFrameworkPayload;
      const rec = p.recommendation
        ? `<aside class="callout info"><div class="callout-title">条件式建议</div><p>${esc(p.recommendation)}</p></aside>`
        : renderGapLabel("决策建议：缺少 recommendation。");
      return (
        rec +
        renderTableOrGap(
          "Go/No-Go 条件",
          ["条件", "否则"],
          p.goNoGoConditions,
          "goNoGoConditions",
        ) +
        renderTableOrGap(
          "决策选项",
          ["选项", "好处", "代价/风险", "适用条件"],
          p.decisionTable,
          "decisionTable",
        ) +
        renderTableOrGap(
          "下一步行动",
          ["下一步", "Owner", "时间", "交付物"],
          p.nextActions,
          "nextActions",
        ) +
        renderTableOrGap(
          "触发器",
          ["触发器", "条件", "动作"],
          p.triggers,
          "triggers",
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
