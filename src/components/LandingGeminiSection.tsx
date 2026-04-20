import { useRef } from "react";
import { Link } from "react-router-dom";
import { GoogleGeminiEffect } from "@/components/ui/google-gemini-effect";
import {
  geminiPathLengths,
  useGeminiScrollProgress,
} from "@/hooks/use-gemini-scroll-progress";

/**
 * 落地首屏：滚动驱动曲线（原 Hero 文案与说明已并入此区块）。
 */
export function LandingGeminiSection() {
  const ref = useRef<HTMLDivElement>(null);
  const scrollP = useGeminiScrollProgress(ref);
  const pathDraw = geminiPathLengths(scrollP);

  return (
    <div className="relative w-full overflow-x-clip rounded-b-3xl border-x border-white/[0.06] bg-[hsl(240_43%_5%)] pt-20 md:pt-24 lg:pt-28">
      <div
        ref={ref}
        className="h-[min(280vh,3200px)] w-full min-h-[180vh]"
      >
        <GoogleGeminiEffect
          pathDraw={pathDraw}
          title={
            <>
              <span className="text-gradient-landing font-medium">合域AI</span>
              <br />
              联合家族办公室投资智库
            </>
          }
          description={
            <>
              <p>以 AI Agent 为引擎的多家族联合投资决策辅助系统</p>
              <p>从信息输入到签约方案输出，全链路权限隔离</p>
            </>
          }
          cta={
            <Link
              to="/app"
              className="inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[hsl(240_43%_8%)] shadow-lg shadow-sky-500/20 transition-transform hover:scale-[1.02] md:px-6 md:py-3 md:text-sm"
            >
              进入工作台
            </Link>
          }
        />
      </div>
    </div>
  );
}
