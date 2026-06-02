import type { ScrollChapter } from "@/components/landing/landing-content";

/** 每章头尾用于淡入淡出 + 位移的占比（与 Lightweight 式滚动叙事接近） */
const FADE_EDGE = 0.22;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export type ChapterMotion = {
  opacity: number;
  translateY: number;
  scale: number;
  blurPx: number;
};

export function chapterMotionAt(
  progress: number,
  chapter: ScrollChapter
): ChapterMotion {
  const span = chapter.end - chapter.start;
  const local = (progress - chapter.start) / span;

  if (local < 0) {
    return { opacity: 0, translateY: 88, scale: 0.94, blurPx: 8 };
  }
  if (local >= 1) {
    return { opacity: 0, translateY: -72, scale: 0.96, blurPx: 8 };
  }

  if (local > 1 - FADE_EDGE) {
    const t = smoothstep((local - (1 - FADE_EDGE)) / FADE_EDGE);
    return {
      opacity: 1 - t,
      translateY: -t * 72,
      scale: 1 - 0.04 * t,
      blurPx: t * 8,
    };
  }

  /** 首屏欢迎章：打开页面即显示，不从透明淡入 */
  if (chapter.id === "welcome") {
    return { opacity: 1, translateY: 0, scale: 1, blurPx: 0 };
  }

  if (local < FADE_EDGE) {
    const t = smoothstep(local / FADE_EDGE);
    return {
      opacity: t,
      translateY: (1 - t) * 88,
      scale: 0.94 + 0.06 * t,
      blurPx: (1 - t) * 8,
    };
  }

  return { opacity: 1, translateY: 0, scale: 1, blurPx: 0 };
}
