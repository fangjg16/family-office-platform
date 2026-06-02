/** 统一版式：粒子铺满视口，圆心 / 文案锚点随章节与视口平滑过渡 */

import {
  BUBBLE_END,
  BUBBLE_ENTER,
  BUBBLE_EXIT,
  BUBBLE_START,
  FLOW_LOOP_END,
  FLOW_LOOP_ENTER,
  FLOW_LOOP_EXIT,
  FLOW_LOOP_START,
} from "@/components/landing/concentric-rings-config";

const SHIFT_START = 0.14;
const SHIFT_END = 0.28;

/**
 * 开屏光学对齐 — 见 design/optical-alignment.md
 *
 * 要点（Gestalt）：
 * - 圆环：曲线容器视觉更“轻”，环心常略低于 50%
 * - 文案：大标题 cap 区抬高视觉重心，整块几何中心宜略下移与之咬合
 * - 水平：环/文可分别微补偿 X，勿假设同一 translate 能解决
 * - 滚动：shiftT 增大时 lerp 回分屏版式，光学偏移仅作用于欢迎段
 */
const WELCOME_PARTICLE_OPTICAL_Y = 0.503;
const WELCOME_PARTICLE_OPTICAL_X = 0.498;
export const WELCOME_TEXT_OPTICAL_SHIFT_Y = "0.38vh";
export const WELCOME_TEXT_OPTICAL_SHIFT_X = "-0.08vw";

/** 1440 笔记本设计基准（88rem） */
export const STAGE_BASE_WIDTH_PX = 1408;
/** 超宽屏内容上限（108rem）— 1920 下约 1680，更铺满 */
export const STAGE_ULTRA_MAX_WIDTH_PX = 1728;
/** 超宽屏单侧留白封顶（240px = 2 × 120） */
export const STAGE_MARGIN_CAP_PX = 120;

/** @deprecated 使用 stageContentWidth() */
export const STAGE_MAX_WIDTH_PX = STAGE_BASE_WIDTH_PX;

/**
 * 内容区宽度：≤1408 全宽/基准；超宽屏边距封顶 120px 并随视口加宽，上限 1728。
 * 1440 → 1408 | 1920 → 1680 | 2560+ → 1728（居中）
 */
export function stageContentWidth(viewportWidth: number): number {
  if (viewportWidth <= STAGE_BASE_WIDTH_PX) {
    return viewportWidth;
  }
  const expanded = viewportWidth - 2 * STAGE_MARGIN_CAP_PX;
  return Math.min(
    Math.max(STAGE_BASE_WIDTH_PX, expanded),
    STAGE_ULTRA_MAX_WIDTH_PX
  );
}

export const CONTENT_TEXT_INSET = "clamp(1.25rem, 7.5vw, 5.75rem)";
export const CONTENT_TEXT_MAX_WIDTH =
  "min(42rem, calc(min(min(1728px, max(88rem, calc(100vw - 240px))), 100vw) * 0.46))";

export type StageContentBox = {
  marginX: number;
  contentWidth: number;
  insetPx: number;
  textColumnWidth: number;
};

export function stageContentBox(viewportWidth: number): StageContentBox {
  const contentWidth = stageContentWidth(viewportWidth);
  const marginX = Math.max(0, (viewportWidth - contentWidth) / 2);
  const ultraWide = contentWidth > STAGE_BASE_WIDTH_PX;
  const insetPx = Math.min(
    Math.max(viewportWidth * 0.075, 36),
    ultraWide ? 104 : 92
  );
  const textColumnWidth = Math.min(ultraWide ? 672 : 576, contentWidth * 0.46);
  return { marginX, contentWidth, insetPx, textColumnWidth };
}

export function stageTextColumnRight(viewport: StageViewport): {
  right: number;
  width: number;
} {
  const box = stageContentBox(viewport.width);
  return {
    right: box.marginX + box.insetPx,
    width: box.textColumnWidth,
  };
}

export function stageTextColumnLeft(viewport: StageViewport): {
  left: number;
  width: number;
} {
  const box = stageContentBox(viewport.width);
  return {
    left: box.marginX + box.insetPx,
    width: box.textColumnWidth,
  };
}

export type StageViewport = {
  width: number;
  height: number;
};

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0 = 宽屏，1 = 窄屏（用于粒子偏置、文案叠放） */
export function viewportNarrowT(width: number): number {
  if (width >= 960) return 0;
  if (width <= 520) return 1;
  return smoothstep((960 - width) / (960 - 520));
}

/** 智库章：对话气泡云权重 0→1（含淡入淡出） */
export function knowledgeChapterT(progress: number): number {
  if (progress <= BUBBLE_ENTER || progress >= BUBBLE_EXIT) return 0;
  if (progress < BUBBLE_START) {
    return smoothstep(
      (progress - BUBBLE_ENTER) / (BUBBLE_START - BUBBLE_ENTER)
    );
  }
  if (progress > BUBBLE_END) {
    return 1 - smoothstep(
      (progress - BUBBLE_END) / (BUBBLE_EXIT - BUBBLE_END)
    );
  }
  return 1;
}

/** 端到端链路章权重 0→1（含淡入淡出） */
export function flowChapterT(progress: number): number {
  if (progress <= FLOW_LOOP_ENTER || progress >= FLOW_LOOP_EXIT) return 0;
  if (progress < FLOW_LOOP_START) {
    return smoothstep(
      (progress - FLOW_LOOP_ENTER) / (FLOW_LOOP_START - FLOW_LOOP_ENTER)
    );
  }
  if (progress > FLOW_LOOP_END) {
    return 1 - smoothstep(
      (progress - FLOW_LOOP_END) / (FLOW_LOOP_EXIT - FLOW_LOOP_END)
    );
  }
  return 1;
}

export type StageContentLayout = {
  shiftT: number;
  flowT: number;
  knowledgeT: number;
  narrowT: number;
  /** 窄屏：文案与粒子上下叠放，粒子偏上 */
  stackLayout: boolean;
  particleCenterX: number;
  particleCenterY: number;
  particleScale: number;
  textGradientWidthRatio: number;
  textOnRight: boolean;
};

function responsiveParticleAnchor(
  x: number,
  y: number,
  narrowT: number,
  flowT: number,
  knowledgeT: number,
  shiftT: number
): { x: number; y: number } {
  if (narrowT <= 0.001) return { x, y };

  if (flowT > 0.35) {
    return {
      x: lerp(x, 0.22, narrowT),
      y: lerp(y, 0.4, narrowT * 0.85),
    };
  }
  if (knowledgeT > 0.35) {
    return {
      x: lerp(x, 0.56, narrowT),
      y: lerp(y, 0.33, narrowT),
    };
  }
  if (shiftT > 0.35) {
    return {
      x: lerp(x, 0.78, narrowT),
      y: lerp(y, 0.48, narrowT * 0.5),
    };
  }
  return { x, y };
}

export function stageContentLayout(
  progress: number,
  viewport: StageViewport = { width: 1200, height: 800 }
): StageContentLayout {
  const narrowT = viewportNarrowT(viewport.width);
  const stackLayout = narrowT > 0.55;

  let shiftT = 0;
  if (progress >= SHIFT_END) shiftT = 1;
  else if (progress > SHIFT_START) {
    shiftT = smoothstep((progress - SHIFT_START) / (SHIFT_END - SHIFT_START));
  }

  const flowT = flowChapterT(progress);
  const knowledgeT = knowledgeChapterT(progress);
  const baseCenterX = lerp(0.5, 0.68, shiftT);

  let particleCenterX = lerp(
    lerp(baseCenterX, 0.26, flowT),
    0.75,
    knowledgeT
  );
  if (flowT < 0.05 && knowledgeT < 0.05) {
    particleCenterX = lerp(WELCOME_PARTICLE_OPTICAL_X, particleCenterX, shiftT);
  }
  let particleCenterY = lerp(WELCOME_PARTICLE_OPTICAL_Y, 0.5, shiftT);
  const anchored = responsiveParticleAnchor(
    particleCenterX,
    particleCenterY,
    narrowT,
    flowT,
    knowledgeT,
    shiftT
  );
  particleCenterX = anchored.x;
  particleCenterY = anchored.y;

  const scaleNarrow = 1 - narrowT * (flowT > 0.35 || knowledgeT > 0.35 ? 0.14 : 0.08);

  return {
    shiftT,
    flowT,
    knowledgeT,
    narrowT,
    stackLayout,
    particleCenterX,
    particleCenterY,
    particleScale: lerp(1, 0.98, shiftT) * scaleNarrow,
    textGradientWidthRatio: lerp(
      0,
      stackLayout ? 1 : narrowT > 0.12 ? 0.58 : 0.52,
      Math.max(shiftT, flowT * 0.9, knowledgeT * 0.85)
    ),
    textOnRight: flowT > 0.35 && !stackLayout,
  };
}

export type LayoutCrossfade = { center: number; split: number };

export function layoutCrossfade(progress: number): LayoutCrossfade {
  const t = stageContentLayout(progress).shiftT;
  return { center: 1 - t, split: t };
}

export type ParticleViewport = { cx: number; cy: number; minDim: number };

/** 桌面：粒子圆心对齐内容网格（随超宽屏流体加宽） */
function particleCxInContentBox(
  width: number,
  layout: StageContentLayout
): number {
  if (layout.narrowT > 0.12) {
    return width * layout.particleCenterX;
  }

  const { marginX, contentWidth } = stageContentBox(width);

  if (layout.flowT > 0.35) {
    return marginX + contentWidth * 0.22;
  }
  if (layout.knowledgeT > 0.35) {
    return marginX + contentWidth * 0.68;
  }
  if (layout.shiftT > 0.35) {
    return marginX + contentWidth * 0.74;
  }
  return marginX + contentWidth * layout.particleCenterX;
}

export function particleViewportFromLayout(
  width: number,
  height: number,
  layout: StageContentLayout
): ParticleViewport {
  return {
    cx: particleCxInContentBox(width, layout),
    cy: height * layout.particleCenterY,
    minDim: Math.min(width, height) * layout.particleScale,
  };
}
