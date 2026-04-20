import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Database,
  FileInput,
  GitBranch,
  Layers,
  MessageSquare,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingGeminiSection } from "@/components/LandingGeminiSection";
import { Navbar } from "@/components/Navbar";

const TRUST_ITEMS = [
  { icon: Layers, label: "多源接入" },
  { icon: Database, label: "智库 Schema" },
  { icon: Shield, label: "分级脱敏" },
  { icon: GitBranch, label: "方案组合" },
  { icon: MessageSquare, label: "Master Agent" },
  { icon: Zap, label: "端到端可用" },
];

const PIPELINE = [
  {
    tag: "Ingest",
    title: "统一接入",
    desc: "语音、文字、文件入库与撰写",
    icon: FileInput,
  },
  {
    tag: "Schema",
    title: "结构化智库",
    desc: "非结构化 → 智库字段；归档项目与家族；缺失回问",
    icon: BookOpen,
  },
  {
    tag: "Decide",
    title: "分析辅助",
    desc: "方案组合与多维度评分草稿，AI辅助，核心团队确认",
    icon: Brain,
  },
  {
    tag: "Output",
    title: "可签约输出",
    desc: "路径说明、方案地图与竞争评分报告",
    icon: Sparkles,
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-sky-400">
      {children}
    </p>
  );
}

export default function Index() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Navbar />
      <LandingGeminiSection />

      <section className="relative -mt-2 border-y border-white/[0.06] py-8 md:-mt-3">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10 lg:px-12">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-3.5 backdrop-blur-sm md:gap-x-10">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 font-display text-[0.82rem] font-medium text-muted-foreground/55 transition-colors hover:text-muted-foreground"
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.5} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <main>
        <section
          id="capabilities"
          className="scroll-mt-24 px-4 pb-20 pt-28 sm:px-6 md:pb-24 md:pt-32 lg:px-12"
        >
          <div className="mx-auto max-w-4xl text-center">
            <SectionLabel>Capabilities</SectionLabel>
            <h2 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] font-extralight tracking-[-0.035em] text-foreground">
              平台能力
              <br />
              <span className="text-gradient-landing font-medium">
                为家办场景深度构建
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[0.88rem] font-light leading-relaxed text-muted-foreground">
              输入、处理、分析、决策链路清晰可演示，每个功能模块都围绕真实需求设计
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-4xl glass-landing p-6 md:p-8">
            <ul className="space-y-4 text-left text-[0.88rem] leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">输入层：</span>
                语音、文字、文件统一接入
              </li>
              <li>
                <span className="font-medium text-foreground">数据处理：</span>
                非结构化→智库Schema；自动归档项目/家族；缺失字段回问；冲突标记
              </li>
              <li>
                <span className="font-medium text-foreground">权限隔离：</span>
                四级权限体系，权限引擎实时过滤，逐层收敛信息粒度
              </li>
              <li>
                <span className="font-medium text-foreground">输出：</span>
                可签约方案路径、项目知识模块、方案地图与竞争评分报告
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-surface-alt px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:px-12">
          <div className="mx-auto max-w-5xl text-center">
            <SectionLabel>Flow</SectionLabel>
            <h2 className="font-display text-[clamp(1.4rem,2.8vw,1.85rem)] font-extralight tracking-tight text-foreground">
              端到端链路
            </h2>
          </div>
          <div className="relative mx-auto mt-12 grid max-w-5xl gap-10 md:grid-cols-4 md:gap-4">
            <div
              className="pointer-events-none absolute left-[12%] right-[12%] top-[28px] hidden h-0.5 bg-gradient-to-r from-transparent via-white/15 to-transparent md:block"
              aria-hidden
            />
            {PIPELINE.map(({ tag, title, desc, icon: Icon }) => (
              <div key={tag} className="relative text-center">
                <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-sky-400/90">
                  {tag}
                </p>
                <div className="mx-auto mb-3 flex h-[60px] w-[60px] items-center justify-center rounded-full border border-white/10 bg-background text-sky-400 shadow-[0_0_0_0_rgba(59,130,246,0)] transition-all duration-300 hover:border-sky-500/35 hover:bg-sky-500/5 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)]">
                  <Icon className="h-6 w-6" strokeWidth={1.25} />
                </div>
                <h3 className="font-display text-[0.88rem] font-normal text-foreground">
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-[200px] text-[0.78rem] font-light leading-snug text-muted-foreground">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="knowledge"
          className="scroll-mt-24 px-4 py-20 sm:px-6 md:px-10 md:py-24 lg:px-12"
        >
          <div className="mx-auto max-w-4xl text-center">
            <SectionLabel>Knowledge base</SectionLabel>
            <h2 className="font-display text-2xl font-extralight tracking-tight text-foreground md:text-[1.65rem]">
              智库——对话即服务
            </h2>
            <p className="mx-auto mt-4 max-w-[65ch] text-[0.88rem] font-light leading-relaxed text-muted-foreground">
              不再需要翻阅报告、等待回复。用户用自己的语言提出问题，平台从知识库中检索、整合并生成回答——每一条信息都可溯源至原始文档。
            </p>
          </div>
        </section>

        <section
          id="contact"
          className="scroll-mt-24 border-t border-white/[0.06] bg-surface-alt px-4 py-24 sm:px-6 md:px-10 lg:px-12"
        >
          <div className="relative mx-auto max-w-2xl text-center">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[280px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-[100px]"
              aria-hidden
            />
            <SectionLabel>Contact</SectionLabel>
            <h2 className="font-display text-[clamp(1.45rem,3vw,2rem)] font-extralight tracking-tight text-foreground">
              联系与
              <span className="text-gradient-landing">演示</span>
            </h2>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-14">
              <Button type="button" variant="landingCta" size="lg" className="h-11 rounded-full px-8 text-sm font-semibold">
                预约产品演示
              </Button>
              <Button
                type="button"
                variant="landingGhost"
                size="lg"
                className="h-11 rounded-full px-8 text-sm font-semibold"
              >
                下载产品手册
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-12 sm:px-6 md:px-10 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10 lg:gap-14">
          <div className="shrink-0 md:max-w-xs">
            <p className="font-display text-lg font-medium leading-none tracking-tight text-landing-accent">
              合域
            </p>
            <p className="mt-2 max-w-xs text-[0.8rem] leading-relaxed text-muted-foreground">
              以 AI Agent 为引擎的多家族联合投资决策辅助系统
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-x-8 md:gap-y-3 lg:gap-x-12">
            <p className="flex flex-wrap items-baseline justify-start gap-x-2 text-[0.72rem] leading-none text-muted-foreground/80 md:col-start-1 md:row-start-1 md:w-full md:justify-end md:self-end">
              <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground/65">Legal</span>
              <span className="text-muted-foreground/45" aria-hidden>
                ·
              </span>
              <span className="font-medium text-muted-foreground/85">法律信息</span>
            </p>
            <Link
              to="/privacy"
              className="block text-left text-[0.78rem] text-muted-foreground/80 transition-colors hover:text-foreground md:col-start-1 md:row-start-2 md:text-right"
            >
              Privacy Policy（隐私政策）
            </Link>
            <Link
              to="/terms"
              className="block text-left text-[0.78rem] text-muted-foreground/80 transition-colors hover:text-foreground md:col-start-1 md:row-start-3 md:text-right"
            >
              Terms of Service（服务条款）
            </Link>
            <p className="flex flex-wrap items-baseline justify-start gap-x-2 text-[0.72rem] leading-none text-muted-foreground/80 md:col-start-2 md:row-start-1 md:w-full md:justify-end md:self-end">
              <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground/65">Contact</span>
              <span className="text-muted-foreground/45" aria-hidden>
                ·
              </span>
              <span className="font-medium text-muted-foreground/85">联系方式</span>
            </p>
            <a
              href="mailto:support@jfo.ai"
              className="block text-left text-[0.78rem] text-muted-foreground/80 transition-colors hover:text-foreground md:col-start-2 md:row-start-2 md:text-right"
            >
              Email: support@jfo.ai
            </a>
            <p className="text-left text-[0.78rem] leading-none text-muted-foreground/80 md:col-start-3 md:row-start-1 md:self-end md:text-right">
              © {new Date().getFullYear()} 合域
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
