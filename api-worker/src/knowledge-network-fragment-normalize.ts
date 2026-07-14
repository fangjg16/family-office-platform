/** 从 snapshot fragment「一句话判断」callout 提取兜底概览（仅当 overviewMeta 缺失） */
export function extractSnapshotOverviewFallback(snapshotHtml: string): {
  lead?: string;
  autoSummary?: string;
} {
  const callout = snapshotHtml.match(
    /<aside[^>]*class=["'][^"']*callout[^"']*info[^"']*["'][^>]*>([\s\S]*?)<\/aside>/i,
  )?.[1];
  if (!callout) return {};
  const p = callout
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!p) return {};
  const lead = p.length <= 120 ? p : `${p.slice(0, 117)}…`;
  return { lead, autoSummary: p.length <= 200 ? p : `${p.slice(0, 197)}…` };
}

/** 去掉 PDF 提取头、压缩空白，供 Evidence Inventory 摘录（不用于 masthead / autoSummary） */
export function sanitizeDocumentExcerpt(text: string, maxLen = 200): string {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^【[^】]*(?:PDF|pdf|提取|正文)[^】]*】\s*/i, "");
  t = t.replace(/^【[^】]+\.(?:pdf|docx?|pptx?)[^】]*】\s*/i, "");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
