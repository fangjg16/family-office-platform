import {
  CLOUD_END,
  CLOUD_START,
  FLOW_ARC_START,
  FLOW_ARC_SWEEP,
  FLOW_ARROW_ARC_COUNT,
  FLOW_ARROW_HEAD_COUNT,
  FLOW_LOOP_BAND_RATIO,
  FLOW_LOOP_RADIUS_RATIO,
  FLOW_LOOP_ROTATION,
  RING_FORM_END,
  RING_FORM_START,
  RING_INNER_BAND_RATIO,
  RING_INNER_COUNT,
  RING_INNER_RADIUS_RATIO,
  RING_OUTER_BAND_RATIO,
  RING_OUTER_COUNT,
  RING_OUTER_RADIUS_RATIO,
  RING_ROTATION_SPEED,
  RING_SCATTER_RADIUS_RATIO,
} from "@/components/landing/concentric-rings-config";
import { speechBubbleTargetForParticle } from "@/components/landing/speech-bubble-layout";
import {
  flowChapterT,
  knowledgeChapterT,
} from "@/components/landing/scroll-stage-layout";

export type RingKind = "inner" | "outer";
export type ParticleRole = "ring" | "arrow";

export type RingParticle = {
  role: ParticleRole;
  ring: RingKind;
  scatterDx: number;
  scatterDy: number;
  targetAngle: number;
  targetRadiusRatio: number;
  /** 智库气泡云目标（相对圆心，minDim 比例） */
  bubbleTx: number;
  bubbleTy: number;
  size: number;
  opacityBase: number;
  phase: number;
  n: number;
};

const FLOW_ARROW_BASE_R =
  FLOW_LOOP_RADIUS_RATIO + FLOW_LOOP_BAND_RATIO * 0.42;

export type ParticleMotion = {
  /** 1 = 同心圆，0 = 散落/云 */
  ringT: number;
  /** 1 = 平台能力式大疏散云 */
  cloudT: number;
  /** 1 = 端到端：粗圆环循环 */
  flowLoopT: number;
  /** 1 = 智库对话气泡云 */
  bubbleT: number;
  scatterScale: number;
};

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function seeded01(n: number, salt = 0): number {
  const x = Math.sin((n + salt) * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 开屏自动收束进度 0→1（由 Canvas 按帧累加，不随滚动重置） */
export function introRingT(introFormProgress: number): number {
  return Math.min(1, Math.max(0, introFormProgress)) * 0.92;
}

/** 仅由滚动进度决定的环形态（不含开屏时间轴） */
export function scrollRingT(scrollProgress: number): number {
  if (scrollProgress <= RING_FORM_START) {
    return 0;
  }
  if (scrollProgress < RING_FORM_END) {
    return smoothstep(
      (scrollProgress - RING_FORM_START) / (RING_FORM_END - RING_FORM_START)
    );
  }
  if (scrollProgress < CLOUD_START) {
    return 1;
  }
  if (scrollProgress < CLOUD_END) {
    const dissolve = smoothstep(
      (scrollProgress - CLOUD_START) / (CLOUD_END - CLOUD_START)
    );
    return 1 - dissolve;
  }
  return 0;
}

/**
 * 滚动驱动的粒子形态（欢迎收束 / 能力章疏散）
 * @param introFormProgress 开屏自动收束 0→1；与滚动取 max，避免滚动时粒子「从头散开」
 */
export function particleMotionAt(
  scrollProgress: number,
  introFormProgress = 0
): ParticleMotion {
  const introT = introRingT(introFormProgress);
  const fromScroll = scrollRingT(scrollProgress);

  /** 进入云状疏散前：开屏进度与滚动进度取高，保证中断开屏动画时从当前形态继续 */
  let ringT =
    scrollProgress < CLOUD_START
      ? Math.max(fromScroll, introT)
      : fromScroll;

  let cloudT = 0;
  if (scrollProgress >= CLOUD_START) {
    cloudT = smoothstep(
      (scrollProgress - CLOUD_START) / (CLOUD_END - CLOUD_START)
    );
  }

  const flowT = flowChapterT(scrollProgress);
  const bubbleT = knowledgeChapterT(scrollProgress);

  /** 云状与空心环交叉淡出，避免一切入 flow 就瞬间收云 */
  const cloudFade = 1 - smoothstep(flowT);
  let cloudTAdj = cloudT * cloudFade * (1 - bubbleT * 0.95);
  let ringTAdj = ringT;
  if (flowT > 0) {
    ringTAdj = lerp(ringT, 1, smoothstep(flowT) * 0.72);
  }
  ringTAdj *= 1 - bubbleT * 0.88;
  const flowLoopAdj = flowT * (1 - bubbleT);

  const scatterScale = lerp(1, 1.52, cloudTAdj) * (1 - bubbleT * 0.2);

  return {
    ringT: ringTAdj,
    cloudT: cloudTAdj,
    flowLoopT: flowLoopAdj,
    bubbleT,
    scatterScale,
  };
}

export type RingBuildOptions = {
  scatterRatio?: number;
};

export function buildRingParticles(
  minDim: number,
  options: RingBuildOptions = {}
): RingParticle[] {
  const particles: RingParticle[] = [];
  const scatterR =
    minDim * RING_SCATTER_RADIUS_RATIO * (options.scatterRatio ?? 1);

  function addScatter(index: number, salt: number) {
    const a = seeded01(index, salt) * Math.PI * 2;
    const dist = Math.sqrt(seeded01(index, salt + 1)) * scatterR;
    const squash = 0.82 + seeded01(index, salt + 2) * 0.28;
    return {
      scatterDx: Math.cos(a) * dist,
      scatterDy: Math.sin(a) * dist * squash,
    };
  }

  for (let i = 0; i < RING_INNER_COUNT; i++) {
    const angle =
      (i / RING_INNER_COUNT) * Math.PI * 2 +
      (seeded01(i, 10) - 0.5) * 0.08;
    const radiusRatio =
      RING_INNER_RADIUS_RATIO +
      (seeded01(i, 11) - 0.5) * RING_INNER_BAND_RATIO;
    const { scatterDx, scatterDy } = addScatter(i, 20);
    const { bubbleTx, bubbleTy } = speechBubbleTargetForParticle(i);
    particles.push({
      role: "ring",
      n: i,
      ring: "inner",
      scatterDx,
      scatterDy,
      bubbleTx,
      bubbleTy,
      targetAngle: angle,
      targetRadiusRatio: radiusRatio,
      size: 1.1 + seeded01(i, 12) * 1.4,
      opacityBase: 0.55 + seeded01(i, 13) * 0.4,
      phase: seeded01(i, 14) * Math.PI * 2,
    });
  }

  for (let i = 0; i < RING_OUTER_COUNT; i++) {
    const angle =
      (i / RING_OUTER_COUNT) * Math.PI * 2 +
      (seeded01(i, 30) - 0.5) * 0.35;
    const radiusRatio =
      RING_OUTER_RADIUS_RATIO +
      (seeded01(i, 31) - 0.5) * RING_OUTER_BAND_RATIO;
    const { scatterDx, scatterDy } = addScatter(RING_INNER_COUNT + i, 40);
    const n = RING_INNER_COUNT + i;
    const { bubbleTx, bubbleTy } = speechBubbleTargetForParticle(n);
    particles.push({
      role: "ring",
      n,
      ring: "outer",
      scatterDx,
      scatterDy,
      bubbleTx,
      bubbleTy,
      targetAngle: angle,
      targetRadiusRatio: radiusRatio,
      size: 0.9 + seeded01(i, 32) * 1.2,
      opacityBase: 0.35 + seeded01(i, 33) * 0.35,
      phase: seeded01(i, 34) * Math.PI * 2,
    });
  }

  return particles;
}

/** 循环箭头：弧段 + 箭头尖端，全部由粒子组成 */
export function buildFlowArrowParticles(): RingParticle[] {
  const particles: RingParticle[] = [];
  let idx = 0;

  for (let i = 0; i < FLOW_ARROW_ARC_COUNT; i++) {
    const t = i / Math.max(1, FLOW_ARROW_ARC_COUNT - 1);
    const angle =
      FLOW_ARC_START +
      FLOW_ARC_SWEEP * t +
      (seeded01(i, 200) - 0.5) * 0.04;
    const radiusRatio =
      FLOW_ARROW_BASE_R + (seeded01(i, 201) - 0.5) * 0.018;
    particles.push({
      role: "arrow",
      n: 20000 + idx++,
      ring: "outer",
      scatterDx: 0,
      scatterDy: 0,
      bubbleTx: 0,
      bubbleTy: 0,
      targetAngle: angle,
      targetRadiusRatio: radiusRatio,
      size: 1.35 + seeded01(i, 202) * 1.1,
      opacityBase: 0.72 + seeded01(i, 203) * 0.28,
      phase: seeded01(i, 204) * Math.PI * 2,
    });
  }

  const tipAngle = FLOW_ARC_START + FLOW_ARC_SWEEP;
  const headPerWing = Math.floor(FLOW_ARROW_HEAD_COUNT / 2);

  for (let wing = 0; wing < 2; wing++) {
    const sign = wing === 0 ? 1 : -1;
    for (let i = 0; i < headPerWing; i++) {
      const t = i / Math.max(1, headPerWing - 1);
      const wingAngle = tipAngle + sign * (0.18 + t * 0.42);
      const radiusRatio = FLOW_ARROW_BASE_R - t * 0.045;
      particles.push({
        role: "arrow",
        n: 21000 + idx++,
        ring: "outer",
        scatterDx: 0,
        scatterDy: 0,
        bubbleTx: 0,
        bubbleTy: 0,
        targetAngle: wingAngle,
        targetRadiusRatio: radiusRatio,
        size: 1.5 + seeded01(i, 210 + wing) * 1.2,
        opacityBase: 0.8 + seeded01(i, 212 + wing) * 0.2,
        phase: seeded01(i, 214 + wing) * Math.PI * 2,
      });
    }
  }

  for (let i = 0; i < 6; i++) {
    const angle = tipAngle + (seeded01(i, 220) - 0.5) * 0.12;
    particles.push({
      role: "arrow",
      n: 22000 + idx++,
      ring: "outer",
      scatterDx: 0,
      scatterDy: 0,
      bubbleTx: 0,
      bubbleTy: 0,
      targetAngle: angle,
      targetRadiusRatio: FLOW_ARROW_BASE_R + seeded01(i, 221) * 0.01,
      size: 2 + seeded01(i, 222) * 0.8,
      opacityBase: 0.95,
      phase: seeded01(i, 223) * Math.PI * 2,
    });
  }

  return particles;
}

/** 箭头粒子：始终在环轨上，随环旋转 */
export function flowArrowParticlePosition(
  p: RingParticle,
  cx: number,
  cy: number,
  minDim: number,
  time: number
): { x: number; y: number } {
  const breathe = 1 + 0.01 * Math.sin(time * 1.6 + p.phase);
  const angle = p.targetAngle + time * FLOW_LOOP_ROTATION;
  const r = p.targetRadiusRatio * minDim * breathe;
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

export function particlePosition(
  p: RingParticle,
  cx: number,
  cy: number,
  minDim: number,
  motion: ParticleMotion,
  time: number
): { x: number; y: number } {
  if (p.role === "arrow") {
    return flowArrowParticlePosition(p, cx, cy, minDim, time);
  }

  const { ringT, cloudT, flowLoopT, bubbleT, scatterScale } = motion;

  const breathe = 1 + 0.012 * Math.sin(time * 1.4 + p.phase);
  const angle = p.targetAngle + ringT * time * RING_ROTATION_SPEED;
  const radius = p.targetRadiusRatio * minDim * breathe;

  const ringX = cx + Math.cos(angle) * radius;
  const ringY = cy + Math.sin(angle) * radius;

  const scatterJitter =
    (1 - ringT) *
    (Math.sin(time * 0.9 + p.phase) * 8 + Math.cos(time * 1.1 + p.phase * 2) * 6);

  const sx = cx + p.scatterDx * scatterScale + scatterJitter * 0.35;
  const sy = cy + p.scatterDy * scatterScale + scatterJitter * 0.35;

  const ease = ringT * ringT * (3 - 2 * ringT);
  let x = sx + (ringX - sx) * ease;
  let y = sy + (ringY - sy) * ease;

  if (flowLoopT > 0.001) {
    const loopAngle = p.targetAngle + time * FLOW_LOOP_ROTATION;
    const loopR =
      FLOW_LOOP_RADIUS_RATIO * minDim +
      (seeded01(p.n, 88) - 0.5) * FLOW_LOOP_BAND_RATIO * minDim;
    const loopX = cx + Math.cos(loopAngle) * loopR;
    const loopY = cy + Math.sin(loopAngle) * loopR;
    const ft = smoothstep(smoothstep(flowLoopT));
    x = x + (loopX - x) * ft;
    y = y + (loopY - y) * ft;
  }

  if (cloudT > 0.001) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const push =
      cloudT *
      minDim *
      (0.1 + seeded01(p.n, 50) * 0.22) *
      (p.ring === "outer" ? 1.15 : 0.85);
    x += (dx / dist) * push;
    y += (dy / dist) * push * 0.88;

    const driftX = Math.sin(time * 0.55 + p.phase) * cloudT * 10;
    const driftY = Math.cos(time * 0.45 + p.phase * 1.3) * cloudT * 8;
    x += driftX;
    y += driftY;
  }

  if (bubbleT > 0.001) {
    const bx = cx + p.bubbleTx * minDim;
    const by = cy + p.bubbleTy * minDim;
    const bt = smoothstep(smoothstep(bubbleT));
    x = x + (bx - x) * bt;
    y = y + (by - y) * bt;
    const float = bubbleT * (1 - bt * 0.5) * 0.35;
    x += Math.sin(time * 0.55 + p.phase) * float * 2.5;
    y += Math.cos(time * 0.5 + p.phase * 1.1) * float * 2;
  }

  return { x, y };
}
