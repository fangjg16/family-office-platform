import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Coins,
  GraduationCap,
  Hotel,
  Landmark,
  Layers,
  LineChart,
  Sparkles,
  Stethoscope,
  Truck,
  Zap,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { cn } from "@/lib/utils";
import { ProjectDetailDrawer } from "@/components/workspace/ProjectDetailDrawer";
import {
  ALL_PROJECTS,
  TOTAL_PROJECT_COUNT,
  getProjectById,
  type ProjectPhase,
  type WorkspaceProject,
} from "@/workspace/projects";
import { workspaceRoleToDetailTier } from "@/workspace/project-details";
import { loadSessionUserId } from "@/workspace/session";
import { getProjectRole, getUserById } from "@/workspace/workspace-users";
import type { WorkspaceRole } from "@/workspace/types";

const CATEGORY_ICON: Record<string, typeof Sparkles> = {
  食品农业: Sparkles,
  地产: Building2,
  贸易: Truck,
  数字化: Layers,
  "文娱 / IP": Sparkles,
  "数字资产 / IP": Coins,
  "酒店 / 旅游": Hotel,
  证券: LineChart,
  能源: Zap,
  医疗: Stethoscope,
  "法务 / 架构": Landmark,
  教育: GraduationCap,
};

const PHASE_BADGE_CLASS: Record<ProjectPhase, string> = {
  "Active（资源筹备中）": "bg-emerald-500/10 text-emerald-800",
  "Completed（已签约）": "bg-sky-600/10 text-sky-900",
  "Paused（暂停）": "bg-amber-500/10 text-amber-900",
  "Cancelled（已取消）": "bg-rose-500/10 text-rose-800",
};

/** 卡片脚注用短标签，避免与对话区完整称谓重复抢视觉 */
function roleFootnote(role: WorkspaceRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "core":
      return "Core";
    case "mid":
      return "Mid";
    case "low":
      return "Low";
    case "guest":
      return "Guest";
    default:
      return role;
  }
}

function ProjectCard({
  project,
  userId,
  onOpenDetail,
}: {
  project: WorkspaceProject;
  userId: string;
  onOpenDetail: () => void;
}) {
  const Icon = CATEGORY_ICON[project.category] ?? Layers;
  const role = getProjectRole(userId, project.id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col rounded-3xl border border-border/70 bg-white/90 p-6 text-left shadow-[0_12px_40px_-24px_rgba(15,23,42,0.15)] backdrop-blur-md transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_20px_50px_-28px_rgba(37,99,235,0.18)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/15 to-blue-600/10 text-primary">
          <Icon className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide",
            PHASE_BADGE_CLASS[project.phase]
          )}
        >
          {project.phase}
        </span>
      </div>
      <h2 className="font-display text-lg font-semibold leading-snug text-foreground">
        {project.name}
      </h2>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {project.category}
      </p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {role === "guest" ? project.guestSummary : project.summary}
      </p>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border/40 pt-4">
        <p className="min-w-0 text-[10px] leading-relaxed text-muted-foreground/55">
          本项目权限{" "}
          <span className="text-muted-foreground/75">{roleFootnote(role)}</span>
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary opacity-90 transition-opacity group-hover:opacity-100">
          查看详情
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}

export default function ProjectOverview() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [guestDialog, setGuestDialog] = useState(false);
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);

  useEffect(() => {
    const id = loadSessionUserId();
    if (!id) {
      navigate("/app/login", { replace: true });
      return;
    }
    setUserId(id);
  }, [navigate]);

  const user = getUserById(userId);

  if (!userId || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 rounded-3xl border border-border/60 bg-white/80 p-6 shadow-sm backdrop-blur-md md:p-8">
          <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-primary">
            Portfolio
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            项目总览
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            全平台在管共{" "}
            <span className="font-semibold text-foreground">
              {TOTAL_PROJECT_COUNT}
            </span>{" "}
            个项目。当前登录{" "}
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {user.displayName}
            </span>
            。点击卡片从右侧展开项目详情，内容与「本项目」角色一致。
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ALL_PROJECTS.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              userId={userId}
              onOpenDetail={() => setDetailProjectId(p.id)}
            />
          ))}
        </div>
      </div>

      {detailProjectId ? (
        <ProjectDetailDrawer
          project={getProjectById(detailProjectId) ?? null}
          userId={userId}
          detailTier={workspaceRoleToDetailTier(
            getProjectRole(userId, detailProjectId)
          )}
          onClose={() => setDetailProjectId(null)}
          onGuestTryChat={() => setGuestDialog(true)}
        />
      ) : null}

      {guestDialog ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-card-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-white p-6 shadow-2xl">
            <h2
              id="guest-card-title"
              className="text-base font-bold text-foreground"
            >
              无法进入对话
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Guest 权限下不能进入项目对话。请使用其他账号登录，或联系管理员开通权限。
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
    </WorkspaceShell>
  );
}
