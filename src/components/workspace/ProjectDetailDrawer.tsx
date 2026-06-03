import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteProjectViaApi } from "@/lib/project-api";
import { ProjectEditModal } from "@/components/workspace/ProjectEditModal";
import type { WorkspaceProject } from "@/workspace/projects";
import {
  getProjectDetailContent,
  type ProjectDetailTier,
} from "@/workspace/project-details";
import { ProjectMaterialsSection } from "@/components/workspace/ProjectMaterialsSection";
import { ProjectKnowledgeNetworkSection } from "@/components/workspace/ProjectKnowledgeNetworkSection";
import {
  canUserManageProjectMetadata,
  formatProjectCreatedAt,
  isPersistedUserProject,
} from "@/workspace/project-manage";
import { isCloudProject } from "@/workspace/project-registry";
import {
  canEnterChat,
  getProjectRole,
  roleLabelForProject,
} from "@/workspace/workspace-users";

type ProjectDetailDrawerProps = {
  project: WorkspaceProject | null;
  userId: string;
  detailTier: ProjectDetailTier;
  onClose: () => void;
  onGuestTryChat: () => void;
  onProjectUpdated?: (project: WorkspaceProject) => void;
  onProjectDeleted?: (projectId: string) => void;
};

const PANEL_MS = 300;
const CHAT_ENTRY_TRANSITION_KEY = "workspace-chat-entry-transition";

export function ProjectDetailDrawer({
  project,
  userId,
  detailTier,
  onClose,
  onGuestTryChat,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectDetailDrawerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [enteringChat, setEnteringChat] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const enterTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    setOpen(false);
    window.setTimeout(onClose, PANEL_MS);
  }, [onClose]);

  useEffect(() => {
    if (!project) {
      setOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, requestClose]);

  useEffect(() => {
    return () => {
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current);
      }
    };
  }, []);

  if (!project) return null;

  const role = getProjectRole(userId, project.id);
  const chatOk = canEnterChat(role);
  const detail = getProjectDetailContent(project.id, detailTier);
  const canManage = canUserManageProjectMetadata(userId, project);
  const userCreated = isPersistedUserProject(project);
  const createdLabel = isCloudProject(project)
    ? formatProjectCreatedAt(project.createdAt)
    : null;

  const confirmDelete = () => {
    setDeleting(true);
    setManageError(null);
    void deleteProjectViaApi(project.id, userId)
      .then(() => {
        onProjectDeleted?.(project.id);
        setDeleteConfirm(false);
        requestClose();
      })
      .catch((e) => {
        setManageError(e instanceof Error ? e.message : "删除失败");
      })
      .finally(() => setDeleting(false));
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ease-out",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
          enteringChat && "opacity-60"
        )}
        aria-hidden={!open}
        onClick={requestClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[110] flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-white shadow-[-12px_0_40px_-20px_rgba(15,23,42,0.2)]",
          "transition-[transform,opacity,filter] duration-200 ease-out",
          open ? "translate-x-0 opacity-100 blur-0" : "translate-x-full opacity-0",
          enteringChat && "translate-x-1 opacity-95 blur-[1px]"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-detail-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-5 py-4 md:px-6">
          <div>
            <p className="font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-primary">
              {project.category}
            </p>
            <h2
              id="project-detail-title"
              className="mt-1 font-display text-lg font-semibold leading-snug text-foreground md:text-xl"
            >
              {project.name}
            </h2>
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">
              本项目视角：{roleLabelForProject(role)}
              {canManage ? " · 你是创建人，可编辑或删除" : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setManageError(null);
                    setEditOpen(true);
                  }}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="编辑项目"
                  title="编辑项目"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManageError(null);
                    setDeleteConfirm(true);
                  }}
                  className="rounded-full p-2 text-rose-500/90 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  aria-label="删除项目"
                  title="删除项目"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={requestClose}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6 md:px-6">
          {detail ? (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                {detail.lead}
              </p>
              {detail.chips.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.chips.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
              <dl className="mt-5 space-y-2.5 rounded-2xl border border-border/70 bg-muted/30 p-4">
                {detail.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {m.label}
                    </dt>
                    <dd className="text-sm font-medium text-foreground sm:text-right">
                      {m.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {detail.sections.map((sec) => (
                <section key={sec.title} className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                    {sec.title}
                  </h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
                    {sec.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <ProjectMaterialsSection
                projectId={project.id}
                userId={userId}
                canManage={chatOk && detailTier !== "guest"}
              />
              {detailTier !== "guest" ? (
                <ProjectKnowledgeNetworkSection projectId={project.id} userId={userId} />
              ) : null}
            </>
          ) : userCreated ? (
            <>
              <p className="text-sm leading-relaxed text-foreground">
                {detailTier === "guest" ? project.guestSummary : project.summary}
              </p>
              <dl className="mt-5 space-y-2.5 rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    状态
                  </dt>
                  <dd className="text-sm font-medium text-foreground">{project.phase}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    分类
                  </dt>
                  <dd className="text-sm font-medium text-foreground">{project.category}</dd>
                </div>
                {createdLabel ? (
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      创建时间
                    </dt>
                    <dd className="text-sm font-medium text-foreground">{createdLabel}</dd>
                  </div>
                ) : null}
              </dl>
              <ProjectMaterialsSection
                projectId={project.id}
                userId={userId}
                canManage={chatOk && detailTier !== "guest"}
              />
              {detailTier !== "guest" ? (
                <ProjectKnowledgeNetworkSection projectId={project.id} userId={userId} />
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                暂无该项目的详情副本，请联系管理员。
              </p>
              <ProjectMaterialsSection
                projectId={project.id}
                userId={userId}
                canManage={chatOk}
              />
            </>
          )}
          {manageError ? (
            <p className="mt-4 text-sm text-rose-600">{manageError}</p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border/60 bg-white/95 px-5 py-4 backdrop-blur-md md:px-6">
          {chatOk ? (
            <button
              type="button"
              onClick={() => {
                if (enteringChat) return;
                setEnteringChat(true);
                if (enterTimerRef.current !== null) {
                  window.clearTimeout(enterTimerRef.current);
                }
                enterTimerRef.current = window.setTimeout(() => {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.setItem(CHAT_ENTRY_TRANSITION_KEY, "1");
                  }
                  navigate(`/app/chat/${project.id}`);
                }, 180);
              }}
              disabled={enteringChat}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[hsl(var(--wine-deep))] bg-[hsl(var(--wine-deep))] py-3.5 text-sm font-semibold text-[hsl(var(--wine-deep-foreground))] shadow-[0_8px_22px_-10px_hsl(var(--wine-deep)/0.55)] transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-[hsl(353_42%_28%)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-90"
            >
              <MessageSquare
                className={cn("h-4 w-4", enteringChat && "animate-pulse")}
                strokeWidth={2}
              />
              {enteringChat ? "进入中..." : "进入对话上下文"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                requestClose();
                window.setTimeout(onGuestTryChat, PANEL_MS + 40);
              }}
              className="w-full rounded-full border border-border bg-muted/50 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              进入对话上下文（不可用）
            </button>
          )}
        </footer>
      </aside>

      {canManage ? (
        <ProjectEditModal
          projectId={project.id}
          project={project}
          userId={userId}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => onProjectUpdated?.(updated)}
        />
      ) : null}

      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl">
            <h3 id="delete-project-title" className="text-base font-bold text-foreground">
              删除项目？
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              将永久删除「{project.name}」及其资料包、对话记录，且无法恢复。请确认。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-80"
              >
                {deleting ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
