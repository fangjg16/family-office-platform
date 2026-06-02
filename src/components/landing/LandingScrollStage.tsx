import type { LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { useElementScrollProgress } from "@/hooks/use-element-scroll-progress";
import { ConcentricRingsParticles } from "@/components/landing/ConcentricRingsParticles";
import {
  CAPABILITIES,
  PIPELINE,
  SCROLL_CHAPTERS,
  type ScrollChapter,
} from "@/components/landing/landing-content";
import { chapterMotionAt } from "@/components/landing/scroll-chapter-motion";
import {
  CONTENT_TEXT_INSET,
  CONTENT_TEXT_MAX_WIDTH,
  STAGE_BASE_WIDTH_PX,
  stageContentLayout,
  stageTextColumnLeft,
  stageTextColumnRight,
  WELCOME_TEXT_OPTICAL_SHIFT_X,
  WELCOME_TEXT_OPTICAL_SHIFT_Y,
} from "@/components/landing/scroll-stage-layout";

/** 端到端链路：方卡最小高度；圆直径 +4% overshoot（§光学对齐） */
const FLOW_CARD_MIN = "clamp(3.15rem, 7vw, 3.5rem)" as const;
const FLOW_ICON_SIZE =
  "calc(clamp(3.15rem, 7vw, 3.5rem) * 1.04)" as const;
const FLOW_STEP_CONNECTOR = "clamp(1.25rem, 2.75vh, 1.5rem)" as const;

/**
 * 逐步图标光学补偿（按视觉重心，非 bbox 中心）
 *
 * 规则：上重下轻 → bbox 几何居中时会显得偏上 → 应略下移（+y）
 *       左重右轻 → 略右移（+x）… 依此类推
 */
const FLOW_ICON_OPTICAL: Record<
  (typeof PIPELINE)[number]["tag"],
  { x: string; y: string }
> = {
  /** 文档 + 右下箭头，重心偏左下 → 向右上推，把视觉重心拉回圆心 */
  Ingest: { x: "0.06em", y: "-0.03em" },
  /** 开书：上宽下尖，视觉重心高于 bbox 中心 → 略下移 */
  Schema: { x: "0", y: "0.05em" },
  /** 脑形：上鼓下窄，同上 → 略下移 */
  Decide: { x: "0", y: "0.055em" },
  /** 星芒较对称，仅消 Lucide viewBox 上留白 */
  Output: { x: "0", y: "0.02em" },
};

function FlowStepIcon({
  tag,
  icon: Icon,
}: {
  tag: (typeof PIPELINE)[number]["tag"];
  icon: LucideIcon;
}) {
  const { x, y } = FLOW_ICON_OPTICAL[tag];
  return (
    <Icon
      className="block size-[clamp(1rem,2.2vw,1.2rem)]"
      strokeWidth={1.25}
      style={{ transform: `translate(${x}, ${y})` }}
    />
  );
}

/** 5 章滚动叙事高度 */
const SCROLL_HEIGHT_VH = 380;

function useStageViewport(stickyRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;

    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stickyRef]);

  return size;
}

function Folio({ children }: { children: string }) {
  return (
    <p className="mb-3 font-display text-[0.68rem] tracking-[0.2em] text-[hsl(var(--hero-muted))]">
      {children.toUpperCase()}
    </p>
  );
}

function ChapterBody({ c, centered }: { c: ScrollChapter; centered: boolean }) {
  const align = centered ? "text-center" : "text-left";

  if (c.id === "welcome") {
    return (
      <div className={`mx-auto max-w-2xl ${align}`}>
        <h1 className="font-display text-[clamp(1.75rem,4.5vw,2.85rem)] font-semibold leading-[1.12] tracking-[0.04em]">
          <span className="text-gradient-landing">{c.title}</span>
          {c.subtitle && (
            <span className="mt-2 block text-[clamp(1.05rem,2.4vw,1.6rem)] font-normal tracking-[0.06em] text-[hsl(var(--hero-foreground))]">
              {c.subtitle}
            </span>
          )}
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[0.9rem] leading-[1.85] text-[hsl(var(--hero-muted))] md:text-[0.95rem]">
          以 AI Agent 为引擎的多家族联合投资决策辅助系统。
          <br />
          从信息输入到签约方案输出，全链路权限隔离。
        </p>
      </div>
    );
  }

  if (c.id === "capabilities") {
    return (
      <div className={`w-full ${align}`}>
        <Folio>{c.folio}</Folio>
        <h2 className="font-display text-[clamp(1.65rem,3.8vw,2.5rem)] font-semibold leading-[1.15] tracking-[0.03em] text-[hsl(var(--hero-foreground))]">
          {c.title}
        </h2>
        {c.subtitle && (
          <p className="mt-3 font-display text-[clamp(1rem,2vw,1.35rem)] tracking-[0.02em] text-[hsl(var(--wine)/0.9)]">
            {c.subtitle}
          </p>
        )}
        <p className="mt-4 text-[0.88rem] leading-[1.85] text-[hsl(var(--hero-muted))]">
          {c.body}
        </p>
        <ul className="glass-bohemian-hero mt-6 divide-y divide-[hsl(var(--hero-foreground)/0.08)] overflow-hidden">
          {CAPABILITIES.map(({ label, text }) => (
            <li
              key={label}
              className="grid gap-1 px-4 py-3.5 sm:grid-cols-[5.5rem_1fr] sm:items-center sm:gap-4 sm:px-5 sm:py-4"
            >
              <span className="font-display text-[0.72rem] tracking-[0.06em] text-[hsl(var(--wine)/0.95)]">
                {label}
              </span>
              <span className="text-[0.82rem] leading-[1.75] text-[hsl(var(--hero-foreground)/0.78)]">
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (c.id === "flow") {
    return (
      <div className={`w-full ${align}`}>
        <Folio>{c.folio}</Folio>
        <h2 className="font-display text-[clamp(1.5rem,3.2vw,2.15rem)] font-semibold leading-tight tracking-[0.03em] text-[hsl(var(--hero-foreground))]">
          {c.title}
        </h2>
        {c.subtitle && (
          <p className="mt-1.5 text-[0.8rem] text-[hsl(var(--hero-muted))]">
            {c.subtitle}
          </p>
        )}
        <ol className="mt-4">
          {PIPELINE.map(({ tag, title, desc, icon: Icon }, index) => {
            const isLast = index === PIPELINE.length - 1;
            return (
              <Fragment key={tag}>
                <li className="flex items-center gap-2.5">
                  <div
                    className="glass-bohemian-hero-circle text-[hsl(var(--wine))]"
                    style={{ width: FLOW_ICON_SIZE, height: FLOW_ICON_SIZE }}
                    aria-hidden
                  >
                    <FlowStepIcon tag={tag} icon={Icon} />
                  </div>
                  <div
                    className="glass-bohemian-hero flex min-w-0 flex-1 flex-col justify-center px-3 py-2 sm:px-3.5 sm:py-2.5"
                    style={{ minHeight: FLOW_CARD_MIN }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                      <h3 className="font-display text-[0.9rem] font-semibold leading-snug tracking-[0.02em] text-[hsl(var(--hero-foreground))]">
                        {title}
                      </h3>
                      <span
                        className="text-[hsl(var(--hero-foreground)/0.25)]"
                        aria-hidden
                      >
                        ·
                      </span>
                      <span className="font-display text-[0.58rem] tracking-[0.12em] text-[hsl(var(--terracotta)/0.88)]">
                        {tag}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.74rem] leading-[1.55] text-[hsl(var(--hero-muted))]">
                      {desc}
                    </p>
                  </div>
                </li>
                {!isLast && (
                  <li
                    className="flex gap-2.5"
                    style={{ height: FLOW_STEP_CONNECTOR }}
                    aria-hidden
                  >
                    <div
                      className="flex shrink-0 flex-col items-center justify-center"
                      style={{ width: FLOW_ICON_SIZE }}
                    >
                      <span className="w-px flex-1 bg-gradient-to-b from-[hsl(var(--wine)/0.55)] via-[hsl(var(--wine)/0.32)] to-[hsl(var(--wine)/0.12)]" />
                      <span className="mt-0.5 text-[0.5rem] leading-none text-[hsl(var(--wine)/0.7)]">
                        ↓
                      </span>
                    </div>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>
    );
  }

  if (c.id === "knowledge") {
    return (
      <div className={`w-full ${align}`}>
        <Folio>{c.folio}</Folio>
        <h2 className="font-display text-[clamp(1.65rem,3.8vw,2.45rem)] font-semibold leading-[1.2] tracking-[0.03em] text-[hsl(var(--hero-foreground))]">
          {c.title}
        </h2>
        <blockquote className="mt-6 border-l-2 border-[hsl(var(--wine)/0.5)] pl-5 font-display text-[clamp(0.95rem,1.8vw,1.2rem)] font-normal leading-[1.8] tracking-[0.02em] text-[hsl(var(--hero-foreground)/0.88)]">
          {c.body}
        </blockquote>
      </div>
    );
  }

  return (
    <div className={`max-w-md lg:max-w-lg ${align}`}>
      <Folio>{c.folio}</Folio>
      <h2 className="font-display text-[clamp(1.75rem,4vw,2.65rem)] font-semibold leading-[1.15] tracking-[0.03em] text-[hsl(var(--hero-foreground))]">
        {c.title}
      </h2>
      <p className="mt-4 text-[0.9rem] leading-[1.85] text-[hsl(var(--hero-muted))]">
        {c.body}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#contact"
          className="inline-flex rounded-sm bg-[hsl(var(--wine))] px-7 py-3 text-sm font-medium text-[hsl(var(--wine-foreground))] transition-colors hover:bg-[hsl(5_34%_40%)]"
        >
          预约产品演示
        </a>
        <button
          type="button"
          className="inline-flex rounded-sm border border-[hsl(var(--hero-foreground)/0.2)] bg-[hsl(var(--hero-foreground)/0.06)] px-7 py-3 text-sm font-medium text-[hsl(var(--hero-foreground))] backdrop-blur-sm hover:bg-[hsl(var(--hero-foreground)/0.1)]"
        >
          下载产品手册
        </button>
      </div>
    </div>
  );
}

export function LandingScrollStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const progress = useElementScrollProgress(containerRef);
  const viewport = useStageViewport(stickyRef);
  const layout = stageContentLayout(progress, viewport);
  const welcomeCentered = layout.shiftT < 0.45;

  return (
    <div
      ref={containerRef}
      className="landing-hero relative"
      style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
      id="scroll-stage"
    >
      <div
        ref={stickyRef}
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[hsl(var(--hero-bg))]"
      >
        <div className="absolute inset-0 z-0">
          <ConcentricRingsParticles
            scrollProgress={progress}
            className="h-full w-full"
          />
        </div>

        {/* 文案侧可读性渐变（不裁切粒子） */}
        <div
          className="pointer-events-none absolute z-[5]"
          style={
            layout.stackLayout
              ? {
                  inset: 0,
                  opacity:
                    Math.max(layout.shiftT, layout.flowT, layout.knowledgeT) *
                    0.92,
                  background:
                    "linear-gradient(0deg, hsl(var(--hero-bg)) 0%, hsl(var(--hero-bg) / 0.88) 38%, transparent 68%)",
                }
              : {
                  top: 0,
                  bottom: 0,
                  left: layout.textOnRight ? "auto" : 0,
                  right: layout.textOnRight ? 0 : "auto",
                  width: `${layout.textGradientWidthRatio * 100}%`,
                  opacity: Math.max(layout.shiftT, layout.flowT) * 0.95,
                  background: layout.textOnRight
                    ? "linear-gradient(270deg, hsl(var(--hero-bg)) 0%, hsl(var(--hero-bg) / 0.72) 42%, transparent 100%)"
                    : "linear-gradient(90deg, hsl(var(--hero-bg)) 0%, hsl(var(--hero-bg) / 0.72) 42%, transparent 100%)",
                }
          }
          aria-hidden
        />

        <div className="pointer-events-none absolute inset-0 z-10 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          {SCROLL_CHAPTERS.map((c) => {
            const motion = chapterMotionAt(progress, c);
            const interactive = motion.opacity > 0.2;
            const isWelcome = c.id === "welcome";
            const alignCenter = isWelcome && welcomeCentered;
            const alignRight = c.id === "flow" && layout.textOnRight;
            const stackChapter =
              layout.stackLayout &&
              (c.id === "flow" || c.id === "knowledge" || c.id === "capabilities");

            return (
              <article
                key={c.id}
                className={cn(
                  "absolute text-left",
                  alignCenter
                    ? "left-1/2 top-1/2 max-h-[min(82svh,720px)] w-full max-w-2xl overflow-y-auto px-5 text-center md:px-8"
                    : stackChapter
                      ? "bottom-[clamp(1.5rem,8vh,3.5rem)] left-0 right-0 top-auto max-h-[min(82svh,720px)] overflow-y-auto px-5 pb-2 pt-4 sm:px-6"
                      : "top-1/2 overflow-visible pr-6"
                )}
                style={{
                  ...(alignCenter
                    ? {}
                    : stackChapter
                      ? {
                          width: "100%",
                          maxWidth: "100%",
                        }
                      : alignRight
                        ? (() => {
                            const col = stageTextColumnRight(viewport);
                            return {
                              left: "auto" as const,
                              right: col.right,
                              width: col.width,
                              maxWidth: col.width,
                            };
                          })()
                        : (layout.shiftT > 0.2 ||
                            viewport.width > STAGE_BASE_WIDTH_PX) &&
                            !layout.stackLayout
                          ? (() => {
                              const col = stageTextColumnLeft(viewport);
                              return {
                                left: col.left,
                                width: col.width,
                                maxWidth: col.width,
                              };
                            })()
                          : {
                              left: CONTENT_TEXT_INSET,
                              width: CONTENT_TEXT_MAX_WIDTH,
                              maxWidth: CONTENT_TEXT_MAX_WIDTH,
                            }),
                  transform: alignCenter
                    ? `translate(calc(-50% + ${WELCOME_TEXT_OPTICAL_SHIFT_X}), calc(-50% + ${motion.translateY}px + ${WELCOME_TEXT_OPTICAL_SHIFT_Y})) scale(${motion.scale})`
                    : stackChapter
                      ? `translate3d(0, ${motion.translateY * 0.35}px, 0) scale(${motion.scale})`
                      : `translate3d(0, calc(-50% + ${motion.translateY}px - 0.5rem), 0) scale(${motion.scale})`,
                  opacity: motion.opacity,
                  filter:
                    motion.blurPx > 0.2 ? `blur(${motion.blurPx}px)` : undefined,
                  pointerEvents: interactive ? "auto" : "none",
                  willChange: "transform, opacity",
                }}
                aria-hidden={motion.opacity < 0.08}
              >
                <ChapterBody c={c} centered={alignCenter} />
              </article>
            );
          })}
        </div>

        <div
          className="absolute left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          style={{
            bottom: "clamp(0.5rem, 1.5vh, 0.875rem)",
            opacity: Math.max(0, 1 - progress * 1.15),
          }}
        >
          <span className="font-display text-[0.56rem] tracking-[0.14em] text-[hsl(var(--hero-muted)/0.75)]">
            滚动浏览
          </span>
          <span className="block h-5 w-px bg-gradient-to-b from-[hsl(var(--wine)/0.7)] to-transparent" />
        </div>
      </div>
    </div>
  );
}
