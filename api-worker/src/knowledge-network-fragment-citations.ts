import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

const SOURCE_HREF_RE = /#(source-[A-Za-z0-9_-]+)/g;

/** Appendix A / 正文引用 id 尾段（U-1、A-7、A-10b、S12 等） */
const SOURCE_SHORT_ID =
  "(?:[A-Z][A-Za-z0-9]*-\\d+[A-Za-z0-9]*|[A-Z]\\d+[a-z]?)";

const SOURCE_ANCHOR_ID = `source-${SOURCE_SHORT_ID}`;

const ALREADY_CITE_REF_RE =
  /<sup\s+class=["']cite-ref["']>\s*<a\s+href=["']#source-([A-Za-z0-9_-]+)["'][^>]*>\[[^\]]*\]<\/a>\s*<\/sup>/gi;

const CITE_PLACEHOLDER_PREFIX = "\uE000CITE";
const CITE_PLACEHOLDER_SUFFIX = "\uE001";

function citeRefHtml(shortId: string): string {
  const label = shortId.replace(/^source-/i, "");
  return `<sup class="cite-ref"><a href="#source-${label}">[${label}]</a></sup>`;
}

function maskExistingCiteRefs(html: string): { html: string; preserved: string[] } {
  const preserved: string[] = [];
  const masked = html.replace(ALREADY_CITE_REF_RE, (match) => {
    preserved.push(match);
    return `${CITE_PLACEHOLDER_PREFIX}${preserved.length - 1}${CITE_PLACEHOLDER_SUFFIX}`;
  });
  return { html: masked, preserved };
}

function unmaskCiteRefs(html: string, preserved: string[]): string {
  return html.replace(
    new RegExp(`${CITE_PLACEHOLDER_PREFIX}(\\d+)${CITE_PLACEHOLDER_SUFFIX}`, "g"),
    (_, index: string) => preserved[Number(index)] ?? "",
  );
}

/**
 * 将 fragment 内各类引用写法统一为 Codex cite-ref（对齐 render_kb_html.link_citations /
 * slot-render.renderEvidenceCell）。已规范的 cite-ref 不重复包裹。
 */
export function normalizeFragmentCitations(html: string): string {
  if (!html?.trim()) return html;

  const passes: Array<(masked: string) => string> = [
    // <a href="#source-…">…</a>（无 cite-ref 包裹）
    (s) =>
      s.replace(
        new RegExp(
          `<a\\s+href=["']#(${SOURCE_ANCHOR_ID})["'][^>]*>[\\s\\S]*?<\\/a>`,
          "gi",
        ),
        (_full, anchorId: string) => citeRefHtml(anchorId),
      ),
    // (#source-A-1)
    (s) =>
      s.replace(
        new RegExp(`\\(\\s*#(${SOURCE_ANCHOR_ID})\\s*\\)`, "g"),
        (_full, anchorId: string) => citeRefHtml(anchorId),
      ),
    // (#A-1)
    (s) =>
      s.replace(
        new RegExp(`\\(\\s*#(${SOURCE_SHORT_ID})\\s*\\)`, "g"),
        (_full, shortId: string) => citeRefHtml(shortId),
      ),
    // 裸 #source-A-1（非 href/id 属性内）
    (s) =>
      s.replace(
        new RegExp(`(?<![="'"])#(${SOURCE_ANCHOR_ID})(?![A-Za-z0-9_-])`, "g"),
        (_full, anchorId: string) => citeRefHtml(anchorId),
      ),
    // 裸 #U-1 / #A-7
    (s) =>
      s.replace(
        new RegExp(`(?<![="'#])#(${SOURCE_SHORT_ID})(?![A-Za-z0-9_-])`, "g"),
        (_full, shortId: string) => citeRefHtml(shortId),
      ),
    // [A-1]、[U-7]
    (s) =>
      s.replace(
        new RegExp(`\\[(${SOURCE_SHORT_ID})\\]`, "g"),
        (_full, shortId: string) => citeRefHtml(shortId),
      ),
  ];

  let out = html;
  for (const pass of passes) {
    const { html: masked, preserved } = maskExistingCiteRefs(out);
    out = unmaskCiteRefs(pass(masked), preserved);
  }
  return out;
}

/** 将 fragment HTML 内 #source-{proposalKey} 改写为 Worker 分配的 U-N/A-N */
export function rewriteFragmentHtmlCitations(
  html: string,
  proposalKeyToId: ReadonlyMap<string, string> | Record<string, string>,
): string {
  const map =
    proposalKeyToId instanceof Map
      ? proposalKeyToId
      : new Map(Object.entries(proposalKeyToId));
  return html.replace(SOURCE_HREF_RE, (full, rawId: string) => {
    const short = rawId.replace(/^source-/, "");
    const mapped = map.get(short);
    if (!mapped) return full;
    const anchor = mapped.startsWith("source-") ? mapped : `source-${mapped}`;
    return `#${anchor}`;
  });
}

export function rewriteSessionFragmentCitations(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
  proposalKeyToId: ReadonlyMap<string, string> | Record<string, string>,
): Partial<Record<CanonicalKbSlot, string>> {
  const out: Partial<Record<CanonicalKbSlot, string>> = {};
  for (const [slot, html] of Object.entries(fragments)) {
    if (!html?.trim()) continue;
    out[slot as CanonicalKbSlot] = rewriteFragmentHtmlCitations(html, proposalKeyToId);
  }
  return out;
}

export function normalizeSessionFragmentCitations(
  fragments: Partial<Record<CanonicalKbSlot, string>>,
): Partial<Record<CanonicalKbSlot, string>> {
  const out: Partial<Record<CanonicalKbSlot, string>> = {};
  for (const [slot, html] of Object.entries(fragments)) {
    if (!html?.trim()) continue;
    out[slot as CanonicalKbSlot] = normalizeFragmentCitations(html);
  }
  return out;
}
