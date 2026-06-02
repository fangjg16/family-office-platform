import { useEffect, useRef } from "react";
import {
  createPhyllotaxisPoint,
  type PhyllotaxisPoint,
  scrollMotionFromProgress,
} from "@/components/landing/phyllotaxis-engine";
import {
  PHYLLO_COLORS,
  PHYLLO_CONNECTION_FADE_FRAMES,
  PHYLLO_FADE_IN_FRAMES,
  PHYLLO_GLOW_RADIUS,
  PHYLLO_GROW_FAST_UNTIL,
  PHYLLO_INNER_SKIP,
  PHYLLO_MAX_POINTS,
  PHYLLO_SPREAD_RATIO,
  PHYLLO_STRIDES,
} from "@/components/landing/phyllotaxis-config";

type Props = {
  scrollProgress: number;
  /** 浅色章节时晕影略浅 */
  lightBackground?: boolean;
  className?: string;
};

export function PhyllotaxisParticles({
  scrollProgress,
  lightBackground = false,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(scrollProgress);
  const lightRef = useRef(lightBackground);
  const tiltRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ down: false, lastX: 0, lastY: 0 });

  scrollRef.current = scrollProgress;
  lightRef.current = lightBackground;

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx2d = canvasEl.getContext("2d");
    if (!ctx2d) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctx2d;

    let width = 0;
    let height = 0;
    let cx = 0;
    let cy = 0;
    let dpr = 1;
    let spread = 6;
    let points: PhyllotaxisPoint[] = [];
    let pointIndex = 0;
    let globalTime = 0;
    let raf = 0;

    const palette = [...PHYLLO_COLORS];

    function resetGrowth() {
      points = [];
      pointIndex = 0;
      globalTime = 0;
    }

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = window.devicePixelRatio || 1;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spread = Math.min(width, height) * PHYLLO_SPREAD_RATIO;
      resetGrowth();
    }

    function addPoint() {
      points.push(
        createPhyllotaxisPoint(
          pointIndex,
          spread,
          PHYLLO_INNER_SKIP,
          palette,
          globalTime
        )
      );
      pointIndex++;
    }

    function drawGlow(time: number) {
      const pulseIntensity = 0.25 + 0.1 * Math.sin(time * 1.5);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, PHYLLO_GLOW_RADIUS);
      g.addColorStop(0, `rgba(200, 149, 108, ${pulseIntensity * 0.18})`);
      g.addColorStop(0.5, `rgba(212, 165, 116, ${pulseIntensity * 0.06})`);
      g.addColorStop(1, "rgba(224, 120, 80, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, PHYLLO_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawConnections(time: number, rotation: number) {
      const len = points.length;
      if (len < 2) return;
      ctx.lineWidth = 0.5;
      const tiltX = tiltRef.current.x;
      const tiltY = tiltRef.current.y;
      const cXt = Math.cos(tiltX);
      const cYt = Math.cos(tiltY);
      const sYt = Math.sin(tiltX);
      const sXt = Math.sin(-tiltY);

      for (let s = 0; s < PHYLLO_STRIDES.length; s++) {
        const stride = PHYLLO_STRIDES[s]!;
        const baseAlpha = s === 0 ? 0.06 : s === 1 ? 0.04 : 0.025;

        for (let i = 0; i < len - stride; i++) {
          const p1 = points[i]!;
          const p2 = points[i + stride]!;
          const age1 = globalTime - p1.birth;
          const age2 = globalTime - p2.birth;
          const fadeIn1 = Math.min(1, age1 / PHYLLO_CONNECTION_FADE_FRAMES);
          const fadeIn2 = Math.min(1, age2 / PHYLLO_CONNECTION_FADE_FRAMES);
          if (fadeIn1 < 0.1 || fadeIn2 < 0.1) continue;

          const pulse1 = 1 + 0.08 * Math.sin(time * 2 + p1.n * 0.1);
          const pulse2 = 1 + 0.08 * Math.sin(time * 2 + p2.n * 0.1);
          const r1 = p1.baseRadius * pulse1;
          const r2 = p2.baseRadius * pulse2;
          const a1 = p1.baseAngle + rotation;
          const a2 = p2.baseAngle + rotation;

          const fx1 = Math.cos(a1) * r1;
          const fy1 = Math.sin(a1) * r1;
          const z1 = fx1 * sYt + fy1 * sXt;
          const p1p = 1 + z1 * 0.0008;
          const x1 = cx + fx1 * cXt * p1p;
          const y1 = cy + fy1 * cYt * p1p;

          const fx2 = Math.cos(a2) * r2;
          const fy2 = Math.sin(a2) * r2;
          const z2 = fx2 * sYt + fy2 * sXt;
          const p2p = 1 + z2 * 0.0008;
          const x2 = cx + fx2 * cXt * p2p;
          const y2 = cy + fy2 * cYt * p2p;

          const dist = Math.hypot(x2 - x1, y2 - y1);
          if (dist > 80) continue;
          const distAlpha = Math.max(0, 1 - dist / 80);
          const alpha =
            baseAlpha * distAlpha * fadeIn1 * fadeIn2 * p1.opacity * p2.opacity;
          if (alpha < 0.003) continue;

          const col = p1.color;
          ctx.strokeStyle = `rgba(${col.r | 0}, ${col.g | 0}, ${col.b | 0}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    function draw(timestamp: number) {
      const time = timestamp / 1000;
      globalTime++;

      const motion = scrollMotionFromProgress(scrollRef.current);
      const light = lightRef.current;

      ctx.clearRect(0, 0, width, height);

      const rotation = time * 0.02;
      cx = width * motion.centerXRatio;
      cy = height * motion.centerYRatio;

      const pointsToAdd = pointIndex < PHYLLO_GROW_FAST_UNTIL ? 2 : 1;
      for (let i = 0; i < pointsToAdd; i++) {
        if (pointIndex < PHYLLO_MAX_POINTS) {
          addPoint();
        }
      }

      drawGlow(time);
      drawConnections(time, rotation);

      const len = points.length;
      const tiltX = tiltRef.current.x;
      const tiltY = tiltRef.current.y;
      const cosX = Math.cos(tiltX);
      const cosY = Math.cos(tiltY);

      for (let i = 0; i < len; i++) {
        const p = points[i]!;
        const age = globalTime - p.birth;
        const fadeIn = Math.min(1, age / PHYLLO_FADE_IN_FRAMES);
        p.opacity = fadeIn;

        const baseSize = 1.2 + Math.min(2.5, age * 0.02);
        const pulse = 1 + 0.12 * Math.sin(time * 2 + p.n * 0.1);
        const size = baseSize * pulse;
        const r = p.baseRadius * pulse;
        const angle = p.baseAngle + rotation;
        const flatX = Math.cos(angle) * r;
        const flatY = Math.sin(angle) * r;
        const z = flatX * Math.sin(tiltX) + flatY * Math.sin(-tiltY);
        const perspective = 1 + z * 0.0008;
        const x = cx + flatX * cosX * perspective;
        const y = cy + flatY * cosY * perspective;

        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;

        const col = p.color;
        const alpha = fadeIn * (0.6 + 0.4 * pulse);

        if (size > 2 && alpha > 0.3) {
          const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
          glowGrad.addColorStop(
            0,
            `rgba(${col.r | 0}, ${col.g | 0}, ${col.b | 0}, ${alpha * 0.15})`
          );
          glowGrad.addColorStop(1, `rgba(${col.r | 0}, ${col.g | 0}, ${col.b | 0}, 0)`);
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(x, y, size * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${col.r | 0}, ${col.g | 0}, ${col.b | 0}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (alpha > 0.4) {
          ctx.fillStyle = `rgba(255, 240, 220, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const vignette = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(width, height) * 0.2,
        cx,
        cy,
        Math.max(width, height) * 0.75
      );
      if (light) {
        vignette.addColorStop(0, "rgba(246, 241, 232, 0)");
        vignette.addColorStop(1, "rgba(246, 241, 232, 0.65)");
      } else {
        vignette.addColorStop(0, "rgba(10, 10, 10, 0)");
        vignette.addColorStop(1, "rgba(10, 10, 10, 0.7)");
      }
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      raf = requestAnimationFrame(draw);
    }

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = { down: true, lastX: e.clientX, lastY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.down) return;
      tiltRef.current.x += (e.clientX - dragRef.current.lastX) * 0.003;
      tiltRef.current.y += (e.clientY - dragRef.current.lastY) * 0.003;
      tiltRef.current.y = Math.max(-0.8, Math.min(0.8, tiltRef.current.y));
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    };
    const onPointerUp = () => {
      dragRef.current.down = false;
    };
    const onDblClick = () => {
      tiltRef.current = { x: 0, y: 0 };
    };

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDblClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ touchAction: "none", filter: "grayscale(1)" }}
    />
  );
}
