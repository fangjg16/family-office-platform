import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Shield, User } from "lucide-react";
import { LoginParticleCanvas } from "@/components/login/LoginParticleCanvas";
import { Button } from "@/components/ui/button";
import { loadSessionUserId, saveSessionUser } from "@/workspace/session";
import { verifyLogin } from "@/workspace/workspace-users";

const REMEMBER_USER_KEY = "fo-login-remember-user";

const inputClass =
  "block w-full rounded-sm border border-[hsl(var(--sand))] bg-white/90 py-2.5 pl-10 pr-4 text-[0.875rem] text-[hsl(var(--warm-charcoal))] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] placeholder:text-[hsl(var(--warm-charcoal-muted)/0.55)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--wine-deep)/0.35)] focus-visible:border-[hsl(var(--wine-deep)/0.45)] disabled:opacity-60 xl:py-3 xl:text-[0.9375rem]";

const labelClass =
  "mb-1.5 block font-display text-[0.68rem] tracking-[0.08em] text-[hsl(var(--warm-charcoal-muted))] xl:text-[0.72rem]";

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-[hsl(var(--wine-deep)/0.82)]">
      {children}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSwitch = searchParams.get("switch") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loadSessionUserId()) {
      navigate("/app/projects", { replace: true });
      return;
    }
    const remembered = localStorage.getItem(REMEMBER_USER_KEY);
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, [navigate]);

  const submit = (u: string, p: string) => {
    if (submitting) return;
    setError(null);
    const id = verifyLogin(u, p);
    if (!id) {
      setError("账号或密码不正确，请核对后重试。");
      return;
    }
    saveSessionUser(id);
    if (rememberMe) {
      localStorage.setItem(REMEMBER_USER_KEY, u.trim());
    } else {
      localStorage.removeItem(REMEMBER_USER_KEY);
    }
    setSubmitting(true);
    window.setTimeout(() => {
      navigate("/app/projects", { replace: true });
    }, 140);
  };

  const onSubmitForm = (e: FormEvent) => {
    e.preventDefault();
    submit(username, password);
  };

  const year = new Date().getFullYear();

  return (
    <div className="login-page relative flex min-h-[100dvh] flex-col overflow-x-hidden overflow-y-auto bg-[hsl(var(--linen))] font-sans text-[hsl(var(--warm-charcoal))] lg:h-[100dvh] lg:overflow-hidden">
      <LoginParticleCanvas className="fixed inset-0 z-0" />
      <div
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,hsl(var(--wine-deep)/0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_100%,hsl(var(--terracotta)/0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--linen))_0%,hsl(var(--sand)/0.35)_100%)]" />
      </div>

      <div className="landing-content-shell relative z-10 flex min-h-0 flex-1 flex-col px-5 sm:px-8 md:px-12 lg:px-16">
        <header className="flex shrink-0 items-center justify-between py-3 lg:py-3.5 xl:py-5">
          <Link
            to="/"
            className="font-display text-[1.05rem] font-semibold tracking-[0.08em] text-[hsl(var(--warm-charcoal))] transition-colors hover:text-[hsl(var(--wine-deep))]"
          >
            合域
          </Link>
          <Button
            variant="landingGhostLight"
            size="sm"
            className="h-9 border-[hsl(var(--wine-deep)/0.32)] px-4 text-[hsl(var(--wine-deep))] hover:border-[hsl(var(--wine-deep)/0.48)] hover:text-[hsl(var(--wine-deep))]"
            asChild
          >
            <Link to="/">
              <ArrowLeft className="block h-3.5 w-3.5" strokeWidth={1.5} />
              返回首页
            </Link>
          </Button>
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-[70rem] flex-1 flex-col pb-4 lg:pb-3 lg:grid lg:grid-cols-[minmax(0,38rem)_min(100%,24rem)] lg:items-center lg:gap-x-[clamp(2rem,4vw,5rem)] xl:max-w-[72rem] xl:pb-5 xl:grid-cols-[minmax(0,40rem)_min(100%,26rem)] xl:gap-x-[clamp(2.5rem,4.5vw,5.5rem)]">
          {/* 左侧：品牌 */}
          <section
            className="mb-8 flex flex-col justify-center lg:mb-0"
            aria-label="合域品牌与产品说明"
          >
            <div className="max-w-xl">
              <p className="font-display text-[0.68rem] tracking-[0.22em] text-[hsl(var(--warm-charcoal-muted))]">
                LOGIN
              </p>
              <div className="mt-2 h-px w-12 bg-[hsl(var(--wine-deep)/0.65)] lg:mt-3 xl:mt-4" />
              <h1 className="mt-3 font-display text-[clamp(1.85rem,4.5vw,3rem)] font-semibold leading-[1.12] tracking-[0.03em] text-[hsl(var(--wine-deep))] lg:mt-4 xl:mt-6">
                合域AI
              </h1>
              <p className="mt-2 font-display text-[clamp(1rem,2.2vw,1.45rem)] font-normal leading-snug tracking-[0.04em] text-[hsl(var(--wine-deep)/0.88)]">
                联合家族办公室投资智库
              </p>
              <p className="login-brand-copy mt-4 max-w-md text-[0.875rem] leading-[1.75] text-[hsl(var(--warm-charcoal-muted))] lg:mt-4 lg:leading-[1.8] xl:mt-6 xl:text-[0.9375rem] xl:leading-[1.9]">
                以 AI Agent 为引擎的多家族联合投资决策辅助系统。
                <br />
                从信息输入到签约方案输出，全链路权限隔离。
              </p>
              <p className="login-brand-footer mt-6 hidden text-sm text-[hsl(var(--warm-charcoal-muted)/0.8)] lg:block lg:mt-6 xl:mt-10">
                © {year} 合域
              </p>
            </div>
          </section>

          {/* 右侧：登录卡 */}
          <section className="flex w-full flex-col justify-center">
            <div className="login-card glass-bohemian mx-auto w-full max-w-[24rem] rounded-sm px-6 py-6 xl:max-w-[26rem] xl:px-6 xl:py-7">
              <div className="login-card-stack flex flex-col gap-5">
              {fromSwitch ? (
                <p className="rounded-sm border border-[hsl(var(--wine-deep)/0.22)] bg-[hsl(var(--wine-muted)/0.45)] px-3.5 py-2.5 text-center text-xs font-medium leading-relaxed text-[hsl(var(--warm-charcoal))]">
                  已退出当前会话，请重新输入账号与密码以切换身份（与完整登录相同）。
                </p>
              ) : null}

              <div className="login-card-controls mx-auto flex w-[94%] max-w-[20rem] flex-col gap-5 xl:max-w-[21rem]">
              <form onSubmit={onSubmitForm} className="login-form flex flex-col gap-4">
                <div>
                  <label htmlFor="login-username" className={labelClass}>
                    账号
                  </label>
                  <div className="relative">
                    <FieldIcon>
                      <User
                        className="block h-[1.05rem] w-[1.05rem]"
                        strokeWidth={1.5}
                      />
                    </FieldIcon>
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={submitting}
                      placeholder="请输入账号或邮箱"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className={labelClass}>
                    密码
                  </label>
                  <div className="relative">
                    <FieldIcon>
                      <Lock
                        className="block h-[1.05rem] w-[1.05rem]"
                        strokeWidth={1.5}
                      />
                    </FieldIcon>
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      placeholder="请输入密码"
                      className={inputClass}
                    />
                  </div>
                </div>

                {error ? (
                  <p className="rounded-sm border border-[hsl(var(--wine-deep)/0.28)] bg-[hsl(var(--wine-muted)/0.5)] px-3 py-2.5 text-sm text-[hsl(var(--warm-charcoal))]">
                    {error}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={submitting}
                      className="h-4 w-4 cursor-pointer rounded-sm border-[hsl(var(--sand))] accent-[hsl(var(--wine-deep))]"
                    />
                    <label
                      htmlFor="remember-me"
                      className="cursor-pointer select-none text-sm text-[hsl(var(--warm-charcoal-muted))]"
                    >
                      记住我
                    </label>
                  </div>
                  <Link
                    to="/#contact"
                    className="shrink-0 text-sm text-[hsl(var(--wine-deep))] transition-colors hover:text-[hsl(353_42%_28%)]"
                  >
                    忘记密码？
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="group h-10 w-full rounded-sm border border-[hsl(var(--wine-deep))] bg-[hsl(var(--wine-deep))] text-sm font-medium tracking-wide text-[hsl(var(--wine-deep-foreground))] shadow-[0_6px_22px_-8px_hsl(var(--wine-deep)/0.55)] transition-all hover:bg-[hsl(353_42%_28%)] active:scale-[0.99] xl:h-11"
                >
                  {submitting ? "登录中..." : "登录"}
                  <ArrowRight
                    className="block h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={1.5}
                  />
                </Button>
              </form>

              <p className="text-center text-sm leading-snug text-[hsl(var(--warm-charcoal-muted))]">
                尚未拥有账户？{" "}
                <Link
                  to="/#contact"
                  className="font-medium text-[hsl(var(--wine-deep))] hover:text-[hsl(353_42%_28%)]"
                >
                  申请试用或注册
                </Link>
              </p>
              </div>

              <div className="flex items-center justify-center gap-2 px-2 text-xs leading-snug text-[hsl(var(--warm-charcoal-muted))]">
                <Shield
                  className="block h-3.5 w-3.5 shrink-0 text-[hsl(var(--wine-deep)/0.75)]"
                  strokeWidth={1.5}
                />
                <span>企业级安全环境 · 全链路权限隔离</span>
              </div>
              </div>
            </div>

            <p className="mt-4 shrink-0 text-center text-sm text-[hsl(var(--warm-charcoal-muted)/0.8)] lg:hidden">
              © {year} 合域
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
