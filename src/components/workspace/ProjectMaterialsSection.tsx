import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  deleteProjectFile,
  fetchProjectFiles,
  uploadProjectPackageFile,
  type ProjectFileRecord,
} from "@/lib/project-api";

type ProjectMaterialsSectionProps = {
  projectId: string;
  userId: string;
  /** 有对话权限时允许上传、删除项目级资料包 */
  canManage?: boolean;
};

function formatFileDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function scopeLabel(scope: ProjectFileRecord["scope"]): string {
  return scope === "package" ? "项目资料包" : "对话临时";
}

export function ProjectMaterialsSection({
  projectId,
  userId,
  canManage = true,
}: ProjectMaterialsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [liveFiles, setLiveFiles] = useState<ProjectFileRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const useLive = ENABLE_LIVE_CHAT && Boolean(AI_CHAT_ENDPOINT);

  const reload = useCallback(async () => {
    if (!useLive || !userId) {
      setLiveFiles(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const files = await fetchProjectFiles(projectId, userId);
      setLiveFiles(files);
    } catch (e) {
      setLiveFiles([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, useLive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length || !useLive || !canManage) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        await uploadProjectPackageFile(projectId, userId, file);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDeleteFile = async (file: ProjectFileRecord) => {
    if (!useLive || !canManage || file.scope !== "package") return;
    const ok = window.confirm(
      `确定从项目资料包中删除「${file.filename}」？\n删除后对话检索将不再包含该文件内容，且无法恢复。`,
    );
    if (!ok) return;
    setDeletingId(file.id);
    setError(null);
    try {
      await deleteProjectFile(projectId, file.id, userId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const packageLive = (liveFiles ?? []).filter((f) => f.scope === "package");
  const hasAny = packageLive.length > 0;

  return (
    <section
      className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4"
      aria-labelledby="project-materials-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            id="project-materials-heading"
            className="text-xs font-bold uppercase tracking-wide text-foreground"
          >
            项目资料与附件
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            仅展示<strong className="font-semibold text-foreground">项目级资料包</strong>
            （全项目、各对话共用）。在对话里用回形针上传的文件，请在对话页右上角「本对话文件」查看。
          </p>
        </div>
        {useLive && canManage ? (
          <button
            type="button"
            disabled={uploading || Boolean(deletingId)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10",
              (uploading || deletingId) && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" aria-hidden />
            )}
            上传资料
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          加载资料列表…
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}

      {!loading && !hasAny ? (
        <p className="mt-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-[11px] leading-relaxed text-muted-foreground">
          {useLive
            ? "暂无项目资料包。可在此上传全项目共用的 .txt / .md / PDF；单次对话附件请在对话里上传。"
            : "暂无资料列表。开启 Live 对话并上传后可见。"}
        </p>
      ) : null}

      {packageLive.length > 0 ? (
        <MaterialsList
          title="项目资料包"
          items={packageLive}
          canDelete={useLive && canManage}
          deletingId={deletingId}
          onDelete={onDeleteFile}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        accept=".txt,.md,.pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,text/plain,text/markdown,application/pdf"
        onChange={(e) => void onPickFiles(e.target.files)}
      />
    </section>
  );
}

function liveToRow(f: ProjectFileRecord): { name: string; meta?: string } {
  return {
    name: f.filename,
    meta: `${scopeLabel(f.scope)} · ${formatFileDate(f.createdAt)}${f.chunkCount ? ` · ${f.chunkCount} 段` : ""}`,
  };
}

function MaterialsList({
  title,
  items,
  canDelete,
  deletingId,
  onDelete,
}: {
  title: string;
  items: ProjectFileRecord[];
  canDelete: boolean;
  deletingId: string | null;
  onDelete: (file: ProjectFileRecord) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((file) => {
          const row = liveToRow(file);
          const isDeleting = deletingId === file.id;
          return (
            <li
              key={file.id}
              className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" strokeWidth={2} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={row.name}>
                  {row.name}
                </p>
                {row.meta ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{row.meta}</p>
                ) : null}
              </div>
              {canDelete ? (
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => void onDelete(file)}
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600",
                    isDeleting && "pointer-events-none opacity-50",
                  )}
                  aria-label={`删除 ${row.name}`}
                  title="从资料包删除"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  )}
                </button>
              ) : (
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
