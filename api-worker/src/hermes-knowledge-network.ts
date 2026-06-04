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

/** Worker 注入：KB 任务前必须 read_file 的 Hermes 容器内路径（v2.5 布局） */
export function buildHermesKnowledgeNetworkRequiredReads(): string {
  const base = "~/.hermes/skills/knowledge-base-generation";
  return `

【知识网络 · 执行前必读（read_file，未完成 1–5 不得写 HTML）】
1. ${base}/references/README-hermes.md
2. ${base}/references/STYLE_GUIDE.md
3. ${base}/SKILL.md
4. ${base}/kb-template.html
5. ${base}/assets/components.html

生成时以 kb-template.html 为壳填数据；组件/HTML 语法遵守 STYLE_GUIDE 与 components.html；禁止自创 class、禁止修改 template 内 JS/CSS。`;
}

/** Hermes Agent 指令：文件回路 + 回复末尾 \`\`\`html 双交付 */
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

【知识网络 · 一次回复双交付（硬性）】
${modeLine}

**对用户可见回复（最高优先级，不得省略）**
1. 先写 3–8 行简体中文摘要（改了哪些 section、Populated/Stub）。
2. **同一条回复末尾**必须附完整整页 HTML：\\\`\\\`\\\`html … \\\`\\\`\\\`（含 <!DOCTYPE html>，按 knowledge-base-generation + kb-template）。
3. **禁止**只写「已保存到 ${workFile}」「见磁盘路径」而不附代码块——用户只有一条消息，看不到容器内文件。
4. **不要**要求用户「再发一句」或「把 HTML 放在下一条消息」。

**容器内工作流（有 bash 时额外执行，与代码块并行）**
工作文件：\`${workFile}\`（\`mkdir -p ./kb/${projectId}\`）

**A. 拉取当前版（增量必做，全量可跳过）**
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`

**B. 编辑** \`${workFile}\`（局部或全量）；#timeline 含 8.1/8.2/8.3；投资论点在 #decision-framework。

**C. curl PUT（尽量成功，便于项目详情版本号）**
\`\`\`bash
curl -sS -X PUT -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  -H "Content-Type: text/html; charset=utf-8" \\
  "${url}?${qBase}&changelog=hermes-file-put" \\
  --data-binary @"${workFile}"
\`\`\`
PUT 失败时仍须完成步骤 2 的 \\\`\\\`\\\`html 代码块；平台从回复提取并入库。`;
}
