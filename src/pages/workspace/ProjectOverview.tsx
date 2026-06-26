import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Coins,
  FileText,
  Filter,
  GraduationCap,
  Hotel,
  Landmark,
  Layers,
  LineChart,
  Plus,
  Sparkles,
  Stethoscope,
  Truck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { cn } from "@/lib/utils";
import { ProjectDetailDrawer } from "@/components/workspace/ProjectDetailDrawer";
import {
  normalizeProjectPhase,
  type ProjectPhase,
  type WorkspaceProject,
} from "@/workspace/projects";
import {
  createProjectViaApi,
  ENABLE_LIVE_CHAT,
  fetchMyProjectRoles,
  fetchProjectsFromApi,
  uploadProjectPackageFile,
} from "@/lib/project-api";
import { clearLastChatProjectId, loadLastChatProjectId } from "@/workspace/session";
import {
  getMergedProjects,
  removeApiProject,
  setApiProjects,
  sortProjectsForOverview,
  upsertApiProject,
} from "@/workspace/project-registry";
import { workspaceRoleToDetailTier } from "@/workspace/project-details";
import { useMyProjectRoles } from "@/hooks/use-my-project-roles";
import { loadSessionUserId } from "@/workspace/session";
import { setMyProjectRoles } from "@/workspace/project-role-cache";
import { filterProjectsForUser } from "@/workspace/guest-access";
import { getProjectRole, getUserById, roleLabelForProject, WORKSPACE_USERS } from "@/workspace/workspace-users";
import type { WorkspaceRole } from "@/workspace/types";

const CREATE_PERMISSION_OPTIONS = ["core", "mid", "low"] as const;
type CreatePermission = (typeof CREATE_PERMISSION_OPTIONS)[number];
type CreateParticipant = { userId: string; name: string; permission: CreatePermission };
type ProjectOpenness = "public" | "partial" | "invite";

const PROJECT_OPENNESS_OPTIONS: {
  value: ProjectOpenness;
  title: string;
  description: string;
}[] = [
  {
    value: "public",
    title: "全开放",
    description:
      "除涉及敏感区间的信息外，项目基础信息公开，所有进入平台的用户均可看到该项目的存在及概要。",
  },
  {
    value: "partial",
    title: "半开放",
    description:
      "项目存在对外可见，但只展示基础信息（如项目名称和摘要），详细内容需要对应权限才能访问。",
  },
  {
    value: "invite",
    title: "内部邀请",
    description:
      "项目在主页只显示标题，甚至不展示在主页，完全依赖内部邀请才能接触。适用于高度敏感或尚未对外的项目。",
  },
];

function prettyMemberName(displayName: string): string {
  const spaced = displayName.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return spaced || displayName;
}

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
  "Active（资源筹备中）":
    "rounded-sm border border-[hsl(145_18%_78%)] bg-[hsl(145_22%_93%)] text-[hsl(145_24%_30%)]",
  "Completed（已签约）":
    "rounded-sm border border-[hsl(var(--wine-deep)/0.35)] bg-[hsl(var(--wine-muted)/0.55)] text-[hsl(var(--wine-deep))]",
  "Paused（暂停）":
    "rounded-sm border border-[hsl(var(--terracotta)/0.38)] bg-[hsl(32_26%_93%)] text-[hsl(22_28%_38%)]",
  "Cancelled（已取消）":
    "rounded-sm border border-[hsl(var(--sand))] bg-[hsl(var(--warm-charcoal)/0.06)] text-[hsl(var(--warm-charcoal-muted))]",
};

const ROLE_PILL_CLASS: Record<WorkspaceRole, string> = {
  admin:
    "border border-[hsl(var(--wine)/0.4)] bg-[hsl(var(--wine-muted)/0.55)] text-[hsl(var(--wine))]",
  core:
    "border border-[hsl(var(--wine)/0.28)] bg-[hsl(var(--wine-muted)/0.38)] text-[hsl(var(--wine))]",
  mid:
    "border border-[hsl(var(--terracotta)/0.42)] bg-[hsl(var(--terracotta)/0.14)] text-[hsl(18_26%_36%)]",
  low:
    "border border-[hsl(var(--sand))] bg-[hsl(var(--warm-charcoal)/0.05)] text-[hsl(var(--warm-charcoal-muted))]",
  guest:
    "border border-[hsl(var(--wine)/0.18)] bg-[hsl(var(--wine-muted)/0.25)] text-[hsl(var(--wine)/0.85)]",
};

function phaseChipText(phase: ProjectPhase | undefined): string {
  const safe = normalizeProjectPhase(phase);
  const english = safe.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "ACTIVE";
  const cn = safe.match(/（(.+?)）/)?.[1] ?? "";
  return `${english} ${cn}`.trim();
}

function phaseBadgeClass(phase: ProjectPhase | undefined): string {
  return PHASE_BADGE_CLASS[normalizeProjectPhase(phase)];
}

/** 卡片脚注用短标签，避免与对话区完整称谓重复抢视觉 */
function roleFootnote(role: WorkspaceRole): string {
  return roleLabelForProject(role);
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
  const role = getProjectRole(userId, project.id, project.createdBy);
  const roleLabel = roleFootnote(role);
  const previewText = role === "guest" ? project.guestSummary : project.summary;

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
        "group relative flex h-full min-h-[320px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-[hsl(var(--sand)/0.75)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(253,250,245,0.96)_100%)] p-6 text-left shadow-[0_18px_42px_-30px_rgba(73,45,41,0.42)] transition-all duration-300",
        "hover:-translate-y-1 hover:border-[hsl(var(--wine-deep)/0.32)] hover:shadow-[0_24px_52px_-28px_rgba(73,45,41,0.55)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--wine-deep)/0.35)]"
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--wine-deep)/0.14)] bg-[hsl(var(--wine-muted)/0.5)] text-[hsl(var(--wine-deep)/0.78)] transition-colors group-hover:border-[hsl(var(--wine-deep)/0.22)] group-hover:bg-[hsl(var(--wine-muted)/0.72)] group-hover:text-[hsl(var(--wine-deep))]">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-sm",
            phaseBadgeClass(project.phase),
          )}
        >
          {phaseChipText(project.phase)}
        </span>
      </div>
      <h2 className="line-clamp-2 font-display text-[1.08rem] font-semibold leading-snug tracking-[0.01em] text-[hsl(var(--warm-charcoal))]">
        {project.name}
      </h2>
      <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--warm-charcoal-muted)/0.72)]">
        {project.category}
      </p>
      <p
        title={previewText}
        className="mt-5 line-clamp-4 flex-1 text-sm leading-[1.75] text-[hsl(var(--warm-charcoal-muted))]"
      >
        {previewText}
      </p>
      <div className="mt-5 flex shrink-0 items-end justify-between gap-3 border-t border-[hsl(var(--sand)/0.75)] pt-4">
        <span
          className={cn(
            "inline-flex min-w-0 items-center rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
            ROLE_PILL_CLASS[role]
          )}
        >
          本项目权限 {roleLabel}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[hsl(var(--wine-deep))] transition-all group-hover:gap-1.5">
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
  const [detailProject, setDetailProject] = useState<WorkspaceProject | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<"all" | ProjectPhase>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | WorkspaceRole>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDetail, setNewProjectDetail] = useState("");
  const [newProjectOpenness, setNewProjectOpenness] = useState<ProjectOpenness>("partial");
  const [participantKeyword, setParticipantKeyword] = useState("");
  const [participants, setParticipants] = useState<CreateParticipant[]>([]);
  const [newProjectFiles, setNewProjectFiles] = useState<File[]>([]);
  const [createHint, setCreateHint] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(Boolean(showCreateModal || detailProject || createHint));

  useEffect(() => {
    const id = loadSessionUserId();
    if (!id) {
      navigate("/app/login", { replace: true });
      return;
    }
    setUserId(id);
  }, [navigate]);

  useMyProjectRoles(userId);

  useEffect(() => {
    if (!userId || !ENABLE_LIVE_CHAT) return;
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsLoadError(null);
    void fetchProjectsFromApi()
      .then((rows) => {
        if (!cancelled) setApiProjects(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setProjectsLoadError(
            e instanceof Error ? e.message : "项目列表同步失败，请稍后刷新",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** 全开放项目对所有用户可见，不再需要单独配置参与人员与分级 */
  useEffect(() => {
    if (newProjectOpenness !== "public") return;
    setParticipants([]);
    setParticipantKeyword("");
  }, [newProjectOpenness]);

  const user = getUserById(userId);
  const visibleProjects = sortProjectsForOverview(
    filterProjectsForUser(userId ?? "", getMergedProjects()),
  );
  const phaseOptions = Array.from(new Set(visibleProjects.map((p) => p.phase)));
  const roleOptions = userId
    ? Array.from(
        new Set(
          visibleProjects.map((p) => getProjectRole(userId, p.id, p.createdBy))
        )
      )
    : [];
  const filteredProjects = userId
    ? visibleProjects.filter((p) => {
        const role = getProjectRole(userId, p.id, p.createdBy);
        if (phaseFilter !== "all" && p.phase !== phaseFilter) return false;
        if (roleFilter !== "all" && role !== roleFilter) return false;
        return true;
      })
    : [];

  const resetCreateForm = () => {
    setNewProjectName("");
    setNewProjectDetail("");
    setNewProjectOpenness("partial");
    setParticipantKeyword("");
    setParticipants([]);
    setNewProjectFiles([]);
    setCreatingProject(false);
  };

  const confirmCreateProject = () => {
    if (creatingProject || !userId) return;
    const name = newProjectName.trim();
    if (!name) {
      setCreateHint("请先填写项目名称。");
      return;
    }
    if (!ENABLE_LIVE_CHAT) {
      setCreateHint("未配置线上 API（VITE_AI_CHAT_ENDPOINT），无法创建项目。");
      return;
    }
    setCreatingProject(true);
    void (async () => {
      try {
        const project = await createProjectViaApi({
          name,
          detail: newProjectDetail.trim() || undefined,
          userId,
          participants: participants.map((p) => ({
            userId: p.userId,
            role: p.permission,
          })),
        });
        try {
          const roles = await fetchMyProjectRoles(userId);
          setMyProjectRoles(roles);
        } catch {
          /* 角色缓存刷新失败不阻断 */
        }
        upsertApiProject(project);
        const files = [...newProjectFiles];
        const uploadErrors: string[] = [];
        for (const file of files) {
          try {
            await uploadProjectPackageFile(project.id, userId, file);
          } catch (e) {
            uploadErrors.push(
              `${file.name}：${e instanceof Error ? e.message : "上传失败"}`,
            );
          }
        }
        setShowCreateModal(false);
        resetCreateForm();
        const uploadNote =
          uploadErrors.length > 0
            ? `\n\n部分附件未上传成功：\n${uploadErrors.join("\n")}`
            : files.length > 0
              ? `\n\n已上传 ${files.length - uploadErrors.length} 个资料包文件。`
              : "";
        setCreateHint(
          `项目「${project.name}」已保存。请在列表中点击卡片查看详情并进入对话。${uploadNote}`,
        );
      } catch (e) {
        setCreateHint(
          e instanceof Error ? e.message : "创建项目失败，请稍后重试。",
        );
      } finally {
        setCreatingProject(false);
      }
    })();
  };

  const participantOptions = Object.values(WORKSPACE_USERS)
    .map((u) => ({
      userId: u.id,
      name: prettyMemberName(u.displayName),
      searchText: `${u.displayName} ${prettyMemberName(u.displayName)} ${u.id}`.toLowerCase(),
    }))
    .filter((option) => {
    const kw = participantKeyword.trim().toLowerCase();
    if (!kw) return false;
      return option.searchText.includes(kw);
    })
    .filter((option) => !participants.some((p) => p.userId === option.userId));

  const addParticipant = (option: { userId: string; name: string }) => {
    setParticipants((prev) => {
      if (prev.some((p) => p.userId === option.userId)) return prev;
      return [...prev, { userId: option.userId, name: option.name, permission: "mid" }];
    });
    setParticipantKeyword("");
  };

  const removeParticipant = (userId: string) => {
    setParticipants((prev) => prev.filter((p) => p.userId !== userId));
  };

  const updateParticipantPermission = (userId: string, permission: CreatePermission) => {
    setParticipants((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, permission } : p))
    );
  };

  const addDemoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    setNewProjectFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...prev];
      picked.forEach((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) merged.push(f);
      });
      return merged;
    });
  };

  const removeDemoFile = (idx: number) => {
    setNewProjectFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  if (!userId || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mb-4 rounded-[1.5rem] border border-[hsl(var(--sand)/0.88)] bg-[linear-gradient(160deg,rgba(255,255,255,0.84)_0%,rgba(255,250,244,0.92)_58%,rgba(247,240,231,0.9)_100%)] p-5 shadow-[0_20px_44px_-40px_rgba(70,44,40,0.55)] backdrop-blur-md md:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,19.5rem)] xl:items-start">
            <div>
              <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[hsl(var(--wine-deep)/0.85)]">
                Portfolio
              </p>
              <h1 className="mt-1.5 font-display text-[1.8rem] font-semibold tracking-tight text-[hsl(var(--wine-deep))] md:text-[1.95rem]">
                项目总览
              </h1>
              <p className="mt-2 max-w-[60ch] text-sm leading-[1.65] text-[hsl(var(--warm-charcoal-muted))]">
                全平台在管共{" "}
                <span className="font-display text-base font-semibold tabular-nums text-[hsl(var(--wine-deep))]">
                  {visibleProjects.length}
                </span>{" "}
                个项目
                {phaseFilter !== "all" || roleFilter !== "all" ? (
                  <>
                    ，当前筛选显示{" "}
                    <span className="font-semibold text-[hsl(var(--wine-deep))]">
                      {filteredProjects.length}
                    </span>{" "}
                    个
                  </>
                ) : null}
                。当前登录{" "}
                <span className="rounded-md border border-[hsl(var(--wine-deep)/0.26)] bg-[hsl(var(--wine-muted)/0.8)] px-1.5 py-0.5 font-medium text-[hsl(var(--wine-deep))]">
                  {user.displayName}
                </span>
                。点击卡片从右侧展开项目详情，内容与「本项目」角色一致。
              </p>
              {projectsLoading ? (
                <p className="mt-2 text-xs text-[hsl(var(--warm-charcoal-muted))]">正在同步云端项目...</p>
              ) : null}
              {projectsLoadError ? (
                <p className="mt-2 text-xs text-amber-700">{projectsLoadError}</p>
              ) : null}
            </div>
            <div className="w-full space-y-3 rounded-xl border border-[hsl(var(--sand)/0.9)] bg-white/68 p-3.5 sm:w-auto sm:min-w-[220px]">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true);
                  setCreateHint(null);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--wine-deep)/0.62)] bg-[hsl(var(--wine-deep)/0.88)] px-3 py-2 text-sm font-semibold text-[hsl(var(--wine-deep-foreground))] shadow-[0_10px_24px_-14px_hsl(var(--wine-deep)/0.52)] transition-colors hover:bg-[hsl(var(--wine-deep)/0.78)]"
              >
                <Plus className="h-4 w-4" />
                新建项目
              </button>
              <div className="rounded-lg border border-[hsl(var(--sand)/0.75)] bg-white/72 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--wine-deep))]">
                  <Filter className="h-3.5 w-3.5" strokeWidth={2} />
                  筛选器
                </div>
                <div className="flex flex-col gap-2.5">
                  <label className="block">
                    <select
                      value={phaseFilter}
                      onChange={(e) => setPhaseFilter(e.target.value as "all" | ProjectPhase)}
                      className="w-full rounded-lg border border-[hsl(var(--sand)/0.85)] bg-white/90 px-3 py-1.5 text-[13px] text-[hsl(var(--warm-charcoal))] outline-none transition hover:border-[hsl(var(--wine-deep)/0.35)] focus:border-[hsl(var(--wine-deep)/0.55)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.15)]"
                    >
                      <option value="all">全部状态</option>
                      {phaseOptions.map((phase) => (
                        <option key={phase} value={phase}>
                          {phase}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as "all" | WorkspaceRole)}
                      className="w-full rounded-lg border border-[hsl(var(--sand)/0.85)] bg-white/90 px-3 py-1.5 text-[13px] text-[hsl(var(--warm-charcoal))] outline-none transition hover:border-[hsl(var(--wine-deep)/0.35)] focus:border-[hsl(var(--wine-deep)/0.55)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.15)]"
                    >
                      <option value="all">全部权限</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {roleLabelForProject(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 items-stretch gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((p) => (
              <div key={p.id}>
                <ProjectCard
                  project={p}
                  userId={userId}
                  onOpenDetail={() => setDetailProject(p)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[hsl(var(--sand)/0.9)] bg-white/70 px-6 py-10 text-center shadow-sm">
            <p className="font-display text-lg font-semibold text-[hsl(var(--wine-deep))]">暂无匹配项目</p>
            <p className="mt-2 text-sm text-[hsl(var(--warm-charcoal-muted))]">
              尝试切换筛选条件，或点击右上角「新建项目」补充新的项目卡片。
            </p>
          </div>
        )}
      </div>

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
        >
          <div className="flex max-h-[min(86vh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[hsl(var(--sand)/0.9)] bg-white shadow-[0_24px_56px_-24px_rgba(46,30,28,0.45)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out sm:max-w-lg">
            <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <div className="min-w-0 pr-2">
                <h2
                  id="create-project-title"
                  className="font-display text-base font-semibold text-[hsl(var(--wine-deep))] sm:text-[1.05rem]"
                >
                  新建项目
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--warm-charcoal-muted))]">
                  基础信息与参考附件
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-5 sm:py-3">
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[hsl(var(--warm-charcoal))]">
                  项目名称
                </span>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="请输入项目名称"
                  className="w-full rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-2.5 py-2 text-sm outline-none transition focus:border-[hsl(var(--wine-deep)/0.45)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.12)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[hsl(var(--warm-charcoal))]">
                  项目详情
                </span>
                <textarea
                  value={newProjectDetail}
                  onChange={(e) => setNewProjectDetail(e.target.value)}
                  rows={3}
                  placeholder="简介、结构、里程碑与资源需求（选填）"
                  className="w-full resize-none rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-2.5 py-2 text-sm leading-relaxed outline-none transition focus:border-[hsl(var(--wine-deep)/0.45)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.12)]"
                />
              </label>

              <div>
                <span className="mb-1 block text-xs font-medium text-[hsl(var(--warm-charcoal))]">
                  项目开放程度
                </span>
                <select
                  value={newProjectOpenness}
                  onChange={(e) => setNewProjectOpenness(e.target.value as ProjectOpenness)}
                  className="w-full rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-2.5 py-2 text-sm text-[hsl(var(--warm-charcoal))] outline-none transition focus:border-[hsl(var(--wine-deep)/0.45)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.12)]"
                >
                  {PROJECT_OPENNESS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--warm-charcoal-muted))]">
                  {
                    PROJECT_OPENNESS_OPTIONS.find((item) => item.value === newProjectOpenness)
                      ?.description
                  }
                </p>
              </div>

              {newProjectOpenness !== "public" ? (
                <div>
                  <span className="mb-1 block text-xs font-medium text-[hsl(var(--warm-charcoal))]">
                    参与人员与权限
                  </span>
                  <div className="rounded-lg border border-[hsl(var(--sand)/0.9)] bg-[hsl(var(--linen)/0.35)] p-2.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={participantKeyword}
                        onChange={(e) => setParticipantKeyword(e.target.value)}
                        placeholder="请输入成员名/昵称"
                        className="w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/30"
                      />
                      {participantOptions.length > 0 ? (
                        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border/70 bg-white shadow-lg">
                          {participantOptions.map((option) => (
                            <li key={option.userId}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addParticipant(option);
                                }}
                                className="flex w-full items-center px-3 py-2 text-left text-sm text-foreground transition hover:bg-primary/10"
                              >
                                {option.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {participants.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {participants.map((member) => (
                          <li
                            key={member.userId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/65 bg-muted/10 px-3 py-2"
                          >
                            <span className="text-sm font-medium text-foreground">{member.name}</span>
                            <div className="flex items-center gap-2">
                              <select
                                value={member.permission}
                                onChange={(e) =>
                                  updateParticipantPermission(
                                    member.userId,
                                    e.target.value as CreatePermission
                                  )
                                }
                                className="rounded-md border border-border/60 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-primary/30"
                              >
                                {CREATE_PERMISSION_OPTIONS.map((perm) => (
                                  <option key={perm} value={perm}>
                                    {roleLabelForProject(perm)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeParticipant(member.userId)}
                                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={`移除 ${member.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        选择成员后可为其分配权限等级 Core 核心级 / Advanced 进阶级 / Basic 基础级，用于控制后续项目访问范围。
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div>
                <span className="mb-1 block text-xs font-medium text-[hsl(var(--warm-charcoal))]">
                  参考附件
                </span>
                <div className="rounded-lg border border-dashed border-[hsl(var(--sand))] bg-[hsl(var(--linen)/0.4)] p-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--sand)/0.9)] bg-white px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--warm-charcoal))] transition hover:border-[hsl(var(--wine-deep)/0.35)]"
                  >
                    <Upload className="h-3.5 w-3.5 text-[hsl(var(--wine-deep))]" />
                    选择文件
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => {
                      addDemoFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    已选择 {newProjectFiles.length} 个文件
                  </p>
                  {newProjectFiles.length > 0 ? (
                    <ul className="mt-2 max-h-28 space-y-1.5 overflow-y-auto pr-0.5">
                      {newProjectFiles.map((f, idx) => (
                        <li
                          key={`${f.name}-${f.size}-${f.lastModified}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/65 bg-white px-3 py-2 text-xs"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary/80" />
                            <span className="truncate">{f.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDemoFile(idx)}
                            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="移除附件"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">尚未选择附件。</p>
                  )}
                </div>
              </div>
            </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 bg-[hsl(var(--linen)/0.5)] px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  if (creatingProject) return;
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-3 py-1.5 text-xs font-medium text-[hsl(var(--warm-charcoal))] transition hover:bg-white/80 sm:text-sm sm:px-3.5 sm:py-2"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmCreateProject}
                disabled={creatingProject}
                className="rounded-lg border border-[hsl(var(--wine-deep))] bg-[hsl(var(--wine-deep))] px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--wine-deep-foreground))] transition hover:bg-[hsl(353_42%_28%)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-90 sm:text-sm sm:px-4 sm:py-2"
              >
                {creatingProject ? "创建中..." : "确定"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createHint ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px] animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-result-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-150 ease-out">
            <h3 id="create-result-title" className="text-base font-bold text-emerald-900">
              创建结果
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-emerald-800">{createHint}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCreateHint(null)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailProject ? (
        <ProjectDetailDrawer
          project={detailProject}
          userId={userId}
          detailTier={workspaceRoleToDetailTier(
            getProjectRole(userId, detailProject.id, detailProject.createdBy),
          )}
          onClose={() => setDetailProject(null)}
          onGuestTryChat={() => setGuestDialog(true)}
          onProjectUpdated={(updated) => {
            upsertApiProject(updated);
            setDetailProject(updated);
          }}
          onProjectDeleted={(id) => {
            removeApiProject(id);
            setDetailProject(null);
            if (loadLastChatProjectId() === id) clearLastChatProjectId();
            setCreateHint("项目已删除。");
          }}
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
