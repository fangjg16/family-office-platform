import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceProject } from "@/workspace/projects";
import {
  getProjectDetailContent,
  type ProjectDetailTier,
} from "@/workspace/project-details";
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
};

const PANEL_MS = 300;

export function ProjectDetailDrawer({
  project,
  userId,
  detailTier,
  onClose,
  onGuestTryChat,
}: ProjectDetailDrawerProps) {
  const [open, setOpen] = useState(false);

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

  if (!project) return null;

  const role = getProjectRole(userId, project.id);
  const chatOk = canEnterChat(role);
  const detail = getProjectDetailContent(project.id, detailTier);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!open}
        onClick={requestClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[90] flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-white shadow-[-12px_0_40px_-20px_rgba(15,23,42,0.2)] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
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
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无该项目的详情副本，请联系管理员。
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-border/60 bg-white/95 px-5 py-4 backdrop-blur-md md:px-6">
          {chatOk ? (
            <Link
              to={`/app/chat/${project.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_2px_12px_-2px_rgba(37,99,235,0.28)] transition-colors hover:bg-primary/92"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={2} />
              进入对话上下文
            </Link>
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
    </>
  );
}
