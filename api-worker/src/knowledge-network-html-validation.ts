import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

export type KnHtmlValidationOptions = {
  mode?: KnowledgeNetworkUpdateMode;
  previousHtml?: string | null;
  /** v2.8 严格校验（新写入/覆盖）；预览路径勿启用 */
  strict?: boolean;
  /** 任务涉及 timeline slot 时加强 timeline 结构提示 */
  touchesTimeline?: boolean;
};

export type KnHtmlValidationResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

const MAX_KN_HTML_BYTES = 2_500_000;

const REORDER_MAX_LENGTH_DRIFT_RATIO = 0.08;

export const CANONICAL_KB_SLOTS = [
  "snapshot",
  "assets",
  "legal-relationships",
  "business-model",
  "capital-structure",
  "comps",
  "returns",
  "timeline",
  "risks",
  "open-questions",
  "decision-framework",
] as const;

type CanonicalSlot = (typeof CANONICAL_KB_SLOTS)[number];

const CANONICAL_SLOT_SET = new Set<string>(CANONICAL_KB_SLOTS);

const ALLOWED_NAV_TARGETS = new Set([
  "overview",
  "source-index",
  "glossary",
  ...CANONICAL_KB_SLOTS,
]);

function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
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

/** 从 <!-- KB-CONFIG --> 注释块解析 display-order */
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

function requiresFullV28Structure(mode: KnowledgeNetworkUpdateMode | undefined): boolean {
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
      error: "缺少 <!-- KB-CONFIG --> 块（v2.8 必填：display-order、project-type 等）",
    };
  }
  return null;
}

/** display-order / nav / section id 三方一致性（initial/full/incremental/reorder 均检查） */
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

function validateSourceIndex(uncommented: string, navTargets: string[]): KnHtmlValidationResult | null {
  if (!/\bid=["']source-index["']/i.test(uncommented)) {
    return { ok: false, error: "缺少 source-index" };
  }
  if (!navTargets.includes("source-index")) {
    return { ok: false, error: "缺少 source-index（nav 无 data-target=\"source-index\"）" };
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

function validateStrictV28(t: string, options: KnHtmlValidationOptions): KnHtmlValidationResult {
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

    const sourceIndex = validateSourceIndex(uncommented, navTargets);
    if (sourceIndex) return sourceIndex;

    const citations = validateCitationsAndRevealAnchor(t, uncommented, false);
    if (citations) return citations;
  } else if (requiresFullV28Structure(mode)) {
    const alignment = validateConfigNavSectionAlignment(uncommented, displayOrder);
    if (alignment) return alignment;

    const sourceIndex = validateSourceIndex(uncommented, navTargets);
    if (sourceIndex) return sourceIndex;

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
    (mode !== "reorder" && /id=["']timeline["']/i.test(uncommented))
  ) {
    const hasTimelineStructure =
      /已发生关键事件/.test(uncommented) &&
      (/正在推进|当前正在推进/.test(uncommented) || /8\.2/.test(uncommented)) &&
      (/未来关键节点|8\.3/.test(uncommented));
    if (!hasTimelineStructure && mode !== "reorder") {
      return {
        ok: true,
        warning: "timeline slot 存在但未检测到 v2.8 三区块结构（已发生/正在推进/未来关键节点）",
      };
    }
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
    return validateStrictV28(t, { ...options, strict: true, mode: "reorder" });
  }

  if (!strict) {
    return { ok: true };
  }

  return validateStrictV28(t, { ...options, strict: true });
}

/** 供本地/CI 验收 v2.8 样例 */
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
    hasRevealAnchor: /revealAnchor/i.test(t),
    hasSourceIndex: /\bid=["']source-index["']/i.test(uncommented),
    citationU1: /href=["']#source-U-1["']/i.test(uncommented),
    appendixU1: /id=["']source-U-1["']/i.test(uncommented),
  };
  for (const slot of CANONICAL_KB_SLOTS) {
    checks[`slot_${slot}`] = new RegExp(`id=["']${slot}["']`, "i").test(uncommented);
  }
  const result = validateKnowledgeNetworkHtml(html, { strict: true, mode: "initial" });
  const errors: string[] = [];
  if (!result.ok && result.error) errors.push(result.error);
  for (const [k, v] of Object.entries(checks)) {
    if (!v) errors.push(`check failed: ${k}`);
  }
  return { ok: errors.length === 0, checks, errors };
}

/** 测试用：从 v2.8 样例裁掉 3 个 slot，模拟旧 8 段式 HTML */
export function buildEightSlotInvalidFixture(v28Html: string): string {
  let t = v28Html;
  const removed = ["capital-structure", "comps", "timeline"] as const;
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
    "display-order: snapshot, assets, legal-relationships, business-model, returns, risks, open-questions, decision-framework",
  );
}
