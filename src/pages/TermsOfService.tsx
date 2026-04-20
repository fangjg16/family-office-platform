import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import termsRaw from "@/legal/terms-of-service-source.txt?raw";

import type { LegalBlock } from "@/legal/parseTermsOfService";
import { parseTermsOfServiceSource } from "@/legal/parseTermsOfService";

const doc = parseTermsOfServiceSource(termsRaw);

/** 与 Word 中「英文 | 中文」或「英文｜中文」标题行一致：拆成两行展示 */
function splitBilingualTitle(line: string): string[] {
  return line
    .split(/\s*[|｜]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function LegalContent({ block }: { block: LegalBlock }) {
  if (block.type === "paragraph") {
    return <p className="whitespace-pre-line text-sm leading-[1.65] text-muted-foreground">{block.content}</p>;
  }

  if (block.type === "bilingual") {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-line text-sm leading-[1.65] text-muted-foreground">{block.en}</p>
        <p className="whitespace-pre-line text-sm leading-[1.65] text-muted-foreground/90">{block.zh}</p>
      </div>
    );
  }

  if (block.type === "subheading") {
    return (
      <div className="mb-1 mt-6 first:mt-0">
        <h3 className="text-sm font-bold leading-snug text-foreground">{block.title}</h3>
        {block.titleZh ? <p className="mt-1 text-sm font-bold leading-snug text-foreground">{block.titleZh}</p> : null}
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-[1.65] text-muted-foreground">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "bilingual-list") {
    return (
      <ul className="list-disc space-y-3 pl-5">
        {block.items.map((item, index) => (
          <li key={`${item.en.slice(0, 40)}-${index}`} className="text-sm leading-[1.65]">
            <span className="text-muted-foreground">{item.en}</span>
            <span className="mt-1 block text-muted-foreground/90">{item.zh}</span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

function renderSectionBlocks(blocks: LegalBlock[]) {
  const content: ReactNode[] = [];
  let pendingHeading: string | null = null;
  let pendingTitleZh: string | undefined;
  let pendingBlocks: LegalBlock[] = [];

  const flushGroup = (key: string) => {
    if (!pendingHeading && pendingBlocks.length === 0) return;

    if (pendingHeading) {
      content.push(
        <div key={key}>
          <div className="mb-2">
            <h3 className="text-sm font-bold leading-snug text-foreground">{pendingHeading}</h3>
            {pendingTitleZh ? <p className="mt-1 text-sm font-bold leading-snug text-foreground">{pendingTitleZh}</p> : null}
          </div>
          <div className="space-y-5">
            {pendingBlocks.map((block, index) => (
              <LegalContent key={`${key}-${index}`} block={block} />
            ))}
          </div>
        </div>
      );
    } else {
      pendingBlocks.forEach((block, index) => {
        content.push(<LegalContent key={`${key}-${index}`} block={block} />);
      });
    }

    pendingHeading = null;
    pendingTitleZh = undefined;
    pendingBlocks = [];
  };

  blocks.forEach((block, index) => {
    if (block.type === "subheading") {
      flushGroup(`group-${index}`);
      pendingHeading = block.title;
      pendingTitleZh = block.titleZh;
      return;
    }

    pendingBlocks.push(block);
  });

  flushGroup("group-final");
  return <div className="flex flex-col gap-6">{content}</div>;
}

export default function TermsOfService() {
  const subtitleParts = splitBilingualTitle(doc.docLine2);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/[0.06] bg-[hsl(240_43%_5%/0.94)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-10 lg:px-12">
          <Link to="/" className="font-display text-[1.05rem] font-semibold tracking-[0.08em] text-gradient-landing">
            合域
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-400/30 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="pt-[60px]">
        {/* 与 Word 一致：第 1 行文档标题、第 2 行 outline 0 副标题、日期两行 */}
        <div className="border-b border-border py-14 px-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
              {doc.docLine1 || "Terms of Service"}
            </h1>
            <div className="mt-3 space-y-px">
              {subtitleParts.map((part, i) => (
                <p key={i} className="text-lg font-semibold leading-snug text-foreground">
                  {part}
                </p>
              ))}
            </div>
            <div className="mt-5 space-y-1 text-sm text-muted-foreground">
              <p>{doc.lastUpdatedEn}</p>
              <p>{doc.lastUpdatedZh}</p>
            </div>
          </div>
        </div>

        <article className="mx-auto max-w-3xl px-6 py-14 text-[15px] leading-[1.65]">
          {doc.introHeading ? (
            <div className="mb-8 space-y-1 border-l-[3px] border-sky-500/35 pl-4">
              {splitBilingualTitle(doc.introHeading).map((part, i) => (
                <p key={i} className="text-base font-bold leading-snug text-foreground">
                  {part}
                </p>
              ))}
            </div>
          ) : null}

          <div className="space-y-6">{renderSectionBlocks(doc.introBlocks)}</div>

          {doc.sections.map((section, idx) => {
            const titleParts = splitBilingualTitle(section.title);
            return (
              <section
                key={section.id}
                id={section.id}
                className={`scroll-mt-24 border-t border-border pt-10 ${idx === 0 ? "mt-12" : ""}`}
              >
                <h2 className="mb-5 space-y-0.5 text-lg font-bold leading-snug tracking-tight text-foreground">
                  {titleParts.map((part, i) => (
                    <span key={i} className="block">
                      {part}
                    </span>
                  ))}
                </h2>
                {renderSectionBlocks(section.blocks)}
              </section>
            );
          })}
        </article>
      </main>
    </div>
  );
}
