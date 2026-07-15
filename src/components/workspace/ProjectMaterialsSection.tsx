import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  deleteProjectFile,
  fetchProjectFiles,
  fileDisplayName,
  groupProjectFilesByFolder,
  projectFileDownloadUrl,
  splitStoredFilePath,
  uploadProjectPackageFile,
  type ProjectFileRecord,
} from "@/lib/project-api";

type ProjectMaterialsSectionProps = {
  projectId: string;
  userId: string;
  /** 有对话权限时允许上传、删除项目级资料包 */
  canManage?: boolean;
  /** Admin / Core / 创建人可下载原文件 */
  canDownload?: boolean;
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
  canDownload = false,
}: ProjectMaterialsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
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
    const uploadErrors: string[] = [];
    try {
      for (const file of Array.from(list)) {
        try {
          await uploadProjectPackageFile(projectId, userId, file);
        } catch (e) {
          uploadErrors.push(
            `${fileDisplayName(file)}：${e instanceof Error ? e.message : "上传失败"}`,
          );
        }
      }
      await reload();
      if (uploadErrors.length) {
        setError(`部分文件未上传成功：\n${uploadErrors.join("\n")}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const onDeleteFile = async (file: ProjectFileRecord) => {
    if (!useLive || !canManage || file.scope !== "package") return;
    const { folder, basename } = splitStoredFilePath(file.filename);
    const label = folder ? `${folder}/${basename}` : basename;
    const ok = window.confirm(
      `确定从项目资料包中删除「${label}」？\n删除后对话检索将不再包含该文件内容，且无法恢复。`,
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

  const onDeleteFolder = async (folder: string, files: ProjectFileRecord[]) => {
    if (!useLive || !canManage || !folder || files.length === 0) return;
    const ok = window.confirm(
      `确定删除文件夹「${folder}」中的全部 ${files.length} 个文件？\n删除后无法恢复。`,
    );
    if (!ok) return;
    setDeletingId(`folder:${folder}`);
    setError(null);
    const errors: string[] = [];
    try {
      for (const file of files) {
        if (file.scope !== "package") continue;
        try {
          await deleteProjectFile(projectId, file.id, userId);
        } catch (e) {
          errors.push(
            `${splitStoredFilePath(file.filename).basename}：${
              e instanceof Error ? e.message : "删除失败"
            }`,
          );
        }
      }
      await reload();
      if (errors.length) setError(`部分文件未删除：\n${errors.join("\n")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const packageLive = (liveFiles ?? []).filter((f) => f.scope === "package");
  const hasAny = packageLive.length > 0;
  const busy = uploading || Boolean(deletingId);

  return (
    <section
      className="mt-5 rounded-2xl border border-[hsl(var(--wine-deep)/0.18)] bg-[hsl(var(--wine-muted)/0.28)] p-4"
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
            （全项目、各对话共用）。上传文件夹后按路径分组展示；对话里用回形针上传的文件请在对话页右上角「本对话文件」查看。
          </p>
        </div>
        {useLive && canManage ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.06)] px-3 py-1.5 text-[11px] font-semibold text-[hsl(var(--wine-deep))] transition-colors hover:bg-[hsl(var(--wine-deep)/0.1)]",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              上传文件
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => folderInputRef.current?.click()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.06)] px-3 py-1.5 text-[11px] font-semibold text-[hsl(var(--wine-deep))] transition-colors hover:bg-[hsl(var(--wine-deep)/0.1)]",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              上传文件夹
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          加载资料列表…
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}

      {!loading && !hasAny ? (
        <p className="mt-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-[11px] leading-relaxed text-muted-foreground">
          {useLive
            ? "暂无项目资料包。可上传文件或整个文件夹（.txt / .md / PDF 等）；单次对话附件请在对话里上传。"
            : "暂无资料列表。开启 Live 对话并上传后可见。"}
        </p>
      ) : null}

      {packageLive.length > 0 ? (
        <MaterialsList
          title="项目资料包"
          items={packageLive}
          canDelete={useLive && canManage}
          canDownload={useLive && canDownload}
          projectId={projectId}
          userId={userId}
          deletingId={deletingId}
          onDelete={onDeleteFile}
          onDeleteFolder={onDeleteFolder}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        accept=".txt,.md,.html,.htm,.pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,text/plain,text/html,text/markdown,application/pdf"
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <input
        ref={(el) => {
          folderInputRef.current = el;
          if (el) {
            el.setAttribute("webkitdirectory", "");
            el.setAttribute("directory", "");
          }
        }}
        type="file"
        className="sr-only"
        multiple
        onChange={(e) => void onPickFiles(e.target.files)}
      />
    </section>
  );
}

function fileMeta(f: ProjectFileRecord): string {
  return `${scopeLabel(f.scope)} · ${formatFileDate(f.createdAt)}${f.chunkCount ? ` · ${f.chunkCount} 段` : ""}`;
}

function MaterialsList({
  title,
  items,
  canDelete,
  canDownload,
  projectId,
  userId,
  deletingId,
  onDelete,
  onDeleteFolder,
}: {
  title: string;
  items: ProjectFileRecord[];
  canDelete: boolean;
  canDownload: boolean;
  projectId: string;
  userId: string;
  deletingId: string | null;
  onDelete: (file: ProjectFileRecord) => void;
  onDeleteFolder: (folder: string, files: ProjectFileRecord[]) => void;
}) {
  const groups = groupProjectFilesByFolder(items);

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-2">
        {groups.map((group) => {
          if (!group.folder) {
            return (
              <ul key="__root__" className="space-y-1.5">
                {group.files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    displayName={splitStoredFilePath(file.filename).basename}
                    canDelete={canDelete}
                    canDownload={canDownload}
                    projectId={projectId}
                    userId={userId}
                    deletingId={deletingId}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            );
          }

          const folderBusy = deletingId === `folder:${group.folder}`;
          return (
            <details
              key={group.folder}
              open
              className="group/folder overflow-hidden rounded-xl border border-border/60 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open/folder:rotate-0" />
                <FolderOpen
                  className="h-4 w-4 shrink-0 text-[hsl(var(--wine-deep)/0.85)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground" title={group.folder}>
                    {group.folder}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{group.files.length} 个文件</p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    disabled={Boolean(deletingId)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void onDeleteFolder(group.folder, group.files);
                    }}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600",
                      folderBusy && "pointer-events-none opacity-50",
                    )}
                    aria-label={`删除文件夹 ${group.folder}`}
                    title="删除整个文件夹"
                  >
                    {folderBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                ) : null}
              </summary>
              <ul className="space-y-1 border-t border-border/50 bg-[hsl(var(--linen)/0.35)] px-2 py-2">
                {group.files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    displayName={splitStoredFilePath(file.filename).basename}
                    nested
                    canDelete={canDelete}
                    canDownload={canDownload}
                    projectId={projectId}
                    userId={userId}
                    deletingId={deletingId}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function FileRow({
  file,
  displayName,
  nested = false,
  canDelete,
  canDownload,
  projectId,
  userId,
  deletingId,
  onDelete,
}: {
  file: ProjectFileRecord;
  displayName: string;
  nested?: boolean;
  canDelete: boolean;
  canDownload: boolean;
  projectId: string;
  userId: string;
  deletingId: string | null;
  onDelete: (file: ProjectFileRecord) => void;
}) {
  const isDeleting = deletingId === file.id;
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5",
        nested
          ? "rounded-lg border border-border/40 bg-white"
          : "rounded-xl border border-border/60 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]",
      )}
    >
      <FileText
        className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--wine-deep)/0.75)]"
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={file.filename}>
          {displayName}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{fileMeta(file)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {canDownload ? (
          <a
            href={projectFileDownloadUrl(projectId, file.id, userId)}
            download={splitStoredFilePath(file.filename).basename}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-[hsl(var(--wine-deep)/0.25)] hover:bg-[hsl(var(--wine-deep)/0.06)] hover:text-[hsl(var(--wine-deep))]"
            aria-label={`下载 ${displayName}`}
            title="下载原文件"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </a>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={Boolean(deletingId)}
            onClick={() => void onDelete(file)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600",
              isDeleting && "pointer-events-none opacity-50",
            )}
            aria-label={`删除 ${displayName}`}
            title="从资料包删除"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : !canDownload ? (
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
        ) : null}
      </div>
    </li>
  );
}
