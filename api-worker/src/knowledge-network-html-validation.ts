import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

export type KnHtmlValidationOptions = {
  mode?: KnowledgeNetworkUpdateMode;
  previousHtml?: string | null;
  /** v2.91 strict validation (new writes); disable for legacy preview */
  strict?: boolean;
  touchesTimeline?: boolean;
};

export type KnHtmlValidationResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

const MAX_KN_HTML_BYTES = 2_500_000;
const REORDER_MAX_LENGTH_DRIFT_RATIO = 0.08;
const KB_SCHEMA_VERSION = "2.91";

/** v2.91 core analysis slots (13) */
export const CANONICAL_KB_SLOTS = [
  "snapshot",
  "target-overview",
  "industry-market",
  "business-operations",
  "legal-ownership",
  "regulatory-compliance",
  "resource-network",
  "comps-benchmark",
  "valuation-returns",
  "diligence-gaps",
  "risks-mitigation",
  "timeline-milestones",
  "decision-framework",
] as const;

/** Appendix A–D */
export const KB_APPENDIX_SLOTS = [
  "source-index",
  "glossary",
  "data-dictionary",
  "version-ledger",
] as const;

/** Legacy v2.8 anchors — strict mode rejects */
export const LEGACY_V28_ANCHORS = [
  "assets",
  "legal-relationships",
  "business-model",
  "capital-structure",
  "comps",
  "returns",
  "timeline",
  "risks",
  "open-questions",
] as const;

type CanonicalSlot = (typeof CANONICAL_KB_SLOTS)[number];

const CANONICAL_SLOT_SET = new Set<string>(CANONICAL_KB_SLOTS);
const APPENDIX_SLOT_SET = new Set<string>(KB_APPENDIX_SLOTS);

const ALLOWED_NAV_TARGETS = new Set([
  "overview",
  ...CANONICAL_KB_SLOTS,
  ...KB_APPENDIX_SLOTS,
]);

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

export function detectSuspiciousIndustryTimeline(uncommented: string): string | undefined {
  const sectionMatch = uncommented.match(
    /<section[^>]*\bid=["']timeline-milestones["'][\s\S]*?<\/section>/i,
  );
  if (!sectionMatch) return undefined;
  const section = sectionMatch[0];

  const isStub =
    /暂无.{0,16}项目级|暂无已核实|待项目方|待项目资料|无项目级时间轴/i.test(section) &&
    !/<div class="tl-item"/i.test(section);
  if (isStub) return undefined;

  const hasSubstantiveItems =
    /<div class="tl-item"/i.test(section) ||
    (/<h3[^>]*>8\.3/i.test(section) && (section.match(/<tr\b/gi) ?? []).length > 2);

  if (!hasSubstantiveItems) return undefined;

  const industryPattern =
    /行业(?:趋势|格局|爆发|洗牌)|市场规模|技术趋势|技术跃升|宏观背景|大盘|渗透率|爆款率|算力成本|赛道|全体行业|平台发布|巨头入场|产能爆发|sector\s+trend|market\s+size/gi;
  const projectPattern =
    /项目方|标的|交易对手|卖方|买方|签约|尽调|立项|交割|审批|KYC|投资方|授权协议|本项目|此项目|此标的|资产权属|配额|平台接入|FIRB|hearing|term\s+sheet|LOI|closing|卖方介绍|拟交易/i;

  const industryHits = (section.match(industryPattern) ?? []).length;
  const projectHits = (section.match(projectPattern) ?? []).length;

  if (industryHits >= 2 && projectHits === 0) {
    return "timeline-milestones 疑似填入行业/市场/技术趋势而非项目推进节点；请按 timeline-rules.md eligibility gate 复核";
  }

  if (industryHits >= 3 && projectHits <= 1) {
    return "timeline-milestones 行业/市场信号偏多、项目级节点偏少；请确认每条已过 eligibility gate";
  }

  return undefined;
}

function normalizeReorderBody(html: string): string {
  let t = html;
  t = t.replace(/<!--\s*KB-CONFIG[\s\S]*?-->/gi, "");
  t = t.replace(/<nav class="kb-nav"[\s\S]*?<\/nav>/gi, "");
  t = t.replace(/<span class="section-num">[\s\S]*?<\/span>/gi, "");
  t = t.replace(/<span class="kb-nav-num">[\s\S]*?<\/span>/gi, "");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

export function parseKbConfigDisplayOrder(html: string): string[] {
  const configMatch = html.match(/<!--\s*KB-CONFIG([\s\S]*?)-->/i);
  if (!configMatch) return [];
  const line = configMatch[1].match(/^\s*display-order:\s*(.+)$/im);
  if (!line) return [];
  return line[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseKbConfigSchemaVersion(html: string): string | null {
  const configMatch = html.match(/<!--\s*KB-CONFIG([\s\S]*?)-->/i);
  if (!configMatch) return null;
  const line = configMatch[1].match(/^\s*schema-version:\s*(\S+)/im);
  return line?.[1] ?? null;
}

function extractNavTargets(uncommented: string): string[] {
  const navMatch = uncommented.match(/<nav\s+class=["']kb-nav["'][\s\S]*?<\/nav>/i);
  if (!navMatch) return [];
  return [...navMatch[0].matchAll(/data-target=["']([^"']+)["']/gi)].map((m) => m[1]);
}

function presentCanonicalSlotIds(uncommented: string): CanonicalSlot[] {
  return CANONICAL_KB_SLOTS.filter((key) =>
    new RegExp(`\\bid=["']${key}["']`, "i").test(uncommented),
  );
}

function requiresFullV291Structure(mode: KnowledgeNetworkUpdateMode | undefined): boolean {
  return mode === "initial" || mode === "full" || mode === "incremental";
}

function validateBasicStructure(t: string): KnHtmlValidationResult | null {
  if (t.length < 200) {
    return { ok: false, error: "HTML 过短（少于 200 字符）" };
  }
  if (t.length > MAX_KN_HTML_BYTES) {
    return { ok: false, error: "HTML 超过 2.5MB 上限" };
  }
  if (!/<!DOCTYPE\s+html/i.test(t) && !/<html[\s>]/i.test(t)) {
    return { ok: false, error: "须为完整 HTML（含 <!DOCTYPE html> 或 <html>）" };
  }
  if (!/kb-shell/i.test(t)) {
    return { ok: false, error: "缺少 kb-shell 容器（非知识网络单页）" };
  }
  if (!/<!--\s*KB-CONFIG/i.test(t)) {
    return {
      ok: false,
      error: "缺少 <!-- KB-CONFIG --> 块（v2.91 必填：schema-version、display-order 等）",
    };
  }
  const schemaVersion = parseKbConfigSchemaVersion(t);
  if (!schemaVersion) {
    return {
      ok: false,
      error: `KB-CONFIG 缺少 schema-version: ${KB_SCHEMA_VERSION}`,
    };
  }
  if (schemaVersion !== KB_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `KB-CONFIG schema-version 须为 ${KB_SCHEMA_VERSION}，当前为 ${schemaVersion}`,
    };
  }
  return null;
}

function validateLegacyV28Anchors(uncommented: string): KnHtmlValidationResult | null {
  const hits: string[] = [];
  for (const key of LEGACY_V28_ANCHORS) {
    if (
      new RegExp(`(?:id|data-target)=["']${key}["']`, "i").test(uncommented)
    ) {
      hits.push(key);
    }
  }
  if (hits.length > 0) {
    return {
      ok: false,
      error: `legacy v2.8 anchors present: ${hits.join(", ")} — rebuild to v2.91 13-slot schema`,
    };
  }
  return null;
}

function validateConfigNavSectionAlignment(
  uncommented: string,
  displayOrder: string[],
): KnHtmlValidationResult | null {
  if (displayOrder.length === 0) {
    return { ok: false, error: "KB-CONFIG 缺少 display-order" };
  }

  const unknownInConfig = displayOrder.filter((s) => !CANONICAL_SLOT_SET.has(s));
  if (unknownInConfig.length > 0) {
    return {
      ok: false,
      error: `KB-CONFIG display-order 含未知 slot：${unknownInConfig.join(", ")}`,
    };
  }

  const dupConfig = displayOrder.filter((x, i) => displayOrder.indexOf(x) !== i);
  if (dupConfig.length > 0) {
    return {
      ok: false,
      error: `KB-CONFIG display-order 重复：${[...new Set(dupConfig)].join(", ")}`,
    };
  }

  const missingInConfig = CANONICAL_KB_SLOTS.filter((s) => !displayOrder.includes(s));
  if (displayOrder.length !== CANONICAL_KB_SLOTS.length || missingInConfig.length > 0) {
    return {
      ok: false,
      error: `缺少 canonical slot: ${missingInConfig.join(", ")}`,
    };
  }

  const sectionIds = presentCanonicalSlotIds(uncommented);
  const missingSections = CANONICAL_KB_SLOTS.filter((s) => !sectionIds.includes(s));
  if (missingSections.length > 0) {
    return {
      ok: false,
      error: `缺少 canonical slot: ${missingSections.join(", ")}`,
    };
  }

  const navTargets = extractNavTargets(uncommented);
  const navCanonical = navTargets.filter((target) => CANONICAL_SLOT_SET.has(target));
  const missingInNav = CANONICAL_KB_SLOTS.filter((s) => !navCanonical.includes(s));
  if (missingInNav.length > 0) {
    return {
      ok: false,
      error: `nav 与 KB-CONFIG 不一致：缺少 ${missingInNav.join(", ")}`,
    };
  }

  const orderMismatch =
    displayOrder.length !== navCanonical.length ||
    displayOrder.some((slot, i) => navCanonical[i] !== slot);
  if (orderMismatch) {
    return {
      ok: false,
      error: `nav 与 KB-CONFIG 不一致：期望 ${displayOrder.join(", ")}，nav 为 ${navCanonical.join(", ")}`,
    };
  }

  return null;
}

function validateAppendices(
  uncommented: string,
  navTargets: string[],
): KnHtmlValidationResult | null {
  for (const appendix of KB_APPENDIX_SLOTS) {
    if (!new RegExp(`\\bid=["']${appendix}["']`, "i").test(uncommented)) {
      return { ok: false, error: `缺少 appendix section: ${appendix}` };
    }
    if (!navTargets.includes(appendix)) {
      return { ok: false, error: `缺少 appendix nav target: ${appendix}` };
    }
  }
  return null;
}

const MATURITY_SCORECARD_ERROR =
  "Maturity scorecard main values must be percentages; move counts/letter grades to notes.";

const MATURITY_PERCENT_RE = /^(100|[1-9]?\d(?:\.\d{1,2})?)%$/;
const MATURITY_MISSING_RE = /^[—–\-]$/u;

export function extractMaturityStatValues(uncommented: string): string[] | null {
  const values: string[] = [];
  for (const cls of ["stat-item-a", "stat-item-b", "stat-item-c"] as const) {
    const m = uncommented.match(
      new RegExp(
        `class=["'][^"']*${cls}[^"']*["'][\\s\\S]*?<div class="stat-value">([^<]*)</div>`,
        "i",
      ),
    );
    if (!m) return null;
    values.push(m[1].trim());
  }
  return values;
}

export function isValidMaturityStatValue(value: string): boolean {
  if (MATURITY_MISSING_RE.test(value)) return true;
  if (!MATURITY_PERCENT_RE.test(value)) return false;
  const n = Number.parseFloat(value.replace("%", ""));
  return n >= 0 && n <= 100;
}

export function validateMaturityScorecard(
  uncommented: string,
): KnHtmlValidationResult | null {
  const values = extractMaturityStatValues(uncommented);
  if (!values) {
    return {
      ok: false,
      error: `${MATURITY_SCORECARD_ERROR} (missing stat-row or stat-item-a/b/c)`,
    };
  }
  for (const v of values) {
    if (!isValidMaturityStatValue(v)) {
      return { ok: false, error: MATURITY_SCORECARD_ERROR };
    }
  }
  return null;
}

function validateCitationsAndRevealAnchor(
  t: string,
  uncommented: string,
  requireRevealAnchor: boolean,
): KnHtmlValidationResult | null {
  const citationTargets = [
    ...uncommented.matchAll(/href=["']#(source-(?:U|A)-\d+)["']/gi),
  ].map((m) => m[1]);
  const sourceIds = new Set(
    [...uncommented.matchAll(/id=["'](source-(?:U|A)-\d+)["']/gi)].map((m) => m[1]),
  );
  const missingSources = [...new Set(citationTargets)].filter((id) => !sourceIds.has(id));
  if (missingSources.length > 0) {
    return {
      ok: false,
      error: `citation 没有对应 source anchor：${missingSources.join(", ")}`,
    };
  }

  const hasRevealAnchor = /function\s+revealAnchor|revealAnchor\s*\(/i.test(t);
  if (citationTargets.length > 0 && !hasRevealAnchor) {
    return { ok: false, error: "缺少 revealAnchor" };
  }
  if (requireRevealAnchor && !hasRevealAnchor) {
    return { ok: false, error: "缺少 revealAnchor" };
  }

  return null;
}

function validateStrictV291(t: string, options: KnHtmlValidationOptions): KnHtmlValidationResult {
  if (/\{\{[A-Z0-9_]+\}\}/.test(t)) {
    return { ok: false, error: "存在未替换的模板占位符 {{…}}" };
  }

  const uncommented = stripHtmlComments(t);
  const mode = options.mode;
  const displayOrder = parseKbConfigDisplayOrder(t);
  const navTargets = extractNavTargets(uncommented);

  for (const target of navTargets) {
    if (!ALLOWED_NAV_TARGETS.has(target)) {
      return { ok: false, error: `未知 nav target：${target}` };
    }
  }

  const dupNav = navTargets.filter((x, i) => navTargets.indexOf(x) !== i);
  if (dupNav.length > 0) {
    return { ok: false, error: `导航 data-target 重复：${[...new Set(dupNav)].join(", ")}` };
  }

  const legacy = validateLegacyV28Anchors(uncommented);
  if (legacy) return legacy;

  if (mode === "reorder") {
    if (options.previousHtml) {
      const prev = options.previousHtml.trim();
      if (prev.length > 0) {
        const drift = Math.abs(t.length - prev.length) / prev.length;
        if (drift > REORDER_MAX_LENGTH_DRIFT_RATIO) {
          return {
            ok: false,
            error: `重排模式下 HTML 体积变化 ${(drift * 100).toFixed(1)}%，疑似改写了内容面板（仅允许 KB-CONFIG/nav/编号）`,
          };
        }
        const prevBody = normalizeReorderBody(prev);
        const nextBody = normalizeReorderBody(t);
        if (prevBody !== nextBody) {
          return {
            ok: false,
            error: "重排模式下内容面板有变更（除 KB-CONFIG、nav、章节编号外须字节级不变）",
          };
        }
      }
    }
    const alignment = validateConfigNavSectionAlignment(uncommented, displayOrder);
    if (alignment) return alignment;

    const appendices = validateAppendices(uncommented, navTargets);
    if (appendices) return appendices;

    const citations = validateCitationsAndRevealAnchor(t, uncommented, false);
    if (citations) return citations;
  } else if (requiresFullV291Structure(mode)) {
    const alignment = validateConfigNavSectionAlignment(uncommented, displayOrder);
    if (alignment) return alignment;

    const appendices = validateAppendices(uncommented, navTargets);
    if (appendices) return appendices;

    const citations = validateCitationsAndRevealAnchor(t, uncommented, true);
    if (citations) return citations;
  } else {
    const anchors = presentCanonicalSlotIds(uncommented);
    if (anchors.length === 0) {
      return { ok: false, error: "缺少 canonical slot 锚点（如 id=\"snapshot\"）" };
    }
  }

  const activePanels = uncommented.match(/class=["'][^"']*kb-panel[^"']*active/gi) ?? [];
  if (activePanels.length !== 1) {
    return {
      ok: false,
      error: `须恰好一个 active kb-panel，当前 ${activePanels.length} 个`,
    };
  }

  if (
    options.touchesTimeline ||
    (mode !== "reorder" && /id=["']timeline-milestones["']/i.test(uncommented))
  ) {
    const warnings: string[] = [];
    const hasTimelineStructure =
      /8\.1\s*已发生|已发生关键事件/.test(uncommented) &&
      (/8\.2\s*正在推进|正在推进|当前正在推进/.test(uncommented)) &&
      (/8\.3\s*未来关键节点|未来关键节点/.test(uncommented));
    if (
      !hasTimelineStructure &&
      mode !== "reorder" &&
      /id=["']timeline-milestones["']/i.test(uncommented)
    ) {
      warnings.push(
        "timeline-milestones 存在但未检测到三区块结构（8.1 已发生 / 8.2 正在推进 / 8.3 未来关键节点）",
      );
    }
    const industryWarn = detectSuspiciousIndustryTimeline(uncommented);
    if (industryWarn) warnings.push(industryWarn);
    if (warnings.length > 0) {
      return { ok: true, warning: warnings.join("；") };
    }
  }

  if (mode !== "reorder") {
    const maturity = validateMaturityScorecard(uncommented);
    if (maturity) return maturity;
  }

  return { ok: true };
}

export function validateKnowledgeNetworkHtml(
  html: string,
  options?: KnHtmlValidationOptions,
): KnHtmlValidationResult {
  const t = html.trim();
  const basic = validateBasicStructure(t);
  if (basic) return basic;

  const mode = options?.mode;
  const strict = options?.strict !== false;

  if (mode === "reorder") {
    return validateStrictV291(t, { ...options, strict: true, mode: "reorder" });
  }

  if (!strict) {
    return { ok: true };
  }

  return validateStrictV291(t, { ...options, strict: true });
}

/** 供本地/CI 验收 v2.91 样例 */
export function validateSampleOutputChecks(html: string): {
  ok: boolean;
  checks: Record<string, boolean>;
  errors: string[];
} {
  const t = html.trim();
  const uncommented = stripHtmlComments(t);
  const checks: Record<string, boolean> = {
    hasKbShell: /kb-shell/i.test(t),
    hasKbConfig: /<!--\s*KB-CONFIG/i.test(t),
    schemaVersion291: /schema-version:\s*2\.91/i.test(t),
    hasRevealAnchor: /revealAnchor/i.test(t),
    hasSourceIndex: /\bid=["']source-index["']/i.test(uncommented),
    hasDataDictionary: /\bid=["']data-dictionary["']/i.test(uncommented),
    hasVersionLedger: /\bid=["']version-ledger["']/i.test(uncommented),
    citationU1: /href=["']#source-U-1["']/i.test(uncommented),
    appendixU1: /id=["']source-U-1["']/i.test(uncommented),
  };
  for (const slot of CANONICAL_KB_SLOTS) {
    checks[`slot_${slot}`] = new RegExp(`id=["']${slot}["']`, "i").test(uncommented);
  }
  for (const slot of KB_APPENDIX_SLOTS) {
    checks[`appendix_${slot}`] = new RegExp(`id=["']${slot}["']`, "i").test(uncommented);
  }
  const result = validateKnowledgeNetworkHtml(html, { strict: true, mode: "initial" });
  const errors: string[] = [];
  if (!result.ok && result.error) errors.push(result.error);
  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`check failed: ${k}`);
  }
  return { ok: errors.length === 0, checks, errors };
}

/** 测试用：从 v2.91 样例裁掉 slot，模拟不完整 HTML */
export function buildLegacySlotInvalidFixture(v291Html: string): string {
  let t = v291Html;
  const removed = [
    "regulatory-compliance",
    "comps-benchmark",
    "timeline-milestones",
  ] as const;
  for (const slot of removed) {
    t = t.replace(
      new RegExp(`<li><button[^>]*data-target="${slot}"[\\s\\S]*?</li>\\s*`, "gi"),
      "",
    );
    t = t.replace(
      new RegExp(`<section[^>]*\\bid=["']${slot}["'][\\s\\S]*?</section>\\s*`, "gi"),
      "",
    );
  }
  return t.replace(
    /display-order:\s*[^\n\r]+/i,
    "display-order: snapshot, target-overview, industry-market, business-operations, legal-ownership, resource-network, valuation-returns, diligence-gaps, risks-mitigation, decision-framework",
  );
}
