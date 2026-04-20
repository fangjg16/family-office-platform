import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Coins,
  Filter,
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
  "Active（资源筹备中）": "bg-emerald-50 text-emerald-700 border border-emerald-100",
  "Completed（已签约）": "bg-sky-50 text-sky-700 border border-sky-100",
  "Paused（暂停）": "bg-amber-50 text-amber-700 border border-amber-100",
  "Cancelled（已取消）": "bg-rose-50 text-rose-700 border border-rose-100",
};

const ROLE_PILL_CLASS: Record<WorkspaceRole, string> = {
  admin: "border border-primary/40 bg-primary/25 text-primary",
  core: "border border-primary/25 bg-primary/10 text-primary",
  mid: "border border-sky-200 bg-sky-50 text-sky-700",
  low: "border border-slate-200 bg-slate-100 text-slate-600",
  guest: "border border-primary/20 bg-primary/5 text-primary/80",
};

function phaseChipText(phase: ProjectPhase): string {
  const english = phase.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "ACTIVE";
  const cn = phase.match(/（(.+?)）/)?.[1] ?? "";
  return `${english} ${cn}`.trim();
}

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
  const roleLabel = roleFootnote(role);

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
        "group relative flex min-h-[300px] cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_18px_-10px_rgba(15,23,42,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide",
            PHASE_BADGE_CLASS[project.phase]
          )}
        >
          {phaseChipText(project.phase)}
        </span>
      </div>
      <h2 className="text-lg font-semibold leading-snug text-slate-900">
        {project.name}
      </h2>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {project.category}
      </p>
      <p className="mt-5 flex-1 text-sm leading-relaxed text-slate-600">
        {role === "guest" ? project.guestSummary : project.summary}
      </p>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-gray-100 pt-4">
        <span
          className={cn(
            "inline-flex min-w-0 items-center rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            ROLE_PILL_CLASS[role]
          )}
        >
          本项目权限 {roleLabel}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary transition-all group-hover:gap-1.5">
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
  const [phaseFilter, setPhaseFilter] = useState<"all" | ProjectPhase>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | WorkspaceRole>("all");

  useEffect(() => {
    const id = loadSessionUserId();
    if (!id) {
      navigate("/app/login", { replace: true });
      return;
    }
    setUserId(id);
  }, [navigate]);

  const user = getUserById(userId);
  const phaseOptions = Array.from(new Set(ALL_PROJECTS.map((p) => p.phase)));
  const roleOptions = userId
    ? Array.from(
        new Set(
          ALL_PROJECTS.map((p) => getProjectRole(userId, p.id))
        )
      )
    : [];
  const filteredProjects = userId
    ? ALL_PROJECTS.filter((p) => {
        const role = getProjectRole(userId, p.id);
        if (phaseFilter !== "all" && p.phase !== phaseFilter) return false;
        if (roleFilter !== "all" && role !== roleFilter) return false;
        return true;
      })
    : [];

  if (!userId || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 rounded-3xl border border-border/60 bg-white/80 p-6 shadow-sm backdrop-blur-md md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
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
            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">
                  <Filter className="h-3.5 w-3.5" />
                  筛选器
                </div>
                <div className="flex flex-col gap-2">
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value as "all" | ProjectPhase)}
                className="rounded-lg border border-border/60 bg-white/90 px-3 py-2 text-[13px] text-slate-700 outline-none transition hover:border-slate-300 focus:border-primary/30"
              >
                <option value="all">全部状态</option>
                {phaseOptions.map((phase) => (
                  <option key={phase} value={phase}>
                    {phase}
                  </option>
                ))}
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as "all" | WorkspaceRole)}
                className="rounded-lg border border-border/60 bg-white/90 px-3 py-2 text-[13px] text-slate-700 outline-none transition hover:border-slate-300 focus:border-primary/30"
              >
                <option value="all">全部权限</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role === "admin"
                      ? "Admin"
                      : role === "core"
                        ? "Core"
                        : role === "mid"
                          ? "Mid"
                          : role === "low"
                            ? "Low"
                            : "Guest"}
                  </option>
                ))}
              </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => (
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
