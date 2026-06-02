import { useEffect, useRef } from "react";

import {
  AUTO_FORM_SECONDS,
} from "@/components/landing/concentric-rings-config";
import {
  buildFlowArrowParticles,
  buildRingParticles,
  particleMotionAt,
  particlePosition,
  type RingParticle,
} from "@/components/landing/concentric-rings-engine";

import {

  particleViewportFromLayout,

  stageContentLayout,

} from "@/components/landing/scroll-stage-layout";



type Props = {

  scrollProgress: number;

  className?: string;

};



export function ConcentricRingsParticles({

  scrollProgress,

  className,

}: Props) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(scrollProgress);
  /** 开屏自动收束 0→1，单调递增，滚动时不重置 */
  const introFormRef = useRef(0);
  const lastFrameTsRef = useRef<number | null>(null);



  scrollRef.current = scrollProgress;



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

    let minDim = 0;

    let dpr = 1;

    let ringParticles: RingParticle[] = [];

    let arrowParticles: RingParticle[] = [];

    let raf = 0;



    function applyLayout(progress: number) {

      const vp = particleViewportFromLayout(

        width,

        height,

        stageContentLayout(progress, { width, height })

      );

      cx = vp.cx;

      cy = vp.cy;

      minDim = vp.minDim;

    }



    function ensureParticles() {

      const base = Math.min(width, height) || 800;

      if (ringParticles.length === 0) {

        ringParticles = buildRingParticles(base);

      }

      if (arrowParticles.length === 0) {

        arrowParticles = buildFlowArrowParticles();

      }

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

      ringParticles = [];
      arrowParticles = [];
      introFormRef.current = 0;
      lastFrameTsRef.current = null;
      ensureParticles();

      applyLayout(scrollRef.current);

    }



    function drawParticle(

      x: number,

      y: number,

      size: number,

      alpha: number

    ) {

      if (alpha < 0.02) return;



      const glowR = size * 3.5;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);

      glow.addColorStop(0, `rgba(255, 248, 240, ${alpha * 0.22})`);

      glow.addColorStop(1, "rgba(255, 248, 240, 0)");

      ctx.fillStyle = glow;

      ctx.beginPath();

      ctx.arc(x, y, glowR, 0, Math.PI * 2);

      ctx.fill();



      ctx.fillStyle = `rgba(255, 252, 248, ${alpha})`;

      ctx.beginPath();

      ctx.arc(x, y, size, 0, Math.PI * 2);

      ctx.fill();



      if (alpha > 0.35) {

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;

        ctx.beginPath();

        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);

        ctx.fill();

      }

    }



    function drawParticleSet(

      list: RingParticle[],

      motion: ReturnType<typeof particleMotionAt>,

      time: number,

      opts: { arrowOnly?: boolean } = {}

    ) {

      const { arrowOnly = false } = opts;

      const loopFade = arrowOnly ? motion.flowLoopT : 1;



      for (let i = 0; i < list.length; i++) {

        const p = list[i]!;

        if (arrowOnly && p.role !== "arrow") continue;

        if (!arrowOnly && p.role === "arrow") continue;



        const pos = particlePosition(p, cx, cy, minDim, motion, time);



        if (

          pos.x < -30 ||

          pos.x > width + 30 ||

          pos.y < -30 ||

          pos.y > height + 30

        ) {

          continue;

        }



        const pulse = 0.85 + 0.15 * Math.sin(time * 2 + p.phase);

        const scatterFade = 0.68 + motion.ringT * 0.28;

        const cloudBoost = 1 + motion.cloudT * 0.12;

        const isArrow = p.role === "arrow";

        const loopBoost = isArrow
          ? 1 + motion.flowLoopT * 0.35
          : 1 + motion.flowLoopT * 0.18;
        const bubbleBoost = 1 + motion.bubbleT * 0.22;

        const alpha =
          p.opacityBase *
          pulse *
          scatterFade *
          cloudBoost *
          loopBoost *
          bubbleBoost *
          loopFade *
          (isArrow ? 1.08 : 1);



        const size =

          p.size *

          (p.ring === "inner" ? 1 : 0.92) *

          (0.88 + motion.ringT * 0.12) *

          (1 + motion.cloudT * 0.08) *

          (isArrow
            ? 1 + motion.flowLoopT * 0.22
            : 1 + motion.flowLoopT * 0.15 + motion.bubbleT * 0.12);



        drawParticle(pos.x, pos.y, size, alpha);

      }

    }



    function draw(timestamp: number) {
      const time = timestamp / 1000;
      const progress = scrollRef.current;

      if (lastFrameTsRef.current !== null) {
        const delta = Math.min(0.05, (timestamp - lastFrameTsRef.current) / 1000);
        if (introFormRef.current < 1) {
          introFormRef.current = Math.min(
            1,
            introFormRef.current + delta / AUTO_FORM_SECONDS
          );
        }
      }
      lastFrameTsRef.current = timestamp;

      applyLayout(progress);
      ensureParticles();

      const motion = particleMotionAt(progress, introFormRef.current);



      ctx.clearRect(0, 0, width, height);



      drawParticleSet(ringParticles, motion, time);

      if (motion.flowLoopT > 0.04) {

        drawParticleSet(arrowParticles, motion, time, { arrowOnly: true });

      }



      const vignette = ctx.createRadialGradient(

        cx,

        cy,

        minDim * 0.12,

        cx,

        cy,

        Math.max(width, height) * 0.72

      );

      vignette.addColorStop(0, "rgba(10, 10, 10, 0)");

      vignette.addColorStop(1, "rgba(10, 10, 10, 0.65)");

      ctx.fillStyle = vignette;

      ctx.fillRect(0, 0, width, height);



      raf = requestAnimationFrame(draw);

    }



    resize();

    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);

    if (canvas.parentElement) ro.observe(canvas.parentElement);

    window.addEventListener("resize", resize);



    return () => {

      cancelAnimationFrame(raf);

      ro.disconnect();

      window.removeEventListener("resize", resize);

    };

  }, []);



  return (

    <canvas

      ref={canvasRef}

      className={className}

      aria-hidden

      style={{ filter: "grayscale(1)" }}

    />

  );

}


