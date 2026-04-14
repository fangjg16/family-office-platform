import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { loadSessionUserId } from "@/workspace/session";

const ADMIN_USER_ID = "candice-guo";

export default function AdminPortal() {
  const userId = loadSessionUserId();
  const isAdmin = userId === ADMIN_USER_ID;

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
              管理员后台已预留入口
            </p>
            <p className="mt-2 text-muted-foreground">
              后续可在此扩展用户管理、权限矩阵、审计日志和系统配置。
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            当前账号无权限访问管理员后台。
          </div>
        )}
        <div className="mt-8">
          <Link
            to="/app/projects"
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
          >
            返回项目总览
          </Link>
        </div>
      </div>
    </WorkspaceShell>
  );
}
