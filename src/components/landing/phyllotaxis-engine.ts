/** 波西米亚配色 · 黄金角螺旋粒子 */
import {
  PHYLLO_CENTER_X,
  PHYLLO_CENTER_Y,
} from "@/components/landing/phyllotaxis-config";

export const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);

export type RGB = { r: number; g: number; b: number };

export type PhyllotaxisPoint = {
  n: number;
  baseAngle: number;
  baseRadius: number;
  color: RGB;
  birth: number;
  opacity: number;
};

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function getColor(index: number, palette: RGB[]): RGB {
  const cycle = (index * 0.015) % palette.length;
  const segment = Math.floor(cycle);
  const t = cycle - segment;
  const from = palette[segment % palette.length]!;
  const to = palette[(segment + 1) % palette.length]!;
  return lerpColor(from, to, t);
}

/** r ∝ √(n+n0)−√n0：中心空洞；外圈为黄金角螺旋盘 */
export function phyllotaxisRadius(n: number, spread: number, innerSkip: number): number {
  const inner = Math.sqrt(innerSkip);
  return spread * (Math.sqrt(n + innerSkip) - inner);
}

export function createPhyllotaxisPoint(
  n: number,
  spread: number,
  innerSkip: number,
  palette: RGB[],
  birth: number
): PhyllotaxisPoint {
  return {
    n,
    baseAngle: n * GOLDEN_ANGLE,
    baseRadius: phyllotaxisRadius(n, spread, innerSkip),
    color: getColor(n, palette),
    birth,
    opacity: 0,
  };
}

export type ScrollMotion = {
  centerYRatio: number;
  centerXRatio: number;
};

/** 滚动只切换文案，粒子中心固定偏下 */
export function scrollMotionFromProgress(_progress: number): ScrollMotion {
  return {
    centerYRatio: PHYLLO_CENTER_Y,
    centerXRatio: PHYLLO_CENTER_X,
  };
}
