import type { Components } from "react-markdown";
import { Children, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const remarkPlugins = [remarkGfm, remarkBreaks];

/**
 * RAG 常输出 `** 标题 **`（星号与文字之间有空格）。CommonMark 要求定界符紧贴内容，否则不会识别为加粗。
 * 将松散写法规范为 `**标题**`，以便 react-markdown 正确解析。
 */
function normalizeLooseMarkdownBold(text: string): string {
  return text.replace(/\*\*\s*([^*]+?)\s*\*\*/g, (_, inner: string) => `**${inner.trim()}**`);
}

/** 修复模型偶发的不规范表格分隔行（列数不一致时 GFM 会整表失效） */
function normalizeMarkdownTables(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isRow = /^\s*\|.+\|\s*$/u.test(line);
    if (!isRow) {
      out.push(line);
      i += 1;
      continue;
    }
    const block: string[] = [];
    while (i < lines.length && /^\s*\|.+\|\s*$/u.test(lines[i])) {
      block.push(lines[i].trim());
      i += 1;
    }
    if (block.length >= 2) {
      const colCounts = block.map((r) => r.split("|").filter((c) => c.trim().length > 0).length);
      const cols = Math.max(...colCounts);
      const fixed = block.map((row, idx) => {
        const cells = row
          .replace(/^\|/u, "")
          .replace(/\|$/u, "")
          .split("|")
          .map((c) => c.trim());
        while (cells.length < cols) cells.push("");
        const joined = `| ${cells.join(" | ")} |`;
        if (idx === 1 && /^[\s|:-]+$/u.test(row.replace(/\|/g, ""))) {
          return `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`;
        }
        return joined;
      });
      out.push(...fixed);
    } else {
      out.push(...block);
    }
  }
  return out.join("\n");
}

function TableCellContent({ children, userVariant }: { children: React.ReactNode; userVariant: boolean }) {
  const raw = Children.toArray(children)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : ""))
    .join("")
    .trim();
  const statusMatch = raw.match(/^(✅|❌|⚠️|🟡|🔵|⚪)\s*(.*)$/u);
  if (statusMatch) {
    const [, icon, rest] = statusMatch;
    const tone =
      icon === "✅"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : icon === "❌"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : icon === "⚠️" || icon === "🟡"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-slate-200 bg-slate-50 text-slate-700";
    return (
      <span
        className={cn(
          "inline-flex max-w-full flex-wrap items-start gap-1 rounded-md border px-1.5 py-0.5 text-[12px] font-medium leading-snug",
          userVariant ? "border-white/20 bg-white/10 text-slate-100" : tone,
        )}
      >
        <span aria-hidden>{icon}</span>
        {rest ? <span>{rest}</span> : null}
      </span>
    );
  }
  return <>{children}</>;
}

type ChatMarkdownProps = {
  text: string;
  variant: "assistant" | "user";
};

type CitationTipPlacementX = "center" | "left" | "right";
type CitationTipPlacementY = "top" | "bottom";

function CitationMarker({
  children,
  tip,
  userVariant,
}: {
  children: React.ReactNode;
  tip: string;
  userVariant: boolean;
}) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placementX, setPlacementX] = useState<CitationTipPlacementX>("center");
  const [placementY, setPlacementY] = useState<CitationTipPlacementY>("top");

  const recalculatePlacement = () => {
    if (typeof window === "undefined") return;
    const root = rootRef.current;
    const tipNode = tipRef.current;
    if (!root || !tipNode) return;
    const viewportPadding = 8;
    const rootRect = root.getBoundingClientRect();
    const tipRect = tipNode.getBoundingClientRect();

    let nextX: CitationTipPlacementX = "center";
    if (tipRect.left < viewportPadding) {
      nextX = "left";
    }
    if (tipRect.right > window.innerWidth - viewportPadding) {
      nextX = "right";
    }

    let nextY: CitationTipPlacementY = "top";
    if (rootRect.top < tipRect.height + 14) {
      nextY = "bottom";
    }

    setPlacementX(nextX);
    setPlacementY(nextY);
  };

  const openTip = () => {
    setOpen(true);
    window.requestAnimationFrame(recalculatePlacement);
  };

  const closeTip = () => {
    setOpen(false);
  };

  return (
    <span
      ref={rootRef}
      className={cn(
        "group/cite relative inline-flex cursor-help items-center rounded-full px-0.5",
        userVariant ? "text-slate-100" : "text-foreground/90",
      )}
      aria-label={tip}
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
      onFocus={openTip}
      onBlur={closeTip}
      tabIndex={0}
    >
      {children}
      <span
        ref={tipRef}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-30 w-max max-w-[min(22rem,calc(100vw-16px))] rounded-md border px-2 py-1.5 text-[11px] leading-snug shadow-lg",
          "transition-[opacity,transform] duration-75 ease-out",
          placementX === "center" && "left-1/2 -translate-x-1/2",
          placementX === "left" && "left-0 translate-x-0",
          placementX === "right" && "right-0 translate-x-0",
          placementY === "top" && "bottom-[calc(100%+6px)]",
          placementY === "bottom" && "top-[calc(100%+6px)]",
          open
            ? "opacity-100 translate-y-0"
            : placementY === "top"
              ? "opacity-0 translate-y-0.5"
              : "opacity-0 -translate-y-0.5",
          userVariant
            ? "border-white/20 bg-slate-900/95 text-slate-100"
            : "border-border/70 bg-white text-foreground",
        )}
      >
        {tip}
      </span>
    </span>
  );
}

export function ChatMarkdown({ text, variant }: ChatMarkdownProps) {
  const u = variant === "user";
  const components: Components = {
    p: ({ children }) => (
      <p
        className={cn("mb-2 last:mb-0", u ? "font-medium leading-relaxed" : "leading-relaxed")}
      >
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong
        className={u ? "font-bold text-wine-deep-foreground" : "font-semibold text-foreground"}
      >
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em
        className={
          u ? "text-wine-deep-foreground/90 italic" : "text-foreground/90 italic"
        }
      >
        {children}
      </em>
    ),
    del: ({ children }) => <del className="opacity-75">{children}</del>,
    ul: ({ children }) => <ul className="my-2 list-outside list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => (
      <ol className="my-2 list-outside list-decimal space-y-1 pl-5">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }) => (
      <h1
        className={cn(
          "mb-2 mt-1 text-base font-bold",
          u ? "text-wine-deep-foreground" : "text-foreground",
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn(
          "mb-3 mt-5 border-b pb-2 text-[15px] font-bold tracking-tight first:mt-0",
          u ? "border-wine-deep-foreground/20 text-wine-deep-foreground" : "border-border/70 text-foreground",
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn(
          "mb-1.5 mt-1 text-sm font-semibold",
          u ? "text-wine-deep-foreground" : "text-foreground",
        )}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={cn(
          "mb-1.5 mt-1 text-sm font-semibold",
          u ? "text-wine-deep-foreground" : "text-foreground",
        )}
      >
        {children}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "my-3 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed",
          u
            ? "border-wine-deep-foreground/20 bg-black/10 text-wine-deep-foreground/90"
            : "border-primary/15 bg-primary/[0.04] text-foreground/85",
        )}
      >
        {children}
      </blockquote>
    ),
    a: ({ href, title, children }) => {
      const childText = Children.toArray(children)
        .map((node) => (typeof node === "string" ? node : ""))
        .join("");
      const isCitationLink =
        href?.startsWith("cite:") ||
        (!href && typeof title === "string" && title.includes(".pdf")) ||
        childText.includes("[ID:");
      if (isCitationLink) {
        const tip = title?.trim() ?? "";
        if (!tip) return <>{children}</>;
        return (
          <CitationMarker tip={tip} userVariant={u}>
            {children}
          </CitationMarker>
        );
      }
      return (
        <a
          href={href}
          className={cn("underline underline-offset-2", u ? "text-sky-200" : "text-primary")}
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    code: ({ className, children, ...props }) => {
      const isFenced = Boolean(className?.startsWith("language-"));
      if (isFenced) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[0.9em]",
            u ? "bg-white/15 text-slate-100" : "bg-muted/80 text-foreground",
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre
        className={cn(
          "my-2 max-w-full overflow-x-auto rounded-xl p-3 text-xs leading-relaxed",
          u ? "bg-black/35 text-slate-100" : "bg-muted/50 text-foreground",
        )}
      >
        {children}
      </pre>
    ),
    hr: () => <hr className="my-3 border-border/60" />,
    table: ({ children }) => (
      <div
        className={cn(
          "my-4 w-full min-w-0 max-w-full overflow-x-auto rounded-xl border shadow-sm",
          u ? "border-white/15" : "border-border/60 bg-white",
        )}
      >
        <table className={cn("w-full min-w-[640px] border-collapse text-left text-[13px]", u && "text-slate-100")}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={u ? "bg-white/10" : "bg-slate-50/90"}>{children}</thead>
    ),
    th: ({ children }) => (
      <th
        className={cn(
          "whitespace-nowrap px-3 py-2.5 text-left text-[12px] font-semibold",
          u ? "text-slate-50" : "text-foreground/80",
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          "border-t px-3 py-2.5 align-top leading-snug",
          u ? "border-white/10 text-slate-200" : "border-border/40 text-foreground/90",
        )}
      >
        <TableCellContent userVariant={u}>{children}</TableCellContent>
      </td>
    ),
    tr: ({ children }) => (
      <tr className={u ? "hover:bg-white/5" : "even:bg-muted/15 hover:bg-muted/25"}>{children}</tr>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ""}
        className="my-2 max-h-72 w-auto max-w-full rounded-lg object-contain"
        loading="lazy"
      />
    ),
  };

  if (!text.trim()) {
    return <span className="text-sm text-muted-foreground">&nbsp;</span>;
  }

  const normalized = normalizeMarkdownTables(normalizeLooseMarkdownBold(text));

  return (
    <div
      className={cn(
        "chat-markdown min-w-0 max-w-full break-words text-sm leading-relaxed",
        u
          ? "text-wine-deep-foreground selection:bg-[hsl(var(--wine-muted))] selection:text-[hsl(var(--warm-charcoal))]"
          : "text-foreground selection:bg-[hsl(var(--wine-deep)/0.14)] selection:text-foreground",
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
