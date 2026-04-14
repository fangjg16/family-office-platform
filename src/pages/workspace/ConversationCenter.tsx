import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  FileUp,
  LayoutGrid,
  Paperclip,
  Plane,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { cn } from "@/lib/utils";
import {
  getProjectResourceDemo,
  type ProjectChatSnippet,
} from "@/workspace/project-resource-demos";
import { ALL_PROJECTS, getProjectById } from "@/workspace/projects";
import { loadSessionUserId, saveLastProjectId } from "@/workspace/session";
import type { WorkspaceRole } from "@/workspace/types";
import {
  canEnterChat,
  getProjectRole,
  getUserById,
  workspaceRoleToUiTier,
  type UiTier,
} from "@/workspace/workspace-users";
import type { WorkspaceUser } from "@/workspace/types";

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[85%] rounded-3xl rounded-br-lg border border-slate-700/10 bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-3 text-sm font-medium leading-relaxed text-slate-50",
          "shadow-[0_2px_12px_-2px_rgba(15,23,42,0.12)]",
          "transition-transform duration-300 hover:scale-[1.005]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function AiShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[92%] rounded-3xl rounded-bl-lg border border-border/80 bg-white px-5 py-4 text-sm leading-relaxed text-foreground",
          "shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** 对话内「已发送附件」：与用户气泡同色系，仅展示文件名（非上传引导） */
function ChatSentFilesPanel({ files }: { files: readonly { name: string }[] }) {
  if (files.length === 0) return null;
  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,28rem)] rounded-2xl rounded-br-lg border border-slate-700/25",
        "bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3",
        "shadow-[0_2px_12px_-2px_rgba(15,23,42,0.12)]"
      )}
    >
      <div className="mb-2.5 flex items-center gap-2 border-b border-white/10 pb-2">
        <Paperclip className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
        <span className="text-[11px] font-semibold tracking-wide text-slate-400">
          已发送 {files.length} 个文件
        </span>
      </div>
      <div className="space-y-2">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5"
          >
            <span className="truncate text-xs font-medium text-slate-100">{f.name}</span>
            <span className="shrink-0 text-[10px] font-semibold text-sky-400">已送达</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceTableBlock({
  tier,
  workspaceRole,
  projectId,
  projectName,
}: {
  tier: UiTier;
  workspaceRole: WorkspaceRole;
  projectId: string;
  projectName: string;
}) {
  const demo = getProjectResourceDemo(projectId);

  const intro =
    tier === "full"
      ? workspaceRole === "admin"
        ? `${projectName}当前共有 3 个家族在智库中登记资源（Admin：可见全站字段，并可调整各维度评分权重，如供应链因素占比）。`
        : `${projectName}当前共有 3 个家族在智库中登记资源（Core：可录入与修改本家族数据，不可见其他家族明细）。`
      : tier === "mid"
        ? "以下为经脱敏后的资源配置概览：家族以代号呈现，资金为区间描述，细节模糊至区域级。"
        : "按您的权限，仅展示各环节是否已具备资源覆盖情况，不展示主体身份与具体金额。";

  const rows =
    tier === "full"
      ? demo.coreRows
      : tier === "mid"
        ? demo.secondaryRows
        : demo.brokerRows;

  const cols =
    tier === "low"
      ? ["环节", "家族/金额", "状态", "备注"]
      : ["家族", "资金", "状态", "核心资源"];

  const warn =
    tier === "full"
      ? demo.coreWarn
      : tier === "mid"
        ? demo.secondaryWarn
        : demo.brokerWarn;

  const foot =
    tier === "full"
      ? workspaceRole === "admin"
        ? "权限同步 · Admin · 可调整评分维度权重"
        : "权限同步 · Core · 本家族数据可维护，其他家族不可见"
      : tier === "mid"
        ? "权限同步 · Mid · 脱敏与简化视图"
        : "权限同步 · Low · 最低权限对话";

  return (
    <AiShell>
      <p className="mb-3 text-muted-foreground">{intro}</p>
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-white/60">
        <table className="w-full min-w-[320px] text-left text-xs md:text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2.5 font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((row, i) => (
              <tr key={i} className="bg-white/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 font-medium">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-xs font-medium leading-relaxed text-amber-950/80">
        {warn}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">● {foot}</p>
    </AiShell>
  );
}

function MidRefusalBlock({ body }: { body: string }) {
  return (
    <AiShell>
      <p className="text-sm font-semibold text-foreground">无法按此问题回答</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● 权限同步 · Mid · 隐私与主体路径未开放
      </p>
    </AiShell>
  );
}

function MidTextBlock({ title, body }: { title?: string; body: string }) {
  return (
    <AiShell>
      {title ? (
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      ) : null}
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        {body}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● Master Agent · Mid · 定性说明
      </p>
    </AiShell>
  );
}

function CredibilityBlock({
  tier,
  chat,
  midSummaryLines,
}: {
  tier: UiTier;
  chat: ProjectChatSnippet;
  /** Mid：在报告卡片前逐条回应用户多问 */
  midSummaryLines?: string[];
}) {
  if (tier === "low") {
    return (
      <AiShell>
        <p className="text-muted-foreground">
          按 Low 权限，无法展示具体合作方名称与金额可信度拆解。核心团队已在内部记录「外部大额意向」的折算规则，您只需知晓：该笔投入在评分中
          <strong className="text-foreground">不会</strong>
          按已确认资金满分计入。
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ● 权限同步 · Low · 隐藏主体与数值
        </p>
      </AiShell>
    );
  }

  if (tier === "mid") {
    return (
      <AiShell>
        <div className="mb-2 text-base font-bold text-foreground">
          {`可信度检测报告 · ${chat.credibilityTitleSecondary}`}
        </div>
        {midSummaryLines && midSummaryLines.length > 0 ? (
          <div className="mb-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">
              追问要点 · 逐条说明
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-foreground md:text-sm">
              {midSummaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Mid 权限：<strong className="text-foreground">评分、折算系数与金额口径的具体数值</strong>
          不对本视图展示，以下为定性摘要。
        </p>
        <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <p className="text-muted-foreground">可信度评分</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">折算系数</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">有效金额（评分用）</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">风险等级</p>
            <p className="font-semibold text-amber-800/90">中</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          建议：补充加盖公章的意向函或资金路径说明，有助于提升折算档位与方案排序（具体系数与分值仅 Admin/Core 可见）。
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ● Sub-Agent 5 · 吹牛检测与资金分级 · Mid 脱敏
        </p>
      </AiShell>
    );
  }

  return (
    <AiShell>
      <div className="mb-2 text-base font-bold text-foreground">
        {`可信度检测报告 · ${chat.credibilityTitleCore}`}
      </div>
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs md:grid-cols-2 md:text-sm">
        <div>
          <p className="text-muted-foreground">可信度评分</p>
          <p className="font-bold text-foreground">75 / 100</p>
        </div>
        <div>
          <p className="text-muted-foreground">折算系数</p>
          <p className="font-bold text-foreground">0.8</p>
        </div>
        <div>
          <p className="text-muted-foreground">有效金额（评分用）</p>
          <p className="font-bold text-foreground">2,400 万</p>
        </div>
        <div>
          <p className="text-muted-foreground">风险等级</p>
          <p className="font-semibold text-amber-800/90">中</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        建议：补充加盖公章的意向函或资金路径说明，可将折算系数上调，改善方案排名。
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        ● Sub-Agent 5 · 吹牛检测与资金分级
      </p>
    </AiShell>
  );
}

function RankingBlock({
  tier,
  chat,
}: {
  tier: UiTier;
  chat: ProjectChatSnippet;
}) {
  if (tier === "low") {
    return (
      <AiShell>
        <p className="text-base font-bold text-foreground">
          可行合作路径
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          系统已生成多条理论可行组合，并按环节覆盖情况完成初筛。具体排名、分值与参与方细节仅向 Admin / Core 全量开放。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>若需推进签约，请通过核心对接人发起「方案评审」流程。</li>
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ● Agent 流水线 · 输出已按权限截断
        </p>
      </AiShell>
    );
  }

  const plans =
    tier === "full" ? chat.rankingPlansCore : chat.rankingPlansSecondary;

  return (
    <AiShell>
      {tier === "mid" ? (
        <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950/90">
          Mid 权限：仅展示组合与推荐标记，<strong>具体分值隐藏</strong>；不可在本视图
          <strong>触发重新评分</strong>；如需调整维度权重，请联系 Admin 或 Core。
        </p>
      ) : null}
      <p className="mb-3 text-muted-foreground">
        {tier === "mid"
          ? "以下为 Sub-Agent 4 生成的组合地图经 Sub-Agent 5 排序后的前三名（Mid：名次与组合可见，具体分数隐藏）。"
          : "以下为 Sub-Agent 4 生成的组合地图经 Sub-Agent 5 评分后的前三名（最终以人工确认稿为准）。"}
      </p>
      <div className="space-y-2.5">
        {plans.map((p) => (
          <div
            key={p.rank}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs transition-all duration-300 md:text-sm",
              p.rec
                ? "border-primary/45 bg-primary/10 shadow-sm"
                : "border-border bg-background/60"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-muted-foreground">#{p.rank}</span>
              <span className="font-semibold text-foreground">{p.name}</span>
              {p.rec && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  推荐
                </span>
              )}
            </div>
            {tier === "mid" ? (
              <span className="text-[11px] font-semibold text-muted-foreground">
                分值 · 隐藏
              </span>
            ) : (
              <span className="font-bold text-primary">{p.score} 分</span>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {chat.rankingBullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● Agent A（调取）→ Agent B（评分）→ Agent C（决策）→ 输出
      </p>
    </AiShell>
  );
}

function permissionLineFor(role: WorkspaceRole): string {
  switch (role) {
    case "admin":
      return "Master Agent · Admin · 全站管理 / 评分权重可配置";
    case "core":
      return "Master Agent · Core · 财务细节与完整评分";
    case "mid":
      return "Master Agent · Mid · 脱敏视图 · 不可触发重新评分";
    case "low":
      return "Master Agent · Low · 最低权限对话";
    default:
      return "";
  }
}

export default function ConversationCenter() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = loadSessionUserId();
    if (!id) {
      navigate("/app/login", { replace: true });
      return;
    }
    const u = getUserById(id);
    if (!u) {
      navigate("/app/login", { replace: true });
      return;
    }
    setUserId(id);
    setUser(u);
  }, [navigate]);

  const project = projectId ? getProjectById(projectId) : undefined;

  const projectRole = useMemo(() => {
    if (!userId || !projectId) return null;
    return getProjectRole(userId, projectId);
  }, [userId, projectId]);

  const tier = projectRole
    ? workspaceRoleToUiTier(projectRole)
    : null;

  useEffect(() => {
    if (!userId || !projectId || !projectRole) return;
    if (projectRole === "guest") {
      navigate("/app/projects", { replace: true });
      return;
    }
    if (!getProjectById(projectId)) {
      navigate("/app/projects", { replace: true });
      return;
    }
    saveLastProjectId(projectId);
  }, [userId, projectId, projectRole, navigate]);

  const resourceDemo = useMemo(
    () => getProjectResourceDemo(projectId ?? ""),
    [projectId]
  );

  const otherProject = useMemo(() => {
    if (!userId || !projectId) return undefined;
    return ALL_PROJECTS.find(
      (p) =>
        p.id !== projectId &&
        canEnterChat(getProjectRole(userId, p.id))
    );
  }, [userId, projectId]);

  const permissionLine = projectRole
    ? permissionLineFor(projectRole)
    : "";

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...prev];
      Array.from(files).forEach((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) merged.push(f);
      });
      return merged;
    });
    setShowUploadPanel(true);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  if (!user || !userId || !tier || !projectRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!projectId || !project || projectRole === "guest") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        正在跳转项目总览…
      </div>
    );
  }

  const chatTitle = `${project.name} · 全局分析`;

  return (
    <WorkspaceShell
      shellClassName="h-screen overflow-hidden"
      contentClassName="overflow-hidden pb-3"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:rounded-[1.75rem] md:border md:border-border/45 md:bg-white/55 md:shadow-[0_28px_90px_-48px_rgba(37,99,235,0.2)] md:backdrop-blur-xl">
        <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-border/60 bg-white/70 backdrop-blur-md md:w-[17rem] md:rounded-l-[1.75rem] md:border-b-0 md:border-r md:border-border/50">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner shadow-primary/5 transition-colors hover:from-primary/20">
              <Sparkles size={24} strokeWidth={2} />
            </div>
            <div>
              <p className="font-display text-sm font-bold leading-tight text-foreground">
                对话中心
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                合域 · Joint Office
              </p>
            </div>
          </div>
        </div>
        <div className="px-3 pt-2">
          <Link
            to="/app/projects"
            className="flex items-center gap-2 rounded-2xl border border-border/60 bg-white/80 px-3 py-2.5 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary/25 hover:text-primary"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2} />
            项目总览
          </Link>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-3">
          <div className="w-full rounded-3xl border border-primary/15 bg-primary/[0.06] px-3 py-3 text-left shadow-sm">
            <p className="font-bold text-primary">{chatTitle}</p>
            <p className="text-[11px] font-semibold text-muted-foreground">14:32</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {resourceDemo.chat.sidebarPreview}
            </p>
          </div>
          {otherProject ? (
            <Link
              to={`/app/chat/${otherProject.id}`}
              className="block w-full rounded-3xl px-3 py-3 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <p className="font-bold text-foreground">
                {otherProject.name} · 快速切换
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground">
                查看另一可进入的项目
              </p>
            </Link>
          ) : (
            <Link
              to="/app/projects"
              className="block w-full rounded-3xl px-3 py-3 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <p className="font-bold text-foreground">浏览全部项目</p>
              <p className="text-[11px] font-semibold text-muted-foreground">
                切换对话上下文
              </p>
            </Link>
          )}
        </nav>
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-2 rounded-3xl border border-border/80 bg-muted/40 px-2 py-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold",
                user.avatarClass
              )}
            >
              {user.avatarChar}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">
                {user.displayName}
              </p>
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                {user.orgTitle}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="刷新"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <Link
            to="/"
            className="mt-2 flex items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            返回官网
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-background/30 to-background/5 md:rounded-r-[1.75rem]">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-white/65 px-4 py-4 backdrop-blur-md md:px-6">
          <div>
            <Link
              to="/"
              className="mb-1 inline-block text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
            >
              合域
            </Link>
            <h1 className="text-lg font-bold text-foreground md:text-xl">
              {chatTitle}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Master Agent · 今天
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-semibold text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary/80" />
              Agent 在线
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
          {projectRole === "admin" ? (
            <AiShell>
              <p className="text-sm font-semibold text-primary">
                Admin 控制台
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                您可调整各维度评分权重。示例：供应链因素占比{" "}
                <span className="font-mono text-foreground">20% → 25%</span>{" "}
                已写入当前项目草稿；Core 用户可在本项目中维护本家族数据。
              </p>
            </AiShell>
          ) : null}

          <UserBubble>
            请概述「{project.name}」目前的资源配置全貌
          </UserBubble>
          <ResourceTableBlock
            tier={tier}
            workspaceRole={projectRole}
            projectId={project.id}
            projectName={project.name}
          />

          {tier === "full" &&
          resourceDemo.chat.supplyExchanges &&
          resourceDemo.chat.supplyExchanges.length > 0
            ? resourceDemo.chat.supplyExchanges.map((ex, i) => (
                <div key={`supply-${i}`} className="space-y-6">
                  <div className="flex flex-col items-end gap-3">
                    {ex.attachments && ex.attachments.length > 0 ? (
                      <ChatSentFilesPanel files={ex.attachments} />
                    ) : null}
                    <UserBubble>{ex.userLine}</UserBubble>
                  </div>
                  {ex.confirmation ? (
                    <>
                      <AiShell>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                          {ex.confirmation.agentPrompt}
                        </p>
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          ● Master Agent · 待您确认
                        </p>
                      </AiShell>
                      <UserBubble>{ex.confirmation.userConfirmLine}</UserBubble>
                    </>
                  ) : null}
                  <AiShell>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                      {ex.aiBody}
                    </p>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      ● Master Agent · 已入库 · 与本项目智库字段联动
                    </p>
                  </AiShell>
                </div>
              ))
            : null}

          {tier === "mid" &&
          resourceDemo.chat.midFollowUp &&
          resourceDemo.chat.midFollowUp.length > 0 ? (
            <>
              {resourceDemo.chat.midFollowUp.map((step, i) => (
                <div key={i} className="space-y-6">
                  <div className="flex flex-col items-end gap-3">
                    {step.kind === "text" &&
                    step.attachments &&
                    step.attachments.length > 0 ? (
                      <ChatSentFilesPanel files={step.attachments} />
                    ) : null}
                    <UserBubble>{step.userLine}</UserBubble>
                  </div>
                  {step.kind === "credibility" ? (
                    <CredibilityBlock
                      tier={tier}
                      chat={resourceDemo.chat}
                      midSummaryLines={
                        step.summaryLines && step.summaryLines.length > 0
                          ? step.summaryLines
                          : undefined
                      }
                    />
                  ) : step.kind === "refusal" ? (
                    <MidRefusalBlock body={step.body} />
                  ) : (
                    <MidTextBlock title={step.title} body={step.body} />
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <UserBubble>
                {tier === "low"
                  ? resourceDemo.chat.credibilityUserLineLow
                  : tier === "mid"
                    ? resourceDemo.chat.credibilityUserLineMid
                    : resourceDemo.chat.credibilityUserLine}
              </UserBubble>
              <CredibilityBlock tier={tier} chat={resourceDemo.chat} />
            </>
          )}

          <UserBubble>推荐最佳合作方案</UserBubble>
          <RankingBlock tier={tier} chat={resourceDemo.chat} />
        </div>

        <footer className="relative border-t border-border/50 bg-white/70 px-4 py-4 backdrop-blur-md md:rounded-br-[1.65rem] md:px-6">
          {showUploadPanel ? (
            <div className="mb-3 rounded-2xl border border-dashed border-primary/45 bg-white p-3 shadow-sm">
              <div
                className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-h-9 items-center gap-2 text-sm font-semibold text-foreground">
                    <FileUp className="h-4 w-4 text-primary" strokeWidth={2} />
                    拖拽文件到此处上传
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/8"
                  >
                    选择文件
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  支持格式：JPEG、DOC、PDF、PNG
                </p>
              </div>

              {selectedFiles.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((f, idx) => (
                    <div
                      key={`${f.name}-${f.size}-${f.lastModified}`}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-white px-3 py-2 text-xs"
                    >
                      <span className="truncate pr-3 text-foreground">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="移除文件"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              readOnly
              placeholder="输入消息，与 Master Agent 对话…"
              className="h-12 min-h-[48px] flex-1 rounded-full border border-input bg-white px-5 text-sm font-medium text-muted-foreground shadow-inner placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <button
              type="button"
              onClick={() => setShowUploadPanel((v) => !v)}
              className={cn(
                "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors",
                showUploadPanel
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-input bg-white hover:bg-muted hover:text-foreground"
              )}
              aria-label="上传文件"
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-[0_2px_12px_-2px_rgba(37,99,235,0.28)] transition-all hover:bg-primary/92 active:scale-[0.98]"
            >
              <Plane className="h-4 w-4" strokeWidth={2} />
              发送
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <p className="mt-3 text-center text-[11px] font-medium text-muted-foreground">
            {permissionLine}
          </p>
        </footer>
      </div>
    </div>
    </WorkspaceShell>
  );
}
