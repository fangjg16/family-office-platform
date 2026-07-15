import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  ChevronDown,
  Download,
  FileText,
  FolderInput,
  FolderOpen,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  deleteProjectFile,
  fetchProjectFiles,
  fileDisplayName,
  groupProjectFilesByFolder,
  moveProjectPackageFile,
  projectFileDownloadUrl,
  splitStoredFilePath,
  uploadProjectPackageFile,
  type ProjectFileRecord,
} from "@/lib/project-api";

type ProjectMaterialsSectionProps = {
  projectId: string;
  userId: string;
  canManage?: boolean;
  canDownload?: boolean;
};

const DND_DOC_MIME = "application/x-jfo-package-doc";

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

function fileMeta(f: ProjectFileRecord): string {
  return `${scopeLabel(f.scope)} · ${formatFileDate(f.createdAt)}${f.chunkCount ? ` · ${f.chunkCount} 段` : ""}`;
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
  const [moveFile, setMoveFile] = useState<ProjectFileRecord | null>(null);

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

  const onMoveFile = async (file: ProjectFileRecord, folder: string) => {
    if (!useLive || !canManage || file.scope !== "package") return;
    const { folder: currentFolder, basename } = splitStoredFilePath(file.filename);
    if ((currentFolder || "") === (folder || "")) return;
    setDeletingId(`move:${file.id}`);
    setError(null);
    try {
      await moveProjectPackageFile(projectId, file.id, userId, folder);
      setMoveFile(null);
      await reload();
    } catch (e) {
      setError(
        `移动「${basename}」失败：${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDeletingId(null);
    }
  };

  const packageLive = (liveFiles ?? []).filter((f) => f.scope === "package");
  const folderOptions = groupProjectFilesByFolder(packageLive)
    .map((g) => g.folder)
    .filter(Boolean);
  const hasAny = packageLive.length > 0;
  const busy = uploading || Boolean(deletingId);
  const filesById = new Map(packageLive.map((f) => [f.id, f]));

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
            。可将文件<strong className="font-semibold text-foreground">拖到文件夹</strong>
            上，或点移动按钮选目标（会改逻辑路径）。
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
            ? "暂无项目资料包。可上传文件或整个文件夹；单次对话附件请在对话里上传。"
            : "暂无资料列表。开启 Live 对话并上传后可见。"}
        </p>
      ) : null}

      {packageLive.length > 0 ? (
        <MaterialsList
          title="项目资料包"
          items={packageLive}
          filesById={filesById}
          folderOptions={folderOptions}
          canDelete={useLive && canManage}
          canDownload={useLive && canDownload}
          projectId={projectId}
          userId={userId}
          deletingId={deletingId}
          onDelete={onDeleteFile}
          onDeleteFolder={onDeleteFolder}
          onMove={onMoveFile}
          onOpenMove={setMoveFile}
        />
      ) : null}

      {moveFile ? (
        <MoveFileModal
          file={moveFile}
          folderOptions={folderOptions}
          busy={Boolean(deletingId)}
          onClose={() => setMoveFile(null)}
          onConfirm={(folder) => void onMoveFile(moveFile, folder)}
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

function MaterialsList({
  title,
  items,
  filesById,
  folderOptions,
  canDelete,
  canDownload,
  projectId,
  userId,
  deletingId,
  onDelete,
  onDeleteFolder,
  onMove,
  onOpenMove,
}: {
  title: string;
  items: ProjectFileRecord[];
  filesById: Map<string, ProjectFileRecord>;
  folderOptions: string[];
  canDelete: boolean;
  canDownload: boolean;
  projectId: string;
  userId: string;
  deletingId: string | null;
  onDelete: (file: ProjectFileRecord) => void;
  onDeleteFolder: (folder: string, files: ProjectFileRecord[]) => void;
  onMove: (file: ProjectFileRecord, folder: string) => void;
  onOpenMove: (file: ProjectFileRecord) => void;
}) {
  const groups = groupProjectFilesByFolder(items);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const canDrop = canDelete && !deletingId;

  const handleDropOnFolder = (folder: string, e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    if (!canDrop) return;
    const id =
      e.dataTransfer.getData(DND_DOC_MIME) || e.dataTransfer.getData("text/plain");
    const file = filesById.get(id.trim());
    if (!file) return;
    void onMove(file, folder);
  };

  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {canDelete ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          拖拽文件到文件夹标题上即可归入该夹；也可点移动图标选择。
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        {groups.map((group) => {
          if (!group.folder) {
            return (
              <div key="__root__" className="space-y-1.5">
                {canDelete && folderOptions.length > 0 ? (
                  <FolderDropZone
                    label="根目录（移出文件夹）"
                    active={dragOverFolder === ""}
                    disabled={!canDrop}
                    onDragEnter={() => setDragOverFolder("")}
                    onDragLeave={() =>
                      setDragOverFolder((cur) => (cur === "" ? null : cur))
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => handleDropOnFolder("", e)}
                  />
                ) : null}
                <ul className="space-y-1.5">
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
                      onOpenMove={onOpenMove}
                    />
                  ))}
                </ul>
              </div>
            );
          }

          const folderBusy = deletingId === `folder:${group.folder}`;
          const isOver = dragOverFolder === group.folder;
          return (
            <details
              key={group.folder}
              open
              className={cn(
                "group/folder overflow-hidden rounded-xl border bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors",
                isOver
                  ? "border-[hsl(var(--wine-deep)/0.55)] bg-[hsl(var(--wine-muted)/0.45)] ring-2 ring-[hsl(var(--wine-deep)/0.2)]"
                  : "border-border/60",
              )}
              onDragEnter={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                setDragOverFolder(group.folder);
              }}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                  setDragOverFolder((cur) => (cur === group.folder ? null : cur));
                }
              }}
              onDrop={(e) => handleDropOnFolder(group.folder, e)}
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
                  <p className="text-[10px] text-muted-foreground">
                    {isOver ? "松开以移入此文件夹" : `${group.files.length} 个文件`}
                  </p>
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
                    onOpenMove={onOpenMove}
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

function FolderDropZone({
  label,
  active,
  disabled,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      onDragEnter={(e) => {
        if (disabled) return;
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "rounded-lg border border-dashed px-3 py-2 text-[11px] transition-colors",
        active
          ? "border-[hsl(var(--wine-deep)/0.55)] bg-[hsl(var(--wine-muted)/0.4)] text-[hsl(var(--wine-deep))]"
          : "border-border/70 bg-muted/15 text-muted-foreground",
        disabled && "opacity-50",
      )}
    >
      {active ? "松开以移到根目录" : label}
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
  onOpenMove,
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
  onOpenMove: (file: ProjectFileRecord) => void;
}) {
  const isBusy = deletingId === file.id || deletingId === `move:${file.id}`;
  const draggable = canDelete && !deletingId;

  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(DND_DOC_MIME, file.id);
        e.dataTransfer.setData("text/plain", file.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5",
        nested
          ? "rounded-lg border border-border/40 bg-white"
          : "rounded-xl border border-border/60 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        draggable && "cursor-grab active:cursor-grabbing",
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
        {canDelete ? (
          <button
            type="button"
            disabled={Boolean(deletingId)}
            onClick={() => onOpenMove(file)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-[hsl(var(--wine-deep)/0.25)] hover:bg-[hsl(var(--wine-deep)/0.06)] hover:text-[hsl(var(--wine-deep))]",
              isBusy && "pointer-events-none opacity-50",
            )}
            aria-label={`移动 ${displayName}`}
            title="移动到文件夹"
          >
            {deletingId === `move:${file.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <FolderInput className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
          </button>
        ) : null}
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
              isBusy && "pointer-events-none opacity-50",
            )}
            aria-label={`删除 ${displayName}`}
            title="从资料包删除"
          >
            {deletingId === file.id ? (
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

function MoveFileModal({
  file,
  folderOptions,
  busy,
  onClose,
  onConfirm,
}: {
  file: ProjectFileRecord;
  folderOptions: string[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (folder: string) => void;
}) {
  useBodyScrollLock(true);
  const { folder: currentFolder, basename } = splitStoredFilePath(file.filename);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [selected, setSelected] = useState<string>(currentFolder || "");
  const [newName, setNewName] = useState("");

  const destinations = [
    { value: "", label: "根目录" },
    ...folderOptions.map((f) => ({ value: f, label: f })),
  ];

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-file-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[hsl(var(--sand)/0.9)] bg-[hsl(var(--linen))] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="move-file-title"
              className="font-display text-base font-semibold text-[hsl(var(--wine-deep))]"
            >
              移动到文件夹
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground" title={file.filename}>
              {basename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white/80 hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              mode === "pick"
                ? "bg-[hsl(var(--wine-deep))] text-[hsl(var(--wine-deep-foreground))]"
                : "border border-[hsl(var(--sand))] bg-white text-[hsl(var(--warm-charcoal))]",
            )}
          >
            已有文件夹
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              mode === "create"
                ? "bg-[hsl(var(--wine-deep))] text-[hsl(var(--wine-deep-foreground))]"
                : "border border-[hsl(var(--sand))] bg-white text-[hsl(var(--warm-charcoal))]",
            )}
          >
            新建文件夹
          </button>
        </div>

        {mode === "pick" ? (
          <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
            {destinations.map((d) => {
              const active = selected === d.value;
              const isCurrent = (currentFolder || "") === d.value;
              return (
                <li key={d.value || "__root__"}>
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelected(d.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                      active
                        ? "border-[hsl(var(--wine-deep)/0.45)] bg-white text-[hsl(var(--wine-deep))]"
                        : "border-border/60 bg-white/70 text-foreground hover:border-[hsl(var(--wine-deep)/0.25)]",
                      isCurrent && "cursor-default opacity-50",
                    )}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    {isCurrent ? (
                      <span className="text-[10px] text-muted-foreground">当前</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3">
            <label className="text-[11px] font-medium text-[hsl(var(--warm-charcoal))]">
              新文件夹名称
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如 01_资产权属与地图"
                className="mt-1.5 w-full rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[hsl(var(--wine-deep)/0.45)] focus:ring-1 focus:ring-[hsl(var(--wine-deep)/0.12)]"
                autoFocus
              />
            </label>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[hsl(var(--sand)/0.9)] bg-white px-3.5 py-2 text-xs font-medium text-[hsl(var(--warm-charcoal))]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || (mode === "create" && !newName.trim())}
            onClick={() => {
              if (mode === "create") {
                const name = newName.trim();
                if (!name) return;
                onConfirm(name);
              } else {
                onConfirm(selected);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--wine-deep))] bg-[hsl(var(--wine-deep))] px-3.5 py-2 text-xs font-semibold text-[hsl(var(--wine-deep-foreground))] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            确认移动
          </button>
        </div>
      </div>
    </div>
  );
}
