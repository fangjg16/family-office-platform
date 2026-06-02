/** 粒子形态：散落 → 同心圆 → 云状疏散 */

export const RING_INNER_COUNT = 620;
export const RING_OUTER_COUNT = 280;
export const RING_TOTAL = RING_INNER_COUNT + RING_OUTER_COUNT;

export const RING_INNER_RADIUS_RATIO = 0.28;
export const RING_INNER_BAND_RATIO = 0.042;
export const RING_OUTER_RADIUS_RATIO = 0.47;
export const RING_OUTER_BAND_RATIO = 0.11;
export const RING_SCATTER_RADIUS_RATIO = 0.62;

/** 欢迎段：散落 → 同心圆 */
export const RING_FORM_START = 0.02;
export const RING_FORM_END = 0.17;

/** 平台能力段：同心圆 → 云状疏散 */
export const CLOUD_START = 0.19;
export const CLOUD_END = 0.34;

/** 开屏无滚动时，约 4s 内自动演示收束 */
export const AUTO_FORM_SECONDS = 4.2;

export const RING_ROTATION_SPEED = 0.022;

/** 端到端链路章：粗圆环 + 循环箭头（进入段拉长，云→空心环更慢） */
export const FLOW_LOOP_ENTER = 0.34;
export const FLOW_LOOP_START = 0.5;
export const FLOW_LOOP_END = 0.58;
export const FLOW_LOOP_EXIT = 0.64;

export const FLOW_LOOP_RADIUS_RATIO = 0.34;
export const FLOW_LOOP_BAND_RATIO = 0.1;
export const FLOW_LOOP_ROTATION = 0.016;

/** 箭头弧：粒子沿此角度区间排布 */
export const FLOW_ARC_START = -Math.PI * 0.35;
export const FLOW_ARC_SWEEP = Math.PI * 1.45;
export const FLOW_ARROW_ARC_COUNT = 78;
export const FLOW_ARROW_HEAD_COUNT = 28;

/** 智库章：对话气泡云 */
export const BUBBLE_ENTER = 0.58;
export const BUBBLE_START = 0.64;
export const BUBBLE_END = 0.78;
export const BUBBLE_EXIT = 0.82;
