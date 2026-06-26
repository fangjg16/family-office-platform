import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Loader2, Network, RotateCcw, Sparkles, Upload, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  fetchProjectKnowledgeNetwork,
  fetchProjectKnowledgeNetworkVersionHtml,
  knVersionDisplay,
  uploadProjectKnowledgeNetwork,
  type ProjectKnowledgeNetworkResponse,
} from "@/lib/project-api";
import { canPublishProjectKnowledgeNetwork } from "@/workspace/project-manage";
import type { WorkspaceProject } from "@/workspace/projects";
import {
  KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT,
  KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT,
  KNOWLEDGE_NETWORK_INITIAL_PROMPT,
  type KnowledgeNetworkChatEntryState,
} from "@/lib/knowledge-network-prompts";
import { KnowledgeNetworkPreview } from "@/components/workspace/KnowledgeNetworkPreview";
import { getUserById } from "@/workspace/workspace-users";
import {
  canGuestPreviewKnowledgeNetwork,
  getGuestKnApplyState,
  shouldShowGuestKnApply,
  submitGuestKnApply,
  type GuestKnApplyState,
} from "@/workspace/guest-access";
import { Button } from "@/components/ui/button";

type ProjectKnowledgeNetworkSectionProps = {
  projectId: string;
  userId: string;
  /** 用于创建人上传权限（云端 proj-* 须传 createdBy） */
  project?: Pick<WorkspaceProject, "id" | "createdBy">;
  /** Guest：仅展示板块与申请入口，获批后可预览 */
  isGuest?: boolean;
};

function formatKnDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function updaterLabel(meta: { updatedBy: string; updatedByDisplayName?: string }): string {
  return (
    meta.updatedByDisplayName?.trim() ||
    getUserById(meta.updatedBy)?.displayName ||
    meta.updatedBy
  );
}

export function ProjectKnowledgeNetworkSection({
  projectId,
  userId,
  project,
  isGuest = false,
}: ProjectKnowledgeNetworkSectionProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectKnowledgeNetworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewVersion, setViewVersion] = useState<number | "current">("current");
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [guestApplyState, setGuestApplyState] = useState<GuestKnApplyState>(() =>
    isGuest ? getGuestKnApplyState(userId, projectId) : "none",
  );
  const [guestApplying, setGuestApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const useLive = ENABLE_LIVE_CHAT && Boolean(AI_CHAT_ENDPOINT);
  const guestKnPreviewOk =
    !isGuest || canGuestPreviewKnowledgeNetwork(userId, projectId);
  const showGuestApply = isGuest && shouldShowGuestKnApply(userId, projectId);
  const canPublish =
    useLive &&
    canPublishProjectKnowledgeNetwork(userId, {
      id: project?.id ?? projectId,
      createdBy: project?.createdBy ?? null,
    });

  const reload = useCallback(async () => {
    if (!useLive || !userId || !guestKnPreviewOk) {
      if (!guestKnPreviewOk) {
        setData(null);
        setViewHtml(null);
        setError(null);
      } else {
        setData(null);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectKnowledgeNetwork(projectId, userId, { includeHtml: true });
      setData(res);
      setViewVersion("current");
      setViewHtml(res.html);
    } catch (e) {
      setData(null);
      setViewHtml(null);
      setError(e instanceof Error ? e.message : "知识网络加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, useLive, guestKnPreviewOk]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!isGuest) return;
    setGuestApplyState(getGuestKnApplyState(userId, projectId));
  }, [isGuest, userId, projectId]);

  const onGuestApply = () => {
    if (!showGuestApply || guestApplying) return;
    setGuestApplying(true);
    setError(null);
    submitGuestKnApply(userId, projectId);
    setGuestApplyState("pending");
    setGuestApplying(false);
  };

  const goChat = (draftMessage: string) => {
    navigate(`/app/chat/${projectId}`, {
      state: { draftMessage } satisfies KnowledgeNetworkChatEntryState,
    });
  };

  const onUploadHtmlFile = async (file: File) => {
    if (!canPublish) return;
    setUploadSuccess(null);
    setError(null);
    setUploading(true);
    try {
      const html = await file.text();
      const changelog = window.prompt(
        "可选：填写本次上传说明（将显示在版本摘要，留空则使用默认说明）",
        "本地上传 HTML 覆盖",
      );
      if (changelog === null) {
        return;
      }
      const result = await uploadProjectKnowledgeNetwork(projectId, userId, html, {
        changelog: changelog.trim() || undefined,
        uploadFileName: file.name,
      });
      const baseMsg =
        result.message ??
        `已发布为 v${result.meta ? knVersionDisplay(result.meta) : "?"}`;
      setUploadSuccess(
        result.warning?.trim()
          ? `${baseMsg}\n\n⚠️ 校验提示：${result.warning.trim()}`
          : baseMsg,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSelectVersion = async (v: string) => {
    if (v === "current") {
      setViewVersion("current");
      setViewHtml(data?.html ?? null);
      return;
    }
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    if (data?.meta?.version === num) {
      setViewVersion("current");
      setViewHtml(data.html);
      return;
    }
    setViewVersion(num);
    setLoadingVersion(true);
    setError(null);
    try {
      const html = await fetchProjectKnowledgeNetworkVersionHtml(projectId, num, userId);
      setViewHtml(html);
    } catch (e) {
      setError(e instanceof Error ? e.message : "历史版本加载失败");
      setViewVersion("current");
      setViewHtml(data?.html ?? null);
    } finally {
      setLoadingVersion(false);
    }
  };

  const versionOptions = [
    ...(data?.meta
      ? [
          {
            version: data.meta.version,
            label: `当前 v${knVersionDisplay(data.meta)}`,
          },
        ]
      : []),
    ...(data?.versions ?? [])
      .filter((v) => v.version !== data?.meta?.version)
      .map((v) => ({
        version: v.version,
        label: `归档 v${knVersionDisplay(v)} · ${formatKnDate(v.updatedAt)}`,
      })),
  ];

  const viewingArchiveLabel =
    viewVersion !== "current" && data?.meta && viewVersion !== data.meta.version
      ? (() => {
          const row = data.versions?.find((v) => v.version === viewVersion);
          return row ? knVersionDisplay(row) : String(viewVersion);
        })()
      : null;

  if (!useLive) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
          <Network className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          项目知识网络
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          联机模式未开启，无法在项目详情预览知识网络。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
            <Network className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
            项目知识网络
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {isGuest
              ? canGuestPreviewKnowledgeNetwork(userId, projectId)
                ? "项目知识网络汇总结构化研判与关键结论，您已获准预览完整内容。"
                : "项目知识网络汇总结构化研判与关键结论。完整内容需提交查看申请，审批通过后可在此预览。"
              : "全员可见。对话里可「按板块更新」或「全量重做」；也可上传本地生成的单页 HTML 覆盖当前版（旧版自动归档），后续增量更新基于新版。"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {showGuestApply ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              disabled={guestApplying}
              onClick={onGuestApply}
            >
              {guestApplying ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSearch className="mr-1 h-3.5 w-3.5" />
              )}
              申请查看知识网络
            </Button>
          ) : isGuest && guestApplyState === "pending" ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-white/80 px-3 text-xs font-medium text-muted-foreground">
              申请已提交，请等待审批
            </span>
          ) : null}
        {!isGuest && data?.hasKnowledgeNetwork ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              title="进入对话并预填模板，请写明要改或删除的 section"
              onClick={() => goChat(KNOWLEDGE_NETWORK_INCREMENTAL_PROMPT)}
            >
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              按板块更新
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => goChat(KNOWLEDGE_NETWORK_FULL_REGENERATE_PROMPT)}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              全量重做
            </Button>
          </>
        ) : null}
        {!isGuest && canPublish ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              className="sr-only"
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadHtmlFile(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={uploading}
              title="选择本地 .html；文件名含 v5 或 v5.5 将用作展示版本号，否则在当前展示版整数位 +1"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3.5 w-3.5" />
              )}
              上传 HTML 覆盖
            </Button>
          </>
        ) : null}
        {!isGuest && !data?.hasKnowledgeNetwork ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => goChat(KNOWLEDGE_NETWORK_INITIAL_PROMPT)}
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            生成知识网络
          </Button>
        ) : null}
      </div>

      {uploadSuccess ? (
        <p className="mt-2 text-xs text-emerald-700">{uploadSuccess}</p>
      ) : null}

      {loading && guestKnPreviewOk ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-600">{error}</p>
      ) : showGuestApply ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          知识网络内容受权限保护。如需预览，请点击上方「申请查看知识网络」。
        </p>
      ) : isGuest && guestApplyState === "pending" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          您的查看申请已提交，请等待管理员审批。通过后本页将开放预览。
        </p>
      ) : data?.hasKnowledgeNetwork && viewHtml ? (
        <>
          {data.meta ? (
            <dl className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-semibold text-foreground/80">版本 </span>
                v{knVersionDisplay(data.meta)}
                {viewingArchiveLabel ? (
                  <span className="text-amber-700"> · 正在查看 v{viewingArchiveLabel}</span>
                ) : null}
              </div>
              <div>
                <span className="font-semibold text-foreground/80">更新 </span>
                {formatKnDate(data.meta.updatedAt)}
              </div>
              <div>
                <span className="font-semibold text-foreground/80">更新人 </span>
                {updaterLabel(data.meta)}
              </div>
              {data.meta.changelog ? (
                <div className="sm:col-span-2">
                  <span className="font-semibold text-foreground/80">摘要 </span>
                  {data.meta.changelog}
                </div>
              ) : null}
            </dl>
          ) : null}

          {versionOptions.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="sr-only" htmlFor="kn-version-select">
                选择历史版本
              </label>
              <select
                id="kn-version-select"
                className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-medium text-foreground"
                value={viewVersion === "current" ? String(data.meta?.version ?? "") : String(viewVersion)}
                disabled={loadingVersion}
                onChange={(e) => void onSelectVersion(e.target.value)}
              >
                {versionOptions.map((o) => (
                  <option key={o.version} value={o.version}>
                    {o.label}
                  </option>
                ))}
              </select>
              {loadingVersion ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          ) : null}

          <KnowledgeNetworkPreview
            html={viewHtml}
            filename={`[AI]_${projectId}_知识网络_v${
              viewVersion === "current"
                ? knVersionDisplay(data.meta!)
                : (() => {
                    const row = data.versions?.find((v) => v.version === viewVersion);
                    return row ? knVersionDisplay(row) : String(viewVersion);
                  })()
            }.html`}
          />
        </>
      ) : (
        <p
          className={cn(
            "mt-3 text-sm leading-relaxed",
            data?.warning ? "text-amber-700" : "text-muted-foreground",
          )}
        >
          {data?.warning ??
            (isGuest
              ? "当前项目尚未发布知识网络，或内容暂不可预览。"
              : "尚未生成项目知识网络。点击上方按钮进入对话并预填提示语。")}
        </p>
      )}
    </section>
  );
}
