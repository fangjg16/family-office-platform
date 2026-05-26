import { useState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KnowledgeNetworkPreviewProps = {
  html: string;
  filename?: string;
};

export function KnowledgeNetworkPreview({ html, filename }: KnowledgeNetworkPreviewProps) {
  const [open, setOpen] = useState(false);
  const safeName = filename?.trim() || "[AI]_项目知识网络.html";

  const openInNewTab = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
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
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,1200px)] gap-0 p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-base font-semibold">{safeName}</DialogTitle>
          </DialogHeader>
          <iframe
            title={safeName}
            srcDoc={html}
            className="h-[min(78vh,820px)] w-full border-0 bg-[#f5f0e8]"
            sandbox="allow-scripts allow-same-origin"
          />
        </DialogContent>
      </Dialog>
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
