/** 与 phyllotaxis.html（500 粒子 / Mono）对齐的参数 */

export const PHYLLO_MAX_POINTS = 500;
/** 略大于 HTML 0.0065，使盘区更接近图二满屏比例 */
export const PHYLLO_SPREAD_RATIO = 0.0092;
/** 跳过中心序号，形成图二式「中心空洞 + 外圈密、外缘疏」 */
export const PHYLLO_INNER_SKIP = 32;
/** 螺旋中心在视口偏下，文案在上方，避免「粒子围字成环」 */
export const PHYLLO_CENTER_X = 0.5;
export const PHYLLO_CENTER_Y = 0.64;
export const PHYLLO_GROW_FAST_UNTIL = 200;
export const PHYLLO_FADE_IN_FRAMES = 40;
export const PHYLLO_CONNECTION_FADE_FRAMES = 60;
/** 中心光晕半径（过大易糊成实心圆） */
export const PHYLLO_GLOW_RADIUS = 48;

/** 原 HTML 暖色盘（canvas 上使用 grayscale 呈现 Mono） */
export const PHYLLO_COLORS = [
  { r: 200, g: 149, b: 108 },
  { r: 212, g: 165, b: 116 },
  { r: 224, g: 120, b: 80 },
] as const;

export const PHYLLO_STRIDES = [1, 8, 13, 21] as const;
