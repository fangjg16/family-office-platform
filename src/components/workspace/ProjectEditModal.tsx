import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateProjectViaApi } from "@/lib/project-api";
import type { ProjectPhase, WorkspaceProject } from "@/workspace/projects";

const PHASE_OPTIONS: ProjectPhase[] = [
  "Active（资源筹备中）",
  "Completed（已签约）",
  "Paused（暂停）",
  "Cancelled（已取消）",
];

type ProjectEditModalProps = {
  /** 稳定主键（勿随表单名称变化） */
  projectId: string;
  project: WorkspaceProject;
  userId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (project: WorkspaceProject) => void;
};

export function ProjectEditModal({
  projectId,
  project,
  userId,
  open,
  onClose,
  onSaved,
}: ProjectEditModalProps) {
  const [name, setName] = useState(project.name);
  const [detail, setDetail] = useState(project.summary);
  const [category, setCategory] = useState(project.category);
  const [phase, setPhase] = useState<ProjectPhase>(project.phase);
  const [guestSummary, setGuestSummary] = useState(project.guestSummary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setDetail(project.summary);
    setCategory(project.category);
    setPhase(project.phase);
    setGuestSummary(project.guestSummary);
    setError(null);
  }, [open, project]);

  if (!open) return null;

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("请填写项目名称");
      return;
    }
    setSaving(true);
    setError(null);
    void updateProjectViaApi(projectId, {
      name: trimmedName,
      detail: detail.trim(),
      category: category.trim() || "未分类",
      phase,
      guestSummary: guestSummary.trim(),
      userId,
    })
      .then((updated) => {
        onSaved(updated);
        onClose();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "保存失败");
      })
      .finally(() => setSaving(false));
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-edit-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/80 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h3 id="project-edit-title" className="text-base font-bold text-foreground">
            编辑项目
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className="font-medium text-foreground">项目名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border/70 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">项目简介</span>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-y rounded-lg border border-border/70 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Guest 可见摘要</span>
            <textarea
              value={guestSummary}
              onChange={(e) => setGuestSummary(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-y rounded-lg border border-border/70 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">行业分类</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border/70 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-foreground">项目状态</span>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as ProjectPhase)}
              className="mt-1.5 w-full rounded-lg border border-border/70 px-3 py-2 text-sm"
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={cn(
              "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground",
              saving && "opacity-80",
            )}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
