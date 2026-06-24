import type { StructuredKbData } from "./knowledge-network-structured-kb-data-types";
import { countEmptyHtmlRows } from "./knowledge-network-content-row-quality";
import {
  buildSlotMaturitySummaryRows,
  type SlotContentMode,
} from "./knowledge-network-slot-maturity-summary";
import {
  CANONICAL_KB_SLOTS,
  KB_APPENDIX_SLOTS,
  LEGACY_V28_ANCHORS,
} from "./knowledge-network-html-validation";

/** Codex v2.93 render_kb_html.py + kb-schema 交付物 parity 检查项 */
export const CODEX_SLOT_COMPONENT_MARKERS: Record<
  (typeof CANONICAL_KB_SLOTS)[number],
  readonly RegExp[]
> = {
  snapshot: [/callout info|<table|项目项/i],
  "target-overview": [/<table/i, /资产|标的/i],
  "industry-market": [/<table/i, /主题|事实/i],
  "business-operations": [/journey-wrap|process-flow|class="bmc"|revenueTree|收入树/i, /<table/i],
  "legal-ownership": [/<table/i, /法律|权属|缺口/i],
  "regulatory-compliance": [/<table/i, /监管|缺口/i],
  "resource-network": [/<table/i, /资源|缺口/i],
  "comps-benchmark": [/<table|callout|可比|缺口/i],
  "valuation-returns": [/scenario-cards|valuation-box|valuation-grid/i, /敏感|现金流|缺口/i],
  "diligence-gaps": [/oq-group|topic-body/i, /问题|尽调/i],
  "risks-mitigation": [/risk-matrix-table/i],
  "timeline-milestones": [/PROJECT TIMELINE/i, /8\.1 已发生关键事件|暂无已记录的项目级|缺乏资料/i],
  "decision-framework": [/callout info|决策|下一步/i, /<table/i],
};

export const CODEX_MATURITY_LABELS = {
  factorA: /Factor A · Evidence Maturity/i,
  factorB: /Factor B · Source Diversity/i,
  combined: /Combined Maturity/i,
} as const;

export type CodexParityViolation = {
  code: string;
  message: string;
  slot?: string;
};

export type CodexParityReport = {
  ok: boolean;
  violations: CodexParityViolation[];
  checks: Record<string, boolean>;
};

export type CodexParitySlotContentStatus = {
  mode: "evidence-backed" | "gap-first" | "stub";
  evidenceScore: number;
  capReason?: string;
  htmlPresent: boolean;
  markersPresent: boolean;
};

export type CodexParityAuditJson = {
  auditedAt: string;
  ok: boolean;
  slotsPresent: { count: number; required: number; allPresent: boolean; slots: Record<string, boolean> };
  appendicesPresent: { allPresent: boolean; items: Record<string, boolean> };
  maturity: {
    factorA: string;
    factorB: string;
    combined: string;
    allPercentages: boolean;
    labelsOk: boolean;
  };
  /** 每 slot 内容状态（structured + HTML marker） */
  slotContentStatus: Record<string, CodexParitySlotContentStatus>;
  brokenCitationCount: number;
  emptyTableRowCount: number;
  legacyV28AnchorCount: number;
  legacyV28Anchors: string[];
  codexMarkers: Record<
    | "business-operations"
    | "valuation-returns"
    | "diligence-gaps"
    | "risks-mitigation"
    | "timeline-milestones",
    { present: boolean; patterns: string[] }
  >;
  violations: CodexParityViolation[];
};

const KEY_SLOT_MARKERS = [
  "business-operations",
  "valuation-returns",
  "diligence-gaps",
  "risks-mitigation",
  "timeline-milestones",
] as const;

function sectionHtml(html: string, id: string): string {
  return (
    html.match(new RegExp(`<section[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, "i"))?.[0] ??
    ""
  );
}

function extractMaturityValues(html: string): { factorA: string; factorB: string; combined: string } {
  const pick = (cls: string) =>
    html
      .match(
        new RegExp(`stat-item-${cls}[\\s\\S]*?class=["']stat-value["'][^>]*>([^<]+)`, "i"),
      )?.[1]
      ?.trim() ?? "—";
  return { factorA: pick("a"), factorB: pick("b"), combined: pick("c") };
}

function isPercentageStat(v: string): boolean {
  const t = v.trim();
  return t === "—" || /^\d{1,3}%$/.test(t);
}

function brokenCitations(html: string): string[] {
  const citeRefs = [...html.matchAll(/href=["']#(source-[^"']+)["']/gi)].map((m) => m[1]!);
  const appendixIds = new Set(
    [...html.matchAll(/id=["'](source-[^"']+)["']/gi)].map((m) => m[1]!),
  );
  return [...new Set(citeRefs)].filter((id) => !appendixIds.has(id));
}

function countLegacyV28Anchors(html: string): string[] {
  const hits: string[] = [];
  for (const anchor of LEGACY_V28_ANCHORS) {
    if (new RegExp(`\\bid=["']${anchor}["']`, "i").test(html)) hits.push(anchor);
  }
  return hits;
}

function slotMarkerStatus(
  slot: (typeof KEY_SLOT_MARKERS)[number],
  sec: string,
): { present: boolean; patterns: string[] } {
  const patterns = CODEX_SLOT_COMPONENT_MARKERS[slot].map((re) => String(re));
  const present = CODEX_SLOT_COMPONENT_MARKERS[slot].every((re) => re.test(sec));
  return { present, patterns };
}

/** 生成用户-facing Codex parity audit JSON */
export function buildCodexParityAuditJson(
  html: string,
  auditedAt = new Date().toISOString(),
  structuredData?: StructuredKbData,
): CodexParityAuditJson {
  const report = auditCodexParity(html);
  const maturity = extractMaturityValues(html);
  const broken = brokenCitations(html);
  const legacyHits = countLegacyV28Anchors(html);

  const slots: Record<string, boolean> = {};
  for (const slot of CANONICAL_KB_SLOTS) {
    slots[slot] = sectionHtml(html, slot).length > 0;
  }

  const maturityRows = structuredData ? buildSlotMaturitySummaryRows(structuredData) : [];
  const slotContentStatus: Record<string, CodexParitySlotContentStatus> = {};
  for (const slot of CANONICAL_KB_SLOTS) {
    const sec = sectionHtml(html, slot);
    const row = maturityRows.find((r) => r.slot === slot);
    const markersPresent =
      sec.length > 0 &&
      CODEX_SLOT_COMPONENT_MARKERS[slot].every((re) => re.test(sec));
    slotContentStatus[slot] = {
      mode: (row?.mode ?? "stub") as SlotContentMode,
      evidenceScore: row?.evidenceScore ?? 0,
      capReason: row?.capReason,
      htmlPresent: sec.length > 0,
      markersPresent,
    };
  }

  const appendices: Record<string, boolean> = {};
  for (const id of KB_APPENDIX_SLOTS) {
    appendices[id] = sectionHtml(html, id).length > 0;
  }

  const codexMarkers = {} as CodexParityAuditJson["codexMarkers"];
  for (const slot of KEY_SLOT_MARKERS) {
    codexMarkers[slot] = slotMarkerStatus(slot, sectionHtml(html, slot));
  }

  const slotsPresentCount = Object.values(slots).filter(Boolean).length;
  const appendicesAll = Object.values(appendices).every(Boolean);

  return {
    auditedAt,
    ok:
      report.ok &&
      slotsPresentCount === CANONICAL_KB_SLOTS.length &&
      appendicesAll &&
      broken.length === 0 &&
      countEmptyHtmlRows(html) === 0 &&
      legacyHits.length === 0,
    slotsPresent: {
      count: slotsPresentCount,
      required: CANONICAL_KB_SLOTS.length,
      allPresent: slotsPresentCount === CANONICAL_KB_SLOTS.length,
      slots,
    },
    appendicesPresent: {
      allPresent: appendicesAll,
      items: appendices,
    },
    maturity: {
      factorA: maturity.factorA,
      factorB: maturity.factorB,
      combined: maturity.combined,
      allPercentages:
        isPercentageStat(maturity.factorA) &&
        isPercentageStat(maturity.factorB) &&
        isPercentageStat(maturity.combined),
      labelsOk: Boolean(report.checks.maturity_labels),
    },
    slotContentStatus,
    brokenCitationCount: broken.length,
    emptyTableRowCount: countEmptyHtmlRows(html),
    legacyV28AnchorCount: legacyHits.length,
    legacyV28Anchors: legacyHits,
    codexMarkers,
    violations: report.violations,
  };
}

/**
 * 对照 Codex v2.93 最终 HTML 交付物语义做 parity audit（非字节级 diff）。
 */
export function auditCodexParity(html: string): CodexParityReport {
  const violations: CodexParityViolation[] = [];
  const checks: Record<string, boolean> = {};

  checks.schemaVersion = /schema-version:\s*2\.91/i.test(html);
  if (!checks.schemaVersion) {
    violations.push({ code: "schema_version", message: "缺少 KB-CONFIG schema-version: 2.91" });
  }

  checks.kbShell = /class=["']kb-shell["']/i.test(html);
  if (!checks.kbShell) {
    violations.push({ code: "kb_shell", message: "缺少 kb-shell 布局" });
  }

  for (const slot of CANONICAL_KB_SLOTS) {
    const sec = sectionHtml(html, slot);
    const present = sec.length > 0;
    checks[`slot_${slot}`] = present;
    if (!present) {
      violations.push({ code: "missing_slot", message: `缺少 core slot section: ${slot}`, slot });
      continue;
    }
    for (const re of CODEX_SLOT_COMPONENT_MARKERS[slot]) {
      if (!re.test(sec)) {
        violations.push({
          code: "slot_component",
          message: `${slot} 缺少 Codex 组件标记 ${re}`,
          slot,
        });
      }
    }
    const emptyRows = countEmptyHtmlRows(sec);
    checks[`slot_${slot}_no_empty_rows`] = emptyRows === 0;
    if (emptyRows > 0) {
      violations.push({
        code: "empty_table_rows",
        message: `${slot} 含 ${emptyRows} 个全空 table row`,
        slot,
      });
    }
  }

  for (const id of KB_APPENDIX_SLOTS) {
    const present = sectionHtml(html, id).length > 0;
    checks[`appendix_${id}`] = present;
    if (!present) {
      violations.push({ code: "missing_appendix", message: `缺少 appendix: ${id}` });
    }
  }

  const maturity = extractMaturityValues(html);
  checks.maturity_labels =
    CODEX_MATURITY_LABELS.factorA.test(html) &&
    CODEX_MATURITY_LABELS.factorB.test(html) &&
    CODEX_MATURITY_LABELS.combined.test(html);
  if (!checks.maturity_labels) {
    violations.push({ code: "maturity_labels", message: "maturity 区标签与 Codex v2.93 不一致" });
  }

  checks.maturity_percentages =
    isPercentageStat(maturity.factorA) &&
    isPercentageStat(maturity.factorB) &&
    isPercentageStat(maturity.combined);
  if (!checks.maturity_percentages) {
    violations.push({
      code: "maturity_values",
      message: `maturity 主值须为百分比：A=${maturity.factorA} B=${maturity.factorB} C=${maturity.combined}`,
    });
  }

  const broken = brokenCitations(html);
  checks.citations = broken.length === 0;
  if (broken.length) {
    violations.push({
      code: "broken_citations",
      message: `断引用：${broken.slice(0, 5).join(", ")}`,
    });
  }

  checks.missing_callout_capable = /callout missing|资料缺口|缺乏资料|gap-coverage-table/i.test(html);
  if (!checks.missing_callout_capable) {
    violations.push({
      code: "gap_semantics",
      message: "未见 gap/missing callout 或 gap 表语义（缺资料时应显式标注）",
    });
  }

  return { ok: violations.length === 0, violations, checks };
}
