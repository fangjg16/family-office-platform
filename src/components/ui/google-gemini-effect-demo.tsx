import { useRef } from "react";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";
import {
  geminiPathLengths,
  useGeminiScrollProgress,
} from "@/hooks/use-gemini-scroll-progress";

/**
 * 独立组件块：用于 Storybook / 单独页面；落地页完整效果见 {@link LandingGeminiSection}。
 */
export function GoogleGeminiEffectDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollP = useGeminiScrollProgress(ref);
  const pathDraw = geminiPathLengths(scrollP);

  return (
    <div className="relative w-full overflow-clip rounded-md border border-white/[0.08] bg-black pt-40 dark:border-white/[0.1]">
      <div ref={ref} className="h-[400vh] w-full min-h-[200vh]">
        <GoogleGeminiEffect pathDraw={pathDraw} />
      </div>
    </div>
  );
}
