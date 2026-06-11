import type { HermesBridgeEnv } from "./hermes-bridge";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { validateKnowledgeNetworkHtml } from "./knowledge-network-html-validation";
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

function parseKnPutMode(url: URL): KnowledgeNetworkUpdateMode | undefined {
  const raw = (url.searchParams.get("mode") ?? "").trim().toLowerCase();
  if (
    raw === "initial" ||
    raw === "incremental" ||
    raw === "full" ||
    raw === "reorder"
  ) {
    return raw;
  }
  return undefined;
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

/** PUT /api/hermes/projects/:projectId/knowledge-network/current?userId=&jobId=&changelog=&mode= */
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
  const putMode = parseKnPutMode(url);

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

  const previousHtml = await readProjectKnowledgeNetworkHtml(env, projectId);

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
    const validation = validateKnowledgeNetworkHtml(html, {
      mode: putMode,
      previousHtml,
    });
    if (!validation.ok) {
      return json({ error: validation.error ?? "HTML 校验失败" }, 400);
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
      warning: validation.warning ?? null,
    });
  }

  html = (await request.text()).trim();
  if (!html) return json({ error: "请求体为空" }, 400);
  const validation = validateKnowledgeNetworkHtml(html, {
    mode: putMode,
    previousHtml,
  });
  if (!validation.ok) {
    return json({ error: validation.error ?? "HTML 校验失败" }, 400);
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
    warning: validation.warning ?? null,
  });
}

/** Worker 注入：KB 任务前必须 read_file 的 Hermes 容器内路径（Railway ~/.hermes 布局） */
export function buildHermesKnowledgeNetworkRequiredReads(): string {
  const base = "~/.hermes/skills/knowledge-base-generation";
  return `

【知识网络 · 执行前必读（read_file，未完成 1–5 不得写 HTML）】
1. ${base}/references/README-hermes.md
2. ${base}/references/STYLE_GUIDE.md
3. ${base}/SKILL.md
4. ${base}/kb-template.html
5. ${base}/assets/components.html

规则摘要：
- 11 个 canonical slot 的 key 与锚点 ID 固定；展示顺序由 <!-- KB-CONFIG --> 的 display-order 驱动。
- 输出 HTML 的 <body> 开头必须含完整 KB-CONFIG（project-type、rendering-mode、multi-asset、display-order、config-version、display-order-history）。
- Factor A 分母始终 11；跨节引用只用锚点，禁止浮动章节编号。
- 重排：仅改 KB-CONFIG + nav + <h2> 编号，不触碰内容面板。

生成时以 kb-template.html 为壳；禁止自创 class、禁止修改 template 内 JS/CSS。`;
}

function knModeWorkflowLines(mode: KnowledgeNetworkUpdateMode): {
  modeLine: string;
  materialsLine: string;
  getStep: string;
  editStep: string;
} {
  switch (mode) {
    case "full":
      return {
        modeLine:
          "全量重做：可跳过 GET 旧版（或备份后重写）；按 kb-template 从零写入，并写入完整 KB-CONFIG。",
        materialsLine:
          "资料：manifest 后读取主要项目资料与本对话 session 附件（按需可覆盖完整资料包）。",
        getStep: "全量可跳过；若需参考旧版：curl GET … || echo NO_CURRENT_KB",
        editStep: "全量重写各 slot 内容面板；保留 kb-shell 与 KB-CONFIG 结构。",
      };
    case "reorder":
      return {
        modeLine:
          "展示顺序重排（轻量）：必须先 GET 当前版；只更新 KB-CONFIG、nav、各 section <h2> 编号。",
        materialsLine: "资料：只读当前 KB，禁止拉取项目资料包/session 正文。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "仅改 <!-- KB-CONFIG -->（display-order、config-version、display-order-history）、nav 顺序、<h2> 编号；禁止改任何内容面板文字。",
      };
    case "incremental":
      return {
        modeLine:
          "增量更新：必须先 GET 当前版；读取 KB-CONFIG 后只改用户点名的 slot，未改部分保持字节级不变。",
        materialsLine:
          "资料：当前 KB + 用户点名 section 相关资料片段 + 本对话新附件（session 优先）。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep: "局部编辑点名 slot；#timeline 时间轴；投资论点在 #decision-framework。",
      };
    case "initial":
    default:
      return {
        modeLine:
          "首次生成：无已发布版；manifest 后读取主要资料，写入完整 KB-CONFIG 后渲染。",
        materialsLine:
          "资料：读取主要项目资料与本对话 session 附件；project-intake 确定 project-type 与 display-order。",
        getStep: "无旧版可跳过 GET；或 curl GET … || echo NO_CURRENT_KB",
        editStep: "从 kb-template 填充；<body> 开头写入 <!-- KB-CONFIG -->。",
      };
  }
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
  const qBase = `userId=${encodeURIComponent(userId)}&jobId=${encodeURIComponent(jobId)}&mode=${encodeURIComponent(mode)}`;
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;
  const { modeLine, materialsLine, getStep, editStep } = knModeWorkflowLines(mode);

  return `

【知识网络 · 一次回复双交付（硬性）】
${modeLine}
${materialsLine}

**对用户可见回复（最高优先级，不得省略）**
1. 先写 3–8 行简体中文摘要（改了哪些 slot、Populated/Stub；重排则说明新 display-order）。
2. **同一条回复末尾**必须附完整整页 HTML：\\\`\\\`\\\`html … \\\`\\\`\\\`（含 <!DOCTYPE html> 与 <!-- KB-CONFIG -->）。
3. **禁止**只写「已保存到 ${workFile}」而不附代码块。
4. **不要**要求用户「再发一条」补 HTML。

**容器内工作流（有 bash 时并行执行）**
工作文件：\`${workFile}\`（\`mkdir -p ./kb/${projectId}\`）

**A. 拉取当前版** — ${getStep}
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`

**B. 编辑** — ${editStep}

**C. curl PUT（尽量成功；带 mode=${mode} 便于入库校验）**
\`\`\`bash
curl -sS -X PUT -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  -H "Content-Type: text/html; charset=utf-8" \\
  "${url}?${qBase}&changelog=hermes-file-put" \\
  --data-binary @"${workFile}"
\`\`\`
PUT 失败时仍须完成步骤 2 的 \\\`\\\`\\\`html 代码块；平台从回复提取并入库。`;
}
