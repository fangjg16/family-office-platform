import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  fetchProjectFiles,
  uploadProjectPackageFile,
  type ProjectFileRecord,
} from "@/lib/project-api";
import { getDemoProjectFileNames } from "@/workspace/project-materials";

type ProjectMaterialsSectionProps = {
  projectId: string;
  /** 有对话权限时允许上传项目级资料包 */
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
  canManage = true,
}: ProjectMaterialsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [liveFiles, setLiveFiles] = useState<ProjectFileRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoNames = getDemoProjectFileNames(projectId);
  const useLive = ENABLE_LIVE_CHAT && Boolean(AI_CHAT_ENDPOINT);

  const reload = useCallback(async () => {
    if (!useLive) {
      setLiveFiles(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const files = await fetchProjectFiles(projectId);
      setLiveFiles(files);
    } catch (e) {
      setLiveFiles([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, useLive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length || !useLive || !canManage) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        await uploadProjectPackageFile(projectId, file);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const packageLive = (liveFiles ?? []).filter((f) => f.scope === "package");
  const sessionLive = (liveFiles ?? []).filter((f) => f.scope === "session");
  const showDemoOnly = !useLive || (liveFiles !== null && liveFiles.length === 0 && demoNames.length > 0);
  const hasAny =
    packageLive.length > 0 ||
    sessionLive.length > 0 ||
    (showDemoOnly && demoNames.length > 0);

  return (
    <section className="mt-6 border-t border-border/60 pt-6" aria-labelledby="project-materials-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            id="project-materials-heading"
            className="text-xs font-bold uppercase tracking-wide text-foreground"
          >
            项目资料与附件
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            项目级资料包供 AI 检索引用；对话内上传为单次会话临时文件。
          </p>
        </div>
        {useLive && canManage ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10",
              uploading && "pointer-events-none opacity-60",
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
            ? "暂无已入库资料。可在此上传 .txt / .md，或在对话中附加文件后由 AI 引用。"
            : "暂无资料列表。开启 Live 对话并上传后，或进入对话页附加演示附件。"}
        </p>
      ) : null}

      {packageLive.length > 0 ? (
        <MaterialsList title="项目资料包" items={packageLive.map(liveToRow)} />
      ) : null}

      {showDemoOnly && demoNames.length > 0 ? (
        <MaterialsList
          title={useLive ? "演示参考附件（未入库）" : "演示参考附件"}
          items={demoNames.map((name) => ({ name, meta: "演示剧本" }))}
        />
      ) : null}

      {sessionLive.length > 0 ? (
        <MaterialsList title="对话中已上传（临时）" items={sessionLive.map(liveToRow)} />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        accept=".txt,.md,text/plain,text/markdown,application/pdf"
        onChange={(e) => void onPickFiles(e.target.files)}
      />
    </section>
  );
}

type MaterialRow = { name: string; meta?: string };

function liveToRow(f: ProjectFileRecord): MaterialRow {
  return {
    name: f.filename,
    meta: `${scopeLabel(f.scope)} · ${formatFileDate(f.createdAt)}${f.chunkCount ? ` · ${f.chunkCount} 段` : ""}`,
  };
}

function MaterialsList({ title, items }: { title: string; items: MaterialRow[] }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li
            key={`${title}-${item.name}`}
            className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" strokeWidth={2} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={item.name}>
                {item.name}
              </p>
              {item.meta ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.meta}</p>
              ) : null}
            </div>
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
