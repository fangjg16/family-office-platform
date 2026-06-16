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
  const putMode = parseKnPutMode(url) ?? "incremental";

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
      strict: true,
      touchesTimeline: putMode !== "reorder" && /id=["']timeline["']/i.test(html),
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
    strict: true,
    touchesTimeline: putMode !== "reorder" && /id=["']timeline["']/i.test(html),
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

const KB_SKILL_BASE = "~/.hermes/skills/knowledge-base-generation";

function readLine(n: number, relPath: string): string {
  return `${n}. ${KB_SKILL_BASE}/${relPath}`;
}

export type HermesKnRequiredReadsOptions = {
  mode: KnowledgeNetworkUpdateMode;
  touchesTimeline?: boolean;
  /** 视觉/版式调试任务才读 style-guide */
  includeStyleGuide?: boolean;
  /** 视觉/版式调试任务才读 components.html */
  includeComponents?: boolean;
};

/** 用户明确要求版式/CSS 调试时 */
export function isVisualDebugKnRequest(message: string): boolean {
  return /视觉|版式|样式|css|style[\s-]*guide|components\.html|debug|调试|渲染问题|布局/i.test(
    message,
  );
}

/** Worker 注入：按 KB 任务模式列出 Hermes read_file 清单 */
export function buildHermesKnowledgeNetworkRequiredReads(
  options: HermesKnRequiredReadsOptions,
): string {
  const { mode, touchesTimeline, includeStyleGuide, includeComponents } = options;
  const lines: string[] = ["", "【知识网络 · v2.8 必读（read_file，按模式）】"];

  if (mode === "reorder") {
    lines.push(
      readLine(1, "references/kb-config.md"),
      readLine(2, "SKILL.md"),
      "",
      "重排模式：必须先 GET 当前 KB HTML；**禁止** read_file 项目资料包/session 全文。",
      "仅更新 <!-- KB-CONFIG -->、nav 顺序、各 section <h2> 编号；禁止改内容面板。",
      "**禁止** read_file visual-style-guide.md、components.html、examples-kb-data.json。",
    );
    return lines.join("\n");
  }

  let n = 1;
  const add = (rel: string) => {
    lines.push(readLine(n++, rel));
  };

  add("SKILL.md");
  add("references/kb-schema.md");
  add("references/kb-config.md");
  add("references/content-rules.md");
  add("references/slot-specific-rules.md");
  add("references/slot-rendering-rules.md");
  const needsTimelineRules =
    mode === "initial" || mode === "full" || Boolean(touchesTimeline);
  if (needsTimelineRules) {
    add("references/timeline-rules.md");
  }
  add("assets/kb-template.html");

  if (includeComponents) {
    lines.push(readLine(n++, "assets/components.html"));
  }
  if (includeStyleGuide) {
    lines.push(readLine(n++, "references/visual-style-guide.md"));
  }

  lines.push(
    "",
    "规则摘要（v2.8）：",
    "- 11 个 canonical slot 锚点固定；展示顺序由 <!-- KB-CONFIG --> display-order 驱动。",
    "- 资料仅经 jfo-r2-materials：manifest/digest → 按需 textUrl，禁止机械全文拉取。",
    "- 正文 citation（如 #source-U-1）须对应 appendix id；保留 assets/kb-template.html 内 revealAnchor。",
    "- **timeline** 仅写项目推进节点；每条候选先过 eligibility gate（scope / timelineEligible / reason）；行业/市场/政策背景写 comps/risks/decision-framework，不得填充 timeline。",
    "- **禁止** skills_reference.md、根目录 kb-template.html、旧 STYLE_GUIDE.md。",
    "- **禁止**每次 read_file examples-kb-data.json、scripts/（仅本地开发调试）。",
    "- 非视觉调试任务：**不要** read_file visual-style-guide.md / components.html（版式以 kb-template 为准）。",
  );

  if (mode === "full" || mode === "initial") {
    lines.push("- 模式：首次/全量 — 可跳过 GET 旧版；写入完整 KB-CONFIG 后渲染各 slot。");
  } else {
    lines.push("- 模式：增量 — 必须先 GET 当前版；只改用户点名的 slot。");
  }

  return lines.join("\n");
}

export { messageTouchesTimeline } from "./knowledge-network-slot-aliases";

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
          "全量重做（v2.8）：按 kb-schema + slot-specific-rules 从零渲染；写入完整 KB-CONFIG。",
        materialsLine:
          "资料：jfo-r2-materials manifest 后读取主要项目资料与本对话 session 附件（按需）。",
        getStep: "全量可跳过 GET；或 curl GET … || echo NO_CURRENT_KB",
        editStep:
          "从 assets/kb-template.html 填充各 slot；保留 kb-shell、revealAnchor、KB-CONFIG。timeline 须经 eligibility gate；无项目级事件则三区块 stub，勿用行业新闻填充。",
      };
    case "reorder":
      return {
        modeLine:
          "展示顺序重排（v2.8）：必须先 GET 当前版；只更新 KB-CONFIG、nav、section 编号。",
        materialsLine: "资料：**禁止**拉取项目资料包；只读当前 KB + kb-config.md。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "仅改 <!-- KB-CONFIG -->、nav、<h2> 编号；禁止改内容面板。",
      };
    case "incremental":
      return {
        modeLine:
          "增量更新（v2.8）：GET 当前版；slot-specific-rules 只改用户点名 slot。",
        materialsLine:
          "资料：当前 KB + 点名 slot 相关资料片段 + session 附件（按需 textUrl）。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "局部编辑点名 slot；若含 timeline 须读 timeline-rules.md 并过 eligibility gate。",
      };
    case "initial":
    default:
      return {
        modeLine:
          "首次生成（v2.8）：无已发布版；按 kb-schema 写入 KB-CONFIG 后渲染。",
        materialsLine:
          "资料：jfo-r2-materials manifest 后按需读取主要资料 + session 附件。",
        getStep: "无旧版可跳过 GET；或 curl GET … || echo NO_CURRENT_KB",
        editStep:
          "从 assets/kb-template.html 填充；<body> 开头写入 <!-- KB-CONFIG -->。",
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

【知识网络 · 一次回复双交付（v2.8 硬性）】
${modeLine}
${materialsLine}

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（改了哪些 slot、Populated/Stub；重排则说明新 display-order）。
2. **curl PUT 成功且返回 ok**：摘要即可，**勿**在回复末尾重复附整页 \\\`\\\`\\\`html（平台已入库）。
3. **PUT 失败或未执行**：同一条回复末尾须附完整整页 \\\`\\\`\\\`html … \\\`\\\`\\\`（含 <!DOCTYPE> 与 <!-- KB-CONFIG -->）。
4. PUT 返回 400 校验失败：说明错误要点，**最多再修正并 PUT 一次**；仍失败则停止并报告，**禁止**多轮整页重写。
5. **禁止**只写「已保存到 ${workFile}」而不交付（PUT 或代码块二选一）。

**容器内工作流（有 bash 时并行执行）**
工作文件：\`${workFile}\`（\`mkdir -p ./kb/${projectId}\`）
模板：\`${KB_SKILL_BASE}/assets/kb-template.html\`（**非**根目录 kb-template.html）

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
