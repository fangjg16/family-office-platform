import { RING_TOTAL } from "@/components/landing/concentric-rings-config";

function seeded01(n: number, salt = 0): number {
  const x = Math.sin((n + salt) * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 唯一主气泡：相对粒子圆心，minDim 比例 */
const MAIN_BUBBLE = {
  x: 0.1,
  y: 0.01,
  halfW: 0.42,
  halfH: 0.2,
} as const;

/** 超椭圆近似（Lamé / squircle）：对角略鼓，比几何圆更「自然」— 见 design/optical-alignment.md §六 */
function squarishMap(nx: number, ny: number): { px: number; py: number } {
  const exp = 3.4;
  return {
    px: Math.sign(nx) * Math.pow(Math.abs(nx), 2 / exp),
    py: Math.sign(ny) * Math.pow(Math.abs(ny), 2 / exp),
  };
}

function sampleBubbleBody(
  seed: number,
  edgeBias: number
): { tx: number; ty: number } {
  const onEdge = seeded01(seed, 310) < edgeBias;
  const r = onEdge
    ? 0.9 + seeded01(seed, 311) * 0.1
    : Math.sqrt(seeded01(seed, 311)) * 0.76;
  const angle = seeded01(seed, 312) * Math.PI * 2;
  const { px, py } = squarishMap(Math.cos(angle) * r, Math.sin(angle) * r);
  const jitter = onEdge ? 0.01 : 0.022;
  const b = MAIN_BUBBLE;
  return {
    tx: b.x + px * b.halfW + (seeded01(seed, 313) - 0.5) * jitter,
    ty: b.y + py * b.halfH + (seeded01(seed, 314) - 0.5) * jitter,
  };
}

/** 尾巴指向左下（文案侧） */
function sampleTail(seed: number): { tx: number; ty: number } {
  const b = MAIN_BUBBLE;
  const tipX = b.x - b.halfW * 0.58;
  const tipY = b.y + b.halfH + 0.058;
  const blX = b.x - b.halfW * 0.34;
  const blY = b.y + b.halfH * 0.52;
  const brX = b.x - b.halfW * 0.04;
  const brY = b.y + b.halfH * 0.6;

  const u = seeded01(seed, 320);
  const v = seeded01(seed, 321);
  const w0 = 1 - u;
  const w1 = u * (1 - v);
  const w2 = u * v;
  const wSum = w0 + w1 + w2;
  return {
    tx: (tipX * w0 + blX * w1 + brX * w2) / wSum,
    ty: (tipY * w0 + blY * w1 + brY * w2) / wSum,
  };
}

function sampleRim(seed: number): { tx: number; ty: number } {
  const b = MAIN_BUBBLE;
  const angle = seeded01(seed, 330) * Math.PI * 2;
  const r = 0.965 + seeded01(seed, 331) * 0.035;
  const { px, py } = squarishMap(Math.cos(angle) * r, Math.sin(angle) * r);
  return {
    tx: b.x + px * b.halfW,
    ty: b.y + py * b.halfH,
  };
}

function toTarget(p: { tx: number; ty: number }): {
  bubbleTx: number;
  bubbleTy: number;
} {
  return { bubbleTx: p.tx, bubbleTy: p.ty };
}

/** 单一大对话气泡 💬 */
export function speechBubbleTargetForParticle(
  particleIndex: number
): { bubbleTx: number; bubbleTy: number } {
  const slot = particleIndex / RING_TOTAL;

  if (slot < 0.12) {
    return toTarget(sampleTail(particleIndex));
  }
  if (slot < 0.72) {
    return toTarget(sampleBubbleBody(particleIndex, 0.56));
  }
  return toTarget(sampleRim(particleIndex));
}
