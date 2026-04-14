import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadSessionUserId, saveSessionUser } from "@/workspace/session";
import {
  MOCK_PASSWORD,
  verifyLogin,
  WORKSPACE_USERS,
} from "@/workspace/workspace-users";

/** 登录页固定展示身份标签：Admin 与 Guest */
const QUICK_USERS = [
  { id: "candice-guo", hint: "Admin" },
  { id: "jimmy-huang" },
  { id: "jessica-hu" },
  { id: "jensen-fang" },
  { id: "janice-hi", hint: "Guest" },
] as const;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSwitch = searchParams.get("switch") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadSessionUserId()) {
      navigate("/app/projects", { replace: true });
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
    navigate("/app/projects", { replace: true });
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    submit(username, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-sky-50/30 to-background pb-16">
      <header className="sticky top-4 z-50 px-4 pb-2 md:px-8">
        <nav
          className="mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-[2rem] border border-border/60 bg-white/85 px-6 py-3.5 shadow-[0_12px_40px_-28px_rgba(37,99,235,0.15)] backdrop-blur-xl"
          aria-label="工作台导航"
        >
          <Link
            to="/"
            className="font-display rounded-full text-lg font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
          >
            合域
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            返回首页
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-24 pt-10 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <KeyRound size={28} strokeWidth={2} />
          </div>
          <h1 className="font-display text-[clamp(1.65rem,4vw,2.1rem)] font-semibold tracking-tight text-foreground">
            登录工作台
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
            同一账号在不同项目中可有不同权限级别。登录后请先进入「项目总览」，再进入各项目对话。
          </p>
        </div>

        {fromSwitch ? (
          <p className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-center text-xs font-medium leading-relaxed text-foreground">
            已退出当前会话，请重新输入账号与密码以切换身份（与完整登录相同）。
          </p>
        ) : null}

        <form
          onSubmit={onSubmitForm}
          className="rounded-[1.75rem] border border-border/70 bg-white/90 p-6 shadow-[0_16px_50px_-32px_rgba(15,23,42,0.12)] backdrop-blur-sm md:p-8"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            账号
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号或邮箱"
              className="mt-2 h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm font-medium text-foreground shadow-inner placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </label>
          <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="mt-2 h-12 w-full rounded-2xl border border-input bg-white px-4 text-sm font-medium text-foreground shadow-inner placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </label>

          {error ? (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_2px_12px_-2px_rgba(37,99,235,0.28)] transition-all hover:bg-primary/92 active:scale-[0.99]"
          >
            <LogIn className="h-4 w-4" strokeWidth={2} />
            登录
          </button>
        </form>

        <div className="mt-10">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            快速选择
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_USERS.map((q) => {
              const u = WORKSPACE_USERS[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => submit(q.id, MOCK_PASSWORD)}
                  className={cn(
                    "flex min-h-[3.25rem] flex-row items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-left text-sm transition-all hover:border-primary/30 hover:shadow-md",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-bold text-foreground">
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
        </div>

        <aside className="mx-auto mt-12 max-w-lg rounded-[1.5rem] border border-border/60 bg-white/60 px-5 py-4 text-left text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">权限说明</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <strong className="text-foreground">Admin</strong>：最高管理；可配置评分维度权重等。
            </li>
            <li>
              <strong className="text-foreground">Core</strong>：核心级细节与财务；仅维护本家族数据。
            </li>
            <li>
              <strong className="text-foreground">Mid</strong>：脱敏与简化评分，不可触发重评。
            </li>
            <li>
              <strong className="text-foreground">Low</strong>：最低权限对话。
            </li>
            <li>
              <strong className="text-foreground">Guest</strong>：仅项目总览，无法进入对话。
            </li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
