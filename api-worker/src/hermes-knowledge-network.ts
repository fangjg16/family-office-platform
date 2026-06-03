import type { HermesBridgeEnv } from "./hermes-bridge";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { resolveKnowledgeNetworkPutJobId } from "./knowledge-network-guards";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function knCurrentPath(projectId: string): string {
  return `/api/hermes/projects/${encodeURIComponent(projectId)}/knowledge-network/current`;
}

export function hermesKnowledgeNetworkCurrentUrl(
  jfoBase: string,
  projectId: string,
): string {
  const base = jfoBase.replace(/\/+$/u, "");
  return `${base}${knCurrentPath(projectId)}`;
}

function isPlausibleKnHtml(html: string): boolean {
  const t = html.trim();
  if (t.length < 200) return false;
  return /<html[\s>]/i.test(t) || /kb-shell|项目知识网络|<!DOCTYPE/i.test(t);
}

/** GET /api/hermes/projects/:projectId/knowledge-network/current?format=raw */
export async function handleHermesGetKnowledgeNetworkCurrent(
  request: Request,
  env: HermesBridgeEnv & { DB: D1Database; FILES: R2Bucket },
  projectId: string,
): Promise<Response> {
  const formatRaw =
    new URL(request.url).searchParams.get("format") === "raw" ||
    (request.headers.get("Accept") ?? "").includes("text/html");

  const meta = await getProjectKnowledgeNetworkMeta(env, projectId);
  if (!meta) {
    if (formatRaw) {
      return new Response("知识网络尚未创建", { status: 404 });
    }
    return json({ ok: true, projectId, exists: false, html: null, meta: null });
  }
  const html = await readProjectKnowledgeNetworkHtml(env, projectId);
  if (!html) {
    if (formatRaw) {
      return new Response("知识网络文件不存在", { status: 404 });
    }
    return json({
      ok: true,
      projectId,
      exists: false,
      html: null,
      meta: null,
      warning: "元数据存在但 R2 文件缺失",
    });
  }
  if (formatRaw) {
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return json({
    ok: true,
    projectId,
    exists: true,
    html,
    meta: {
      version: meta.version,
      updatedAt: meta.updatedAt,
      updatedBy: meta.updatedBy,
      lastJobId: meta.lastJobId,
      changelog: meta.changelog,
    },
  });
}

/** PUT /api/hermes/projects/:projectId/knowledge-network/current?userId=&jobId=&changelog= */
export async function handleHermesPutKnowledgeNetworkCurrent(
  request: Request,
  env: HermesBridgeEnv & { DB: D1Database; FILES: R2Bucket },
  projectId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const userId = (url.searchParams.get("userId") ?? "").trim();
  if (!userId) {
    return json({ error: "缺少 userId 查询参数" }, 400);
  }
  const requestedJobId = (url.searchParams.get("jobId") ?? "").trim() || null;
  const changelogParam = (url.searchParams.get("changelog") ?? "").trim() || null;

  const resolved = await resolveKnowledgeNetworkPutJobId(
    env,
    projectId,
    userId,
    requestedJobId,
  );
  if (!resolved.jobId) {
    return json(
      {
        error:
          "无法绑定 agent job：请带 jobId，或确保该项目下有进行中的知识网络任务（pending/running）",
        code: "KN_JOB_NOT_FOUND",
      },
      400,
    );
  }

  let html = "";
  const ctype = (request.headers.get("Content-Type") ?? "").toLowerCase();
  if (ctype.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      html?: string;
      changelog?: string;
    };
    html = String(body.html ?? "").trim();
    const changelog = String(body.changelog ?? changelogParam ?? "").trim();
    if (!html) return json({ error: "JSON 体缺少 html 字段" }, 400);
    if (!isPlausibleKnHtml(html)) {
      return json({ error: "html 过短或不像知识网络单页（需 <!DOCTYPE 或 <html 或 kb-shell）" }, 400);
    }
    const meta = await upsertProjectKnowledgeNetwork(env, {
      projectId,
      userId,
      html,
      lastJobId: resolved.jobId,
      answerSummary: changelog || "Hermes 文件回传",
    });
    return json({
      ok: true,
      projectId,
      version: meta.version,
      updatedAt: meta.updatedAt,
      r2Key: meta.r2Key,
      jobId: resolved.jobId,
      jobIdAutoBound: resolved.autoBound,
    });
  }

  html = (await request.text()).trim();
  if (!html) return json({ error: "请求体为空" }, 400);
  if (!isPlausibleKnHtml(html)) {
    return json({ error: "正文过短或不像知识网络单页 HTML" }, 400);
  }
  if (html.length > 2_500_000) {
    return json({ error: "HTML 超过 2.5MB 上限" }, 413);
  }

  const meta = await upsertProjectKnowledgeNetwork(env, {
    projectId,
    userId,
    html,
    lastJobId: resolved.jobId,
    answerSummary: changelogParam || "Hermes 文件回传",
  });
  return json({
    ok: true,
    projectId,
    version: meta.version,
    updatedAt: meta.updatedAt,
    r2Key: meta.r2Key,
    jobId: resolved.jobId,
    jobIdAutoBound: resolved.autoBound,
  });
}

/** Hermes Agent 指令：文件回路（禁止用 ```html 代码块交付） */
export function buildHermesKnowledgeNetworkFileProtocol(
  jfoBase: string,
  projectId: string,
  userId: string,
  jobId: string,
  projectTitleHint: string,
  mode: KnowledgeNetworkUpdateMode,
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const qBase = `userId=${encodeURIComponent(userId)}&jobId=${encodeURIComponent(jobId)}`;
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;

  const modeLine =
    mode === "full"
      ? "全量重做：勿 GET 旧版（或 GET 后另存备份再重写）；按 kb-template 从零写入工作文件。"
      : "增量更新：必须先 GET 当前版到工作文件，只改用户点名的 section，未改部分保持字节级不变。";

  return `

【知识网络 · 文件回路（硬性，取代聊天里的整页 HTML）】
${modeLine}
家办平台**只认** Worker API 回传的 HTML 文件，**禁止**在回复里放 \\\`\\\`\\\`html 整页代码块（网站不会解析）。

工作文件路径（容器内）：\`${workFile}\`
执行前：\`mkdir -p ./kb/${projectId}\`

**A. 拉取当前已发布版（增量时必做，全量重做可跳过）**
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`
若 curl 失败（404 / NO_CURRENT_KB），表示首次生成，直接按 knowledge-base-generation + kb-template 新建 \`${workFile}\`。

**B. 编辑工作文件**
- 执行 knowledge-base-generation；先读 skill 目录 kb-template.html，壳与脚本原样保留。
- 用 bash / 编辑器 / patch **只改** \`${workFile}\`，勿在对话里重写整页 HTML。
- 时间轴 #timeline 须含 8.1 / 8.2 / 8.3；投资论点在 #decision-framework 内。

**C. 回传（任务结束前必须成功，否则项目详情不更新）**
\`\`\`bash
curl -sS -X PUT -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  -H "Content-Type: text/html; charset=utf-8" \\
  "${url}?${qBase}&changelog=hermes-file-put" \\
  --data-binary @"${workFile}"
\`\`\`
确认响应 JSON 含 ok:true、version、jobId（jobId 查询参数建议带上；若省略，服务端会绑到进行中的知识网络任务）。

**D. 对用户回复**
- 仅 3–8 行简体中文摘要：改了哪些 section、Populated/Stub 一句、回传后的 version 号。
- **不要**附 \\\`\\\`\\\`html 代码块或磁盘路径。`;
}
