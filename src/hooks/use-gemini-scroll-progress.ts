import { useEffect, useState, type RefObject } from "react";

/**
 * 模拟 framer-motion useScroll(target, offset: ["start start", "end start"]) 的 0~1 进度：
 * 目标块顶端贴齐视口顶端时为 0，整块滚过视口（底端贴齐顶端）时为 1。
 */
export function useGeminiScrollProgress(
  targetRef: RefObject<HTMLElement | null>
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      const denom = Math.max(1, h - vh);
      const raw = -rect.top / denom;
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    const el = targetRef.current;
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => update())
        : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (el && ro) ro.disconnect();
    };
  }, [targetRef]);

  return progress;
}

/**
 * 首屏 Hero：进度按「视口高度」归一化（而非整段 section 高度），
 * 避免曲线已滚出视区时 path 仍远未满（原先 `-rect.top / sectionHeight` 过慢）。
 */
export function useGeminiScrollProgressThroughSection(
  targetRef: RefObject<HTMLElement | null>
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = targetRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const denom = Math.max(1, vh * 0.5);
      const raw = -rect.top / denom;
      setProgress(Math.min(1, Math.max(0, raw)));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    const el = targetRef.current;
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => update())
        : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (el && ro) ro.disconnect();
    };
  }, [targetRef]);

  return progress;
}

/** 与原先 useTransform(scrollYProgress, [0, 0.8], [a, 1.2]) 等价 */
export function geminiPathLengths(scrollP: number): [
  number,
  number,
  number,
  number,
  number,
] {
  const t = Math.min(1, Math.max(0, scrollP / 0.8));
  return [
    0.2 + t * (1.2 - 0.2),
    0.15 + t * (1.2 - 0.15),
    0.1 + t * (1.2 - 0.1),
    0.05 + t * (1.2 - 0.05),
    0 + t * (1.2 - 0),
  ];
}
