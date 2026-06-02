import { useEffect, useState } from "react";
import { Download, ExternalLink, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type KnowledgeNetworkPreviewProps = {
  html: string;
  filename?: string;
};

export function KnowledgeNetworkPreview({ html, filename }: KnowledgeNetworkPreviewProps) {
  const [open, setOpen] = useState(false);
  const safeName = filename?.trim() || "[AI]_项目知识网络.html";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openInNewTab = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          预览知识网络 HTML
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={openInNewTab}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          新标签页打开
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadHtml}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          下载 HTML
        </Button>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kn-preview-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <h3 id="kn-preview-title" className="text-base font-semibold">
                {safeName}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 shrink-0 p-0"
                onClick={() => setOpen(false)}
                aria-label="关闭预览"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <iframe
              title={safeName}
              srcDoc={html}
              className="h-[min(78vh,820px)] w-full border-0 bg-[#f5f0e8]"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** 从助手回复中解析 ```html 知识网络块（Worker 未返回 knowledgeNetworkHtml 时的兜底） */
export function extractKnowledgeNetworkHtmlFromMarkdown(text: string): string | null {
  const fence = text.match(/```html\s*([\s\S]*?)```/i);
  if (!fence) return null;
  const html = fence[1].trim();
  if (html.length < 200) return null;
  if (!/<html[\s>]/i.test(html) && !/kb-shell|项目知识网络/i.test(html)) return null;
  return html;
}

const KN_HTML_FALLBACK_SUMMARY =
  "知识网络 HTML 已生成，请使用下方按钮预览或在新标签页打开。";

/** 展示用：去掉 ```html 大块源码，保留摘要与预览按钮 */
export function stripKnowledgeNetworkHtmlBlock(text: string): string {
  let out = text.replace(/```html\s*[\s\S]*?```/gi, "").trim();
  out = out.replace(/\n---\n+\*\*网站预览说明\*\*[\s\S]*$/u, "").trim();
  if (!out || out.length < 12) return KN_HTML_FALLBACK_SUMMARY;
  return out;
}

export function prepareKnowledgeNetworkMessageDisplay(
  content: string,
  knowledgeNetworkHtml?: string | null,
): { displayContent: string; html: string | null } {
  const html =
    (typeof knowledgeNetworkHtml === "string" ? knowledgeNetworkHtml.trim() : "") ||
    extractKnowledgeNetworkHtmlFromMarkdown(content);
  if (!html) return { displayContent: content, html: null };
  return { displayContent: stripKnowledgeNetworkHtmlBlock(content), html };
}
