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
import {
  clearSession,
  loadLastProjectId,
  loadSessionUserId,
} from "@/workspace/session";
import {
  GUEST_USER_ID,
  getUserById,
} from "@/workspace/workspace-users";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all md:text-[0.8rem]",
    isActive
      ? "bg-primary/12 text-primary shadow-inner shadow-primary/5"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
  );

export function WorkspaceTopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const lastChatId = loadLastProjectId() ?? "shrimp";
  const chatPath = `/app/chat/${lastChatId}`;
  const chatActive = pathname.startsWith("/app/chat");

  const userId = loadSessionUserId();
  const user = getUserById(userId);
  const isGuest = user?.id === GUEST_USER_ID;
  const isAdmin = user?.id === "candice-guo";
  const adminActive = pathname.startsWith("/app/admin");
  const projectsActive = pathname.startsWith("/app/projects");
  const userInitial =
    (user?.displayName ?? "?")
      .split(/[\s-]+/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  const [guestDialog, setGuestDialog] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/app/login", { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 px-3 py-3 backdrop-blur-xl sm:px-5 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-gradient-landing font-display text-sm font-semibold tracking-tight md:text-base"
            >
              合域
            </Link>
            <div className="hidden items-center md:flex">
              {projectsActive ? (
                <div className="flex w-[340px] items-center rounded-full border border-border/70 bg-white/85 px-4 py-2 shadow-sm">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={2} />
                  <input
                    type="text"
                    placeholder="搜索项目"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                    aria-label="搜索项目"
                  />
                </div>
              ) : null}
            </div>
          </div>
          <nav
            className="flex shrink-0 items-center justify-center gap-1 rounded-full border border-border/70 bg-white/70 p-1 shadow-sm backdrop-blur-md sm:gap-2 md:justify-end md:bg-white/85"
            aria-label="工作台主导航"
          >
            {user ? (
              <>
                <div className="hidden items-center gap-2 px-2 md:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                    {userInitial}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {user.displayName}
                  </span>
                </div>
                <div className="mx-1 hidden h-4 w-px bg-border/80 md:block" />
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
                    ? "bg-primary/12 text-primary shadow-inner shadow-primary/5"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
                    ? "bg-primary/12 text-primary shadow-inner shadow-primary/5"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:px-4 md:text-[0.8rem]"
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
