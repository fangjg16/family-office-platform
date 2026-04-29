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
      <strong className={u ? "font-bold text-white" : "font-semibold text-foreground"}>
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className={u ? "text-slate-100 italic" : "text-foreground/90 italic"}>{children}</em>
    ),
    del: ({ children }) => <del className="opacity-75">{children}</del>,
    ul: ({ children }) => <ul className="my-2 list-outside list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => (
      <ol className="my-2 list-outside list-decimal space-y-1 pl-5">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    h1: ({ children }) => (
      <h1
        className={cn("mb-2 mt-1 text-base font-bold", u ? "text-white" : "text-foreground")}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={cn("mb-2 mt-1 text-sm font-bold", u ? "text-white" : "text-foreground")}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className={cn("mb-1.5 mt-1 text-sm font-semibold", u ? "text-slate-100" : "text-foreground")}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={cn("mb-1.5 mt-1 text-sm font-semibold", u ? "text-slate-100" : "text-foreground")}
      >
        {children}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className={cn(
          "my-2 border-l-2 pl-3",
          u ? "border-white/30 text-slate-200" : "border-primary/40 text-muted-foreground",
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
      <div className="my-2 w-full min-w-0 max-w-full overflow-x-auto">
        <table
          className={cn(
            "w-full min-w-[16rem] border-collapse text-left text-xs",
            u && "text-slate-100",
          )}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className={u ? "border-b border-white/25" : "border-b border-border/80"}>
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th
        className={cn("px-2 py-1.5 font-semibold", u ? "text-slate-50" : "text-foreground")}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          "border-t px-2 py-1.5 align-top",
          u ? "border-white/10 text-slate-200" : "border-border/50 text-muted-foreground",
        )}
      >
        {children}
      </td>
    ),
    tr: ({ children }) => <tr>{children}</tr>,
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

  const normalized = normalizeLooseMarkdownBold(text);

  return (
    <div
      className={cn(
        "min-w-0 max-w-full break-words text-sm",
        u ? "text-slate-50" : "text-muted-foreground",
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
