import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { loadSessionUserId } from "@/workspace/session";

const ADMIN_USER_ID = "candice-guo";

const ADMIN_PORTAL_URL = (
  (import.meta.env.VITE_ADMIN_PORTAL_URL as string | undefined)?.trim() ||
  "https://fangjg16.github.io/family-office-admin-portal/"
).replace(/\/?$/u, "/");

export default function AdminPortal() {
  const userId = loadSessionUserId();
  const isAdmin = userId === ADMIN_USER_ID;

  useEffect(() => {
    if (isAdmin) {
      window.location.replace(ADMIN_PORTAL_URL);
    }
  }, [isAdmin]);

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-[1200px] rounded-3xl border border-border/70 bg-white/80 px-6 py-8 shadow-sm backdrop-blur-sm md:px-8 md:py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">
          Admin Portal
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          管理中枢
        </h1>
        {isAdmin ? (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-foreground">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={2} />
              正在跳转到合域管理后台…
            </p>
            <p className="mt-2 text-muted-foreground">
              若未自动跳转，请点击下方按钮。
            </p>
            <a
              href={ADMIN_PORTAL_URL}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
            >
              <ExternalLink className="h-4 w-4" />
              打开管理后台
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            当前账号无权限访问管理员后台。
          </div>
        )}
        <div className="mt-8">
          <Link
            to="/app/projects"
            className="inline-flex rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60"
          >
            返回项目总览
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  );
}
