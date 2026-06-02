import { Link } from "react-router-dom";
import { LandingScrollStage } from "@/components/landing/LandingScrollStage";
import { TRUST_ITEMS } from "@/components/landing/landing-content";
import { Navbar } from "@/components/Navbar";

export default function Index() {
  return (
    <div className="landing-page min-h-screen bg-[hsl(var(--hero-bg))] font-sans text-[hsl(var(--hero-foreground))]">
      <Navbar />

      <LandingScrollStage />

      {/* 左：Contact 纯文字；右：平台能力毛玻璃条 */}
      <section
        id="contact"
        className="scroll-mt-24 py-10 sm:py-12 lg:py-14"
        aria-label="联系与平台特性"
      >
        <div className="landing-content-shell px-5 sm:px-8 md:px-12 lg:px-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-20 xl:gap-28 2xl:gap-32">
            <div className="shrink-0 text-left lg:pr-2">
              <p className="font-display text-[0.68rem] tracking-[0.16em] text-[hsl(var(--hero-muted))]">
                CONTACT
              </p>
              <a
                href="mailto:support@jfo.ai"
                className="mt-3 block font-display text-xl leading-snug tracking-[0.03em] text-[hsl(var(--hero-foreground)/0.85)] transition-colors hover:text-[hsl(var(--hero-foreground))]"
              >
                support@jfo.ai
              </a>
            </div>

            <ul
              id="trust"
              className="glass-bohemian-hero grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-sm divide-x divide-y divide-[hsl(var(--hero-foreground)/0.1)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0"
            >
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex flex-col items-center justify-center gap-2.5 px-3 py-5 text-center sm:px-4 sm:py-6"
                >
                  <Icon
                    className="h-[1.125rem] w-[1.125rem] shrink-0 text-[hsl(var(--wine)/0.95)]"
                    strokeWidth={1.25}
                  />
                  <span className="font-display text-[0.8rem] leading-snug tracking-[0.02em] text-[hsl(var(--hero-foreground)/0.9)]">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--hero-foreground)/0.08)]">
        <div className="landing-content-shell px-5 py-14 sm:px-8 md:px-12 lg:px-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10 lg:grid-cols-[1.5fr_auto_auto_auto] lg:gap-x-14">
            <div>
              <p className="font-display text-2xl font-semibold tracking-[0.05em] text-[hsl(var(--wine))]">
                合域
              </p>
              <p className="mt-4 max-w-[22rem] text-[0.85rem] leading-[1.75] text-[hsl(var(--hero-muted))]">
                以 AI Agent 为引擎的多家族联合投资决策辅助系统
              </p>
            </div>

            <div>
              <p className="mb-4 flex flex-wrap items-baseline gap-x-1.5 text-[0.7rem] text-[hsl(var(--hero-muted))]">
                <span className="tracking-[0.14em]">Legal</span>
                <span aria-hidden>·</span>
                <span className="font-display tracking-[0.06em]">法律信息</span>
              </p>
              <nav className="flex flex-col gap-2.5" aria-label="法律信息">
                <Link
                  to="/privacy"
                  className="text-[0.85rem] text-[hsl(var(--hero-muted))] transition-colors hover:text-[hsl(var(--hero-foreground))]"
                >
                  Privacy Policy（隐私政策）
                </Link>
                <Link
                  to="/terms"
                  className="text-[0.85rem] text-[hsl(var(--hero-muted))] transition-colors hover:text-[hsl(var(--hero-foreground))]"
                >
                  Terms of Service（服务条款）
                </Link>
              </nav>
            </div>

            <div>
              <p className="mb-4 flex flex-wrap items-baseline gap-x-1.5 text-[0.7rem] text-[hsl(var(--hero-muted))]">
                <span className="tracking-[0.14em]">Contact</span>
                <span aria-hidden>·</span>
                <span className="font-display tracking-[0.06em]">联系方式</span>
              </p>
              <a
                href="mailto:support@jfo.ai"
                className="text-[0.85rem] text-[hsl(var(--hero-muted))] transition-colors hover:text-[hsl(var(--hero-foreground))]"
              >
                Email: support@jfo.ai
              </a>
            </div>

            <p className="text-[0.8rem] text-[hsl(var(--hero-muted)/0.75)] md:col-span-3 lg:col-span-1 lg:text-right">
              © {new Date().getFullYear()} 合域
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
