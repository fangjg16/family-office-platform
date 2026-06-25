import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { SLOT_DEFAULT_TITLES } from "./knowledge-network-slot-render";

/** 去掉 PDF 提取头、压缩空白，供 masthead / inventory 摘录 */
export function sanitizeDocumentExcerpt(text: string, maxLen = 200): string {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^【[^】]*(?:PDF|pdf|提取|正文)[^】]*】\s*/i, "");
  t = t.replace(/^【[^】]+\.(?:pdf|docx?|pptx?)[^】]*】\s*/i, "");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export function buildProjectAutoSummary(
  documentCount: number,
  filenames: readonly string[],
): string {
  if (documentCount <= 0) {
    return "预处理阶段未索引到已解析文档；各 batch 须 gap-first section，禁止编造事实。";
  }
  const names = filenames.slice(0, 3).join("、");
  const suffix = documentCount > 3 ? ` 等 ${documentCount} 份` : "";
  return `已索引 ${documentCount} 份项目资料（${names}${suffix}）；各 slot 由 kb-fragment-batch 基于 Worker 证据摘录与 reading plan 生成，非本段原文复述。`;
}

export function buildCanonicalSectionTitle(slot: CanonicalKbSlot): string {
  const d = SLOT_DEFAULT_TITLES[slot];
  return `<h2 class="section-title"><span class="section-num">${d.num}</span>${d.title}</h2>`;
}

const MATURITY_GRADE_LEAK_RE =
  /(?:^|[\s>])([A-D])\s*·\s*(\d{1,3})%\s*[^<\n]{0,240}/gim;

const EMOJI_H2_RE = /<h2[^>]*>\s*[⚠️🔍🔴🟡🟢❌✅][\s\S]*?<\/h2>/gi;

/** 确定性修正：canonical 标题、去掉成熟度字母分泄漏、去掉 emoji 标题 */
export function normalizeFragmentSectionHtml(
  slot: CanonicalKbSlot,
  html: string,
): string {
  const trimmed = html.trim();
  const openMatch = trimmed.match(/^(<section[^>]*>)/i);
  if (!openMatch) return trimmed;

  const open = openMatch[1]!;
  let inner = trimmed.slice(open.length).replace(/<\/section>\s*$/i, "");

  inner = inner.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, "");
  inner = inner.replace(EMOJI_H2_RE, "");
  inner = inner.replace(
    /<p[^>]*>\s*[A-D]\s*·\s*\d{1,3}%[\s\S]*?<\/p>/gi,
    "",
  );
  inner = inner.replace(MATURITY_GRADE_LEAK_RE, "");

  return `${open}${buildCanonicalSectionTitle(slot)}${inner}</section>`;
}

const SLOT_COMPONENT_MARKERS: Partial<Record<CanonicalKbSlot, RegExp>> = {
  "risks-mitigation": /class=["'][^"']*risk-level/i,
  "timeline-milestones": /class=["'][^"']*timeline|project-timeline|tl-item/i,
  "decision-framework": /class=["'][^"']*callout|scenario-card|decision-table/i,
  "diligence-gaps": /class=["'][^"']*oq-group|<table\b/i,
  "business-operations": /journey-wrap|process-flow|bmc|scenario-card|<table\b/i,
};

export function validateSlotComponentMarkers(slot: CanonicalKbSlot, html: string): string | null {
  const gapFirstOnly =
    /class=["'][^"']*callout missing|缺乏资料|暂无已记录|暂无有效/i.test(html) &&
    !/<table\b/i.test(html) &&
    !/class=["'][^"']*timeline/i.test(html) &&
    !/class=["'][^"']*risk-level/i.test(html);
  if (gapFirstOnly) return null;

  const re = SLOT_COMPONENT_MARKERS[slot];
  if (!re) return null;
  if (re.test(html)) return null;
  if (slot === "risks-mitigation") {
    return "须使用 components.html 风险矩阵：严重度列用 span.risk-level（禁止 emoji 圆点）";
  }
  if (slot === "timeline-milestones") {
    return "须使用 components.html 三段式 timeline（h3 8.1/8.2/8.3 + div.timeline.project-timeline + tl-item）";
  }
  if (slot === "decision-framework") {
    return "须含 callout.info 建议区 + 表格/ scenario-cards（见 slot-rendering-rules）";
  }
  if (slot === "diligence-gaps") {
    return "须含 oq-group 或标准问题表（见 slot-rendering-rules）";
  }
  return `slot ${slot} 缺少约定 HTML 组件标记`;
}

export function validateFragmentSectionTitle(slot: CanonicalKbSlot, html: string): string | null {
  const expected = SLOT_DEFAULT_TITLES[slot];
  if (!/<h2[^>]*class=["'][^"']*section-title/i.test(html)) {
    return "缺少 <h2 class=\"section-title\">";
  }
  if (!new RegExp(`section-num[^>]*>\\s*${expected.num}`).test(html)) {
    return `section-num 须为「${expected.num}」（中文序号）`;
  }
  if (/[⚠️🔍🔴🟡🟢]/.test(html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i)?.[0] ?? "")) {
    return "section 标题禁止 emoji；用 callout 组件表达警示";
  }
  if (/[A-D]\s*·\s*\d{1,3}%/i.test(html)) {
    return "fragment 正文禁止出现 A–D · NN% 成熟度字母分（成熟度只写在 batch JSON maturity 字段）";
  }
  return null;
}
