import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENABLE_LIVE_CHAT,
  AI_CHAT_ENDPOINT,
  fetchProjectKnowledgeNetwork,
  type ProjectKnowledgeNetworkResponse,
} from "@/lib/project-api";
import { KnowledgeNetworkPreview } from "@/components/workspace/KnowledgeNetworkPreview";

type ProjectKnowledgeNetworkSectionProps = {
  projectId: string;
  userId: string;
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

export function ProjectKnowledgeNetworkSection({
  projectId,
  userId,
}: ProjectKnowledgeNetworkSectionProps) {
  const [data, setData] = useState<ProjectKnowledgeNetworkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useLive = ENABLE_LIVE_CHAT && Boolean(AI_CHAT_ENDPOINT);

  const reload = useCallback(async () => {
    if (!useLive || !userId) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProjectKnowledgeNetwork(projectId, userId);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "知识网络加载失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, useLive]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
            全员可见（同项目权限）；在对话中生成或更新后自动同步到此。
          </p>
        </div>
        <Link
          to={`/app/chat/${projectId}`}
          className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
        >
          在对话中更新 →
        </Link>
      </div>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-600">{error}</p>
      ) : data?.hasKnowledgeNetwork && data.html ? (
        <>
          {data.meta ? (
            <dl className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-semibold text-foreground/80">版本 </span>
                v{data.meta.version}
              </div>
              <div>
                <span className="font-semibold text-foreground/80">更新 </span>
                {formatKnDate(data.meta.updatedAt)}
              </div>
              {data.meta.changelog ? (
                <div className="sm:col-span-2">
                  <span className="font-semibold text-foreground/80">摘要 </span>
                  {data.meta.changelog}
                </div>
              ) : null}
            </dl>
          ) : null}
          <KnowledgeNetworkPreview
            html={data.html}
            filename={`[AI]_${projectId}_知识网络.html`}
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
            "尚未生成项目知识网络。进入对话后发送「生成/更新知识网络」即可创建。"}
        </p>
      )}
    </section>
  );
}
