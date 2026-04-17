import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Lock,
  Shield,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadSessionUserId, saveSessionUser } from "@/workspace/session";
import {
  MOCK_PASSWORD,
  verifyLogin,
  WORKSPACE_USERS,
} from "@/workspace/workspace-users";

const REMEMBER_USER_KEY = "fo-login-remember-user";

/** 登录页固定展示身份标签：Admin 与 Guest */
const QUICK_USERS = [
  { id: "candice-guo", hint: "Admin" },
  { id: "jimmy-huang" },
  { id: "jessica-hu" },
  { id: "jensen-fang" },
  { id: "janice-hi", hint: "Guest" },
] as const;

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/25",
        className
      )}
    >
      <KeyRound className="h-4 w-4" strokeWidth={2.5} />
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
    navigate("/app/projects", { replace: true });
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    submit(username, password);
  };

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background lg:min-h-screen lg:flex-row lg:overflow-hidden">
      {/* 左侧：桌面端品牌区（无流动动画，仅静态光晕） */}
      <aside
        className="relative hidden min-h-0 flex-col justify-between overflow-hidden border-border/70 bg-muted/50 lg:flex lg:w-5/12 xl:w-1/2 lg:border-r"
        aria-label="合域品牌与产品说明"
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_0)] bg-[size:32px_32px] opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50/50 via-transparent to-blue-100/40" />
          <div className="absolute -left-10 top-0 h-96 w-96 rounded-full bg-blue-300/45 blur-[80px] mix-blend-multiply motion-safe:animate-login-blob" />
          <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-indigo-200/40 blur-[80px] mix-blend-multiply motion-safe:animate-login-blob [animation-delay:2s]" />
          <div className="absolute -bottom-20 left-20 h-96 w-96 rounded-full bg-cyan-200/35 blur-[80px] mix-blend-multiply motion-safe:animate-login-blob [animation-delay:4s]" />
          <div className="absolute right-[10%] top-[30%] text-blue-600/20 motion-safe:animate-login-float [animation-delay:1.2s]">
            <svg width="220" height="220" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="110" cy="110" r="109" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="110" cy="110" r="72" stroke="currentColor" strokeWidth="0.7" />
              <path d="M110 1V219M1 110H219" stroke="currentColor" strokeWidth="0.7" />
              <path d="M30 30L190 190M30 190L190 30" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 2" />
            </svg>
          </div>
          <span
            className="absolute left-[60%] top-[20%] h-2 w-2 rounded-full bg-blue-500/75 motion-safe:animate-ping"
            style={{ animationDuration: "3.2s" }}
          />
          <span
            className="absolute bottom-[30%] right-[30%] h-1.5 w-1.5 rounded-full bg-indigo-500/60 motion-safe:animate-ping"
            style={{ animationDelay: "1.5s", animationDuration: "3.8s" }}
          />
          <span
            className="absolute left-[20%] top-[60%] h-2.5 w-2.5 rounded-full bg-cyan-400/50 motion-safe:animate-ping"
            style={{ animationDelay: "3s", animationDuration: "4.4s" }}
          />
          <div className="absolute right-1/4 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-primary/5 blur-2xl motion-safe:animate-login-pulse-soft" />
        </div>
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-muted/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-muted/80 to-transparent pointer-events-none" />

        <div className="relative z-10 flex h-full min-h-screen flex-col justify-between px-12 py-14 lg:px-14 lg:py-16 xl:px-16 xl:py-20">
          <div className="max-w-md pt-4 xl:pt-8">
              <h1 className="font-display text-4xl font-light leading-tight tracking-tight text-foreground xl:text-[2.75rem] xl:leading-[1.15]">
                <span className="font-medium text-primary">合域AI</span>
                <br />
                联合家族办公室
                <br />
                投资智库
              </h1>
              <div className="mb-6 mt-5 h-1 w-12 rounded-full bg-primary" />
              <p className="text-base font-light leading-relaxed text-muted-foreground lg:text-lg">
                以 AI Agent 为引擎的多家族联合投资决策辅助系统。
                <br className="hidden sm:block" />
                从信息输入到签约方案输出，全链路权限隔离。
              </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>© {year} 合域</span>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:text-primary/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              返回首页
            </Link>
          </div>
        </div>
      </aside>

      {/* 右侧：表单（桌面端居中；小屏全宽） */}
      <div className="flex w-full min-h-0 flex-1 flex-col bg-background lg:w-7/12 xl:w-1/2 lg:overflow-y-auto">
        <div className="flex shrink-0 justify-end px-4 pt-4 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            返回首页
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-4 pb-16 pt-6 sm:px-8 sm:pb-20 lg:px-12 lg:py-12 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            {/* 小屏：顶部品牌 */}
            <div className="mb-10 flex flex-col items-center text-center lg:hidden">
              <BrandMark className="mb-4 h-11 w-11" />
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                <span className="text-primary">合域AI</span>
                <span className="text-foreground"> · 登录</span>
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                联合家族办公室投资智库
              </p>
            </div>

            <div className="mb-8 lg:mb-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                登录工作台
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                请输入账号与密码以进入项目与对话
              </p>
            </div>

            {fromSwitch ? (
              <p className="mb-6 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-center text-xs font-medium leading-relaxed text-foreground">
                已退出当前会话，请重新输入账号与密码以切换身份（与完整登录相同）。
              </p>
            ) : null}

            <form onSubmit={onSubmitForm} className="space-y-5">
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  账号
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                    <User className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入账号或邮箱"
                    className="block w-full rounded-xl border border-input bg-white py-3 pl-10 pr-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  密码
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                    <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="block w-full rounded-xl border border-input bg-white py-3 pl-10 pr-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  />
                </div>
              </div>

              {error ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-4 pb-1 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-input text-primary accent-primary focus:ring-2 focus:ring-primary/25"
                  />
                  <label
                    htmlFor="remember-me"
                    className="cursor-pointer select-none text-sm text-muted-foreground"
                  >
                    记住我
                  </label>
                </div>
                <Link
                  to="/#contact"
                  className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  忘记密码？
                </Link>
              </div>

              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                进入工作台
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              尚未拥有账户？{" "}
              <Link
                to="/#contact"
                className="font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
              >
                申请试用或注册
              </Link>
            </p>

            <div className="relative my-10">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden
              >
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <span className="bg-background px-3">快速选择</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {QUICK_USERS.map((q) => {
                const u = WORKSPACE_USERS[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => submit(q.id, MOCK_PASSWORD)}
                    className={cn(
                      "flex min-h-[3.25rem] flex-row items-center justify-between gap-3 rounded-xl border border-border/80 bg-white px-4 py-3 text-left text-sm shadow-sm transition-all hover:border-primary/35 hover:shadow-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                      {u.displayName}
                    </span>
                    {"hint" in q && q.hint ? (
                      <span className="shrink-0 text-[11px] font-semibold text-primary">
                        {q.hint}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
              <span>企业级安全环境 · 全链路权限隔离</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
