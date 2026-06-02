import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  LogOut,
  MessageSquare,
  Search,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearSession, loadSessionUserId } from "@/workspace/session";
import {
  GUEST_USER_ID,
  getUserById,
} from "@/workspace/workspace-users";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all md:text-[0.8rem]",
    isActive
      ? "border border-[hsl(var(--wine)/0.3)] bg-[hsl(var(--wine-muted)/0.45)] text-[hsl(var(--wine))] shadow-inner shadow-[hsl(var(--wine)/0.08)]"
      : "border border-transparent text-[hsl(var(--warm-charcoal-muted))] hover:border-[hsl(var(--sand))] hover:bg-white/85 hover:text-[hsl(var(--warm-charcoal))]"
  );

function initialsFromDisplayName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const withSpaces = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
  const tokens = withSpaces
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) {
    const token = tokens[0];
    const first = token[0] ?? "";
    const second = token[1] ?? "";
    const picked = `${first}${second}`.trim();
    return picked ? picked.toUpperCase() : "?";
  }
  return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
}

export function WorkspaceTopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const userId = loadSessionUserId();
  const chatPath = "/app/chat";
  const chatActive = pathname.startsWith("/app/chat");

  const user = getUserById(userId);
  const isGuest = user?.id === GUEST_USER_ID;
  const isAdmin = user?.id === "candice-guo";
  const adminActive = pathname.startsWith("/app/admin");
  const projectsActive = pathname.startsWith("/app/projects");
  const userInitial = initialsFromDisplayName(user?.displayName);

  const [guestDialog, setGuestDialog] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/app/login", { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--sand)/0.82)] bg-white/96 px-3 py-2.5 shadow-[0_4px_16px_-12px_rgba(70,44,40,0.22)] backdrop-blur-md sm:px-5 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-display text-sm font-semibold tracking-[0.04em] text-[hsl(var(--warm-charcoal))] transition-colors hover:text-[hsl(var(--wine))] md:text-base"
            >
              合域
            </Link>
            <div className="hidden items-center md:flex">
              {projectsActive ? (
                <div className="flex w-[340px] items-center rounded-full border border-[hsl(var(--wine-deep)/0.16)] bg-white px-4 py-2 shadow-[0_8px_20px_-18px_rgba(72,46,42,0.24)]">
                  <Search className="mr-2 h-4 w-4 text-[hsl(var(--warm-charcoal-muted)/0.8)]" strokeWidth={1.9} />
                  <input
                    type="text"
                    placeholder="搜索项目"
                    className="w-full bg-transparent text-sm text-[hsl(var(--warm-charcoal))] placeholder:text-[hsl(var(--warm-charcoal-muted)/0.68)] focus:outline-none"
                    aria-label="搜索项目"
                  />
                </div>
              ) : null}
            </div>
          </div>
          <nav
            className="flex shrink-0 items-center justify-center gap-1 rounded-full border border-[hsl(var(--wine-deep)/0.14)] bg-white p-1 shadow-[0_12px_24px_-20px_rgba(72,46,42,0.3)] backdrop-blur-md sm:gap-2 md:justify-end"
            aria-label="工作台主导航"
          >
            {user ? (
              <>
                <div className="hidden items-center gap-2 px-2 md:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--wine)/0.26)] bg-[hsl(var(--wine-muted)/0.52)] text-[10px] font-bold text-[hsl(var(--wine))]">
                    {userInitial}
                  </span>
                  <span className="text-xs font-medium text-[hsl(var(--warm-charcoal-muted))]">
                    {user.displayName}
                  </span>
                </div>
                <div className="mx-1 hidden h-4 w-px bg-[hsl(var(--sand)/0.95)] md:block" />
              </>
            ) : null}
            <NavLink to="/app/projects" className={linkClass} end>
              <LayoutGrid className="h-4 w-4 opacity-80" strokeWidth={2} />
              项目总览
            </NavLink>
            {isGuest ? (
              <button
                type="button"
                onClick={() => setGuestDialog(true)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all md:text-[0.8rem]",
                  chatActive
                    ? "border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.08)] text-[hsl(var(--wine-deep))] shadow-inner shadow-[hsl(var(--wine-deep)/0.08)]"
                    : "border border-transparent text-[hsl(var(--warm-charcoal-muted))] hover:border-[hsl(var(--sand))] hover:bg-white/85 hover:text-[hsl(var(--warm-charcoal))]"
                )}
              >
                <MessageSquare className="h-4 w-4 opacity-80" strokeWidth={2} />
                对话中心
              </button>
            ) : (
              <Link
                to={chatPath}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all md:text-[0.8rem]",
                  chatActive
                    ? "border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.08)] text-[hsl(var(--wine-deep))] shadow-inner shadow-[hsl(var(--wine-deep)/0.08)]"
                    : "border border-transparent text-[hsl(var(--warm-charcoal-muted))] hover:border-[hsl(var(--sand))] hover:bg-white/85 hover:text-[hsl(var(--warm-charcoal))]"
                )}
              >
                <MessageSquare className="h-4 w-4 opacity-80" strokeWidth={2} />
                对话中心
              </Link>
            )}
            {isAdmin ? (
              <NavLink to="/app/admin" className={linkClass}>
                <ShieldCheck
                  className={cn("h-4 w-4 opacity-80", adminActive && "opacity-100")}
                  strokeWidth={2}
                />
                管理中枢
              </NavLink>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-[hsl(var(--warm-charcoal-muted))] transition-colors hover:border-[hsl(var(--sand))] hover:bg-white/85 hover:text-[hsl(var(--warm-charcoal))] md:px-4 md:text-[0.8rem]"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              退出登录
            </button>
          </nav>
        </div>
      </header>

      {guestDialog ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-white p-6 shadow-2xl">
            <h2
              id="guest-dialog-title"
              className="text-base font-bold text-foreground"
            >
              无法进入对话
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              当前为 Guest 权限，仅可浏览项目总览，不能进入对话中心或查看项目对话内容。
            </p>
            <button
              type="button"
              onClick={() => setGuestDialog(false)}
              className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/92"
            >
              知道了
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
