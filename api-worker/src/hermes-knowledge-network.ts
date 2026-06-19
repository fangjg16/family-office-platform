import type { HermesBridgeEnv } from "./hermes-bridge";
import { finalizeAgentJobAfterKnPut } from "./agent-jobs";
import {
  buildKnowledgeNetworkDeepRefResolutionLines,
  resolveKnowledgeNetworkDeepRefs,
} from "./knowledge-network-deep-refs";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
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
  const html = await readProjectKnowledgeNetworkHtml(env, projectId, {
    mergeVersionLedger: true,
  });
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
    if (resolved.rejected === "cancelled") {
      return json(
        {
          error: "关联任务已取消，拒绝写入知识网络",
          code: "KN_JOB_CANCELLED",
        },
        409,
      );
    }
    if (resolved.rejected === "terminal") {
      return json(
        {
          error: "关联任务已结束，拒绝写入知识网络",
          code: "KN_JOB_TERMINAL",
        },
        409,
      );
    }
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
      touchesTimeline:
        putMode !== "reorder" && /id=["']timeline-milestones["']/i.test(html),
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
    await finalizeAgentJobAfterKnPut(env, resolved.jobId, changelog || "Hermes 文件回传");
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
    touchesTimeline:
      putMode !== "reorder" && /id=["']timeline-milestones["']/i.test(html),
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
  await finalizeAgentJobAfterKnPut(
    env,
    resolved.jobId,
    changelogParam || "Hermes 文件回传",
  );
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

const KB_SKILL_BASE = "/opt/data/skills/opportunistic-investments-hermes";
const KB_PUT_SCRIPT = `${KB_SKILL_BASE}/scripts/jfo_kb_put.sh`;

function readLine(n: number, relPath: string): string {
  return `${n}. ${KB_SKILL_BASE}/${relPath}`;
}

export type HermesKnRequiredReadsOptions = {
  mode: KnowledgeNetworkUpdateMode;
  touchesTimeline?: boolean;
  /** 增量模式：用户点名的 canonical slots（驱动 deep refs 子集） */
  touchedSlots?: readonly CanonicalKbSlot[];
  /** incremental 且用户仅点名 1 个 slot：slot-html-patch 为正常交付路径 */
  slotPatchMode?: boolean;
  /** 增量模式：用户点名 header / 成熟度评分卡时读 maturity-scoring.md */
  touchesMaturityScorecard?: boolean;
  /** 视觉/版式调试任务才读 style-guide */
  includeStyleGuide?: boolean;
  /** 视觉/版式调试任务才读 components.html */
  includeComponents?: boolean;
};

/** 增量更新 header 成熟度三张卡时 */
export function messageTouchesMaturityScorecard(message: string): boolean {
  return /header|评分|maturity|成熟度|项目总览|scorecard|factor\s*[ab]|综合成熟|stat[\s-]*row|覆盖度|来源多样性|两因素/i.test(
    message.trim(),
  );
}

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
  const {
    mode,
    touchesTimeline,
    touchedSlots = [],
    slotPatchMode,
    touchesMaturityScorecard,
    includeStyleGuide,
    includeComponents,
  } = options;
  const lines: string[] = ["", "【知识网络 · Hermes v2.92 / v2.91 schema · 必读（read_file，按模式）】"];

  if (mode === "reorder") {
    lines.push(
      readLine(1, "references/kb-config.md"),
      readLine(2, "SKILL.md"),
      "",
      "重排模式：必须先 GET 当前 KB HTML；**禁止** read_file 项目资料包/session 全文。",
      "仅更新 <!-- KB-CONFIG -->、nav 顺序、各 section <h2> 编号；禁止改内容面板。",
      "**禁止** read_file references/deep/*.md、components.html、examples-kb-data.json、visual-style-guide.md。",
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
  const needsMaturityScoring =
    mode === "initial" || mode === "full" || Boolean(touchesMaturityScorecard);
  if (needsMaturityScoring) {
    add("references/maturity-scoring.md");
  }
  add("assets/kb-template.html");

  const deepRefs = resolveKnowledgeNetworkDeepRefs(mode, touchedSlots);
  for (const deepRef of deepRefs) {
    add(deepRef);
  }

  if (includeComponents) {
    lines.push(readLine(n++, "assets/components.html"));
  }
  if (includeStyleGuide) {
    lines.push(readLine(n++, "references/visual-style-guide.md"));
  }

  lines.push(
    "",
    "规则摘要（Hermes v2.92 · schema v2.91）：",
    "- 13 个 core canonical slot + Appendix A–D；展示顺序由 <!-- KB-CONFIG --> display-order 驱动（schema-version: 2.91）。",
    "- legacy v2.8 / 11-slot KB 须全量重建（Route A），禁止增量 patch 旧 anchor。",
    "- 资料仅经 jfo-r2-materials：manifest/digest → 按需 textUrl，禁止机械全文拉取。",
    "- 正文 citation（如 #source-U-1）须对应 Appendix A id；保留 assets/kb-template.html 内 revealAnchor。",
    "- **timeline-milestones** 仅写项目推进节点；行业/市场背景写 industry-market/comps-benchmark/risks-mitigation。",
    "- **成熟度三张卡** `.stat-value` 必须为 0–100%；slot 计数、字母等级只能写 stat-note / stage。",
    "- **禁止** legacy v2.8 anchors（assets、business-model、timeline 等）、skills_reference.md、根目录 kb-template.html。",
    "- **deep refs**：initial/full 读齐 7 个 references/deep/*.md；incremental 仅读点名 slot 映射；reorder 不读。",
    "- **禁止** read_file examples-kb-data.json、scripts/、components.html、visual-style-guide（非视觉调试）。",
    "- **附录 D version-ledger**：平台在入库时自动从 D1 版本表合并全部历史行；Hermes 只需保留该 section 结构，勿删表头，历史行可留占位。",
  );

  if (mode === "full" || mode === "initial") {
    lines.push("- 模式：首次/全量 — 可跳过 GET 旧版；写入完整 KB-CONFIG（13 core slots + 附录）后渲染。");
  } else if (mode === "incremental" && slotPatchMode) {
    lines.push(
      "- 模式：单 slot 增量 — **正常路径**为交付 `slot-html-patch` JSON，由 Worker 合并入库。",
      "- **禁止** jfo_kb_put.sh / curl PUT 整页 / 回复末尾整页 ```html（Hermes PUT 仅为旧版兼容，不是本任务路径）。",
      "- sectionHtml **仅可引用**当前 Appendix A 已有 `#source-*`；**禁止**新增 citation anchor；若需新增来源索引，请改走整页 HTML fallback。",
    );
  } else if (mode === "incremental") {
    lines.push("- 模式：增量 — 必须先 GET 当前版；只改用户点名的 slot。");
  } else {
    lines.push("- 模式：增量 — 必须先 GET 当前版；只改用户点名的 slot。");
  }

  return lines.join("\n");
}

export { messageTouchesTimeline } from "./knowledge-network-slot-aliases";
export {
  buildKnowledgeNetworkDeepRefResolutionLines,
  resolveKnowledgeNetworkDeepRefs,
} from "./knowledge-network-deep-refs";

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
          "全量重做（v2.91）：legacy v2.8 KB 须重建；按 kb-schema 13-slot 从零渲染；写入完整 KB-CONFIG。",
        materialsLine:
          "资料：jfo-r2-materials manifest 后读取主要项目资料与本对话 session 附件（按需）。**禁止** web_search / 公开检索（除非用户消息明确要求「查外部资料」）。",
        getStep: "全量可跳过 GET；或 curl GET … || echo NO_CURRENT_KB",
        editStep:
          "从 assets/kb-template.html 填充 13 core slots + Appendix A–D；**复制** kb-template 内 <!-- KB-CONFIG --> 行格式（含 `schema-version: 2.91` 独立一行）；timeline-milestones 须经 eligibility gate。",
      };
    case "reorder":
      return {
        modeLine:
          "展示顺序重排（v2.91）：必须先 GET 当前版；只更新 KB-CONFIG、nav、section 编号。",
        materialsLine: "资料：**禁止**拉取项目资料包与 deep refs；只读当前 KB + kb-config.md。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "仅改 <!-- KB-CONFIG -->、nav、<h2> 编号；禁止改内容面板。",
      };
    case "incremental":
      return {
        modeLine:
          "增量更新（v2.91）：GET 当前版；slot-specific-rules 只改用户点名 slot。",
        materialsLine:
          "资料：当前 KB + 点名 slot 相关资料片段 + session 附件（按需 textUrl）。",
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "局部编辑点名 slot；若含 timeline-milestones 须读 timeline-rules.md 并过 eligibility gate。",
      };
    case "initial":
    default:
      return {
        modeLine:
          "首次生成（v2.91）：无已发布版；按 kb-schema 13-slot 写入 KB-CONFIG 后渲染。",
        materialsLine:
          "资料：jfo-r2-materials manifest 后按需读取主要资料 + session 附件。",
        getStep: "无旧版可跳过 GET；或 curl GET … || echo NO_CURRENT_KB",
        editStep:
          "从 assets/kb-template.html 填充；<body> 开头写入 <!-- KB-CONFIG -->（**行格式**，含独立一行 `schema-version: 2.91`）。",
      };
  }
}

/** incremental 单 slot：Hermes 交付 structured-slot-patch JSON（主路径），Worker 确定性渲染 */
export function buildHermesKnowledgeNetworkStructuredPatchProtocol(
  slot: CanonicalKbSlot,
): string {
  const payloadHint = STRUCTURED_SLOT_PAYLOAD_HINTS[slot];
  return `

【知识网络 · Structured Slot Patch 增量交付（单 slot · schema v2.91 · 主路径）】
用户仅更新 **#${slot}**。本任务**必须**交付下方 structured-slot-patch JSON；**禁止** sectionHtml / HTML / class / curl PUT / 整页 \\\`\\\`\\\`html。

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（改了什么、证据/缺口变化）。
2. 附 **一个** \\\`\\\`\\\`json 代码块（type 必须为 structured-slot-patch）：
\\\`\\\`\\\`json
{
  "type": "structured-slot-patch",
  "schemaVersion": "2.91",
  "mode": "incremental",
  "slot": "${slot}",
  "operation": "replace-slot-data",
  "payload": ${payloadHint},
  "summary": "本次仅更新 ${slot}。"
}
\\\`\\\`\\\`
3. payload 为**纯文本结构化数据**；**禁止** HTML 标签、script、inline style、sectionHtml。
4. evidenceSourceIds **仅可引用**当前 KB Appendix A 已存在的 source id（如 A-1、source-A-1）；**禁止**编造新来源。若需新增 Appendix A 条目，返回 \`"status": "requires_full_update"\` 并说明原因，**不要**硬填 source id。
5. 资料不足时用 payload.gaps / gapCallouts 表达缺口或低置信度，勿编造事实。
6. operation：\`replace-slot-data\`（默认）| \`append-items\` | \`update-fields\`；Worker 按 slot schema 渲染 v2.91 HTML 并仅替换目标 section。
7. 附录 D 由平台自动写入；勿输出 version-ledger HTML。
8. 旧 slot-html-patch 仅为平台兼容 fallback，**不是**本任务交付格式。`;

}

const STRUCTURED_SLOT_PAYLOAD_HINTS: Record<CanonicalKbSlot, string> = {
  snapshot: `{ "stage": "…", "status": "…", "keyFacts": [{ "项目项": "…", "内容": "…", "证据/来源": "…" }], "gaps": [{ "text": "…", "confidence": "gap" }] }`,
  "target-overview": `{ "businessSummary": [{ "paragraphs": ["…"] }], "assetSummary": [{ "资产/权利/能力": "…", "定义与范围": "…" }], "gaps": [] }`,
  "industry-market": `{ "marketDrivers": [{ "主题": "…", "事实/数据": "…", "投资含义": "…" }], "gaps": [] }`,
  "business-operations": `{ "journeyMap": { "stages": ["…"], "lanes": [{ "label": "…", "nodes": ["…"] }] }, "customerBuyer": [], "gaps": [] }`,
  "legal-ownership": `{ "entities": [{ "主体/权利": "…", "角色/归属": "…" }], "relationshipEdges": [{ "relation": "…", "from": "…", "to": "…" }] }`,
  "regulatory-compliance": `{ "jurisdictionRows": [{ "监管/规则": "…", "适用原因": "…" }], "gaps": [] }`,
  "resource-network": `{ "parties": [{ "主体/资源": "…", "关系与作用": "…" }], "missingResources": [] }`,
  "comps-benchmark": `{ "compsRows": [{ "可比对象": "…", "可比逻辑": "…" }], "relevanceNotes": [] }`,
  "valuation-returns": `{ "scenarios": [{ "label": "Base", "value": "…", "detail": "…" }], "sensitivityItems": [], "gaps": [] }`,
  "diligence-gaps": `{ "questionGroups": [{ "priority": "P1", "title": "…", "questions": [{ "question": "…", "whyItMatters": "…", "owner": "…" }] }] }`,
  "risks-mitigation": `{ "riskRows": [{ "level": "高", "risk": "…", "cause": "…", "impact": "…", "mitigation": "…", "evidenceSourceIds": ["A-1"] }] }`,
  "timeline-milestones": `{ "occurred": [{ "date": "2026-06-01", "title": "…", "detail": "…", "phase": "occurred" }], "inProgress": [], "future": [], "gaps": [] }`,
  "decision-framework": `{ "recommendation": "…", "decisionTable": [{ "选项": "继续推进", "好处": "…" }], "nextActions": [] }`,
};

/** 单 slot incremental 专用工作流（structured patch 主路径） */
export function buildHermesKnowledgeNetworkStructuredPatchWorkflow(
  jfoBase: string,
  projectId: string,
  projectTitleHint: string,
  slot: CanonicalKbSlot,
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;

  return `

【知识网络 · Structured Slot Patch 工作流（Hermes v2.92 · 单 slot incremental · 主路径）】
增量更新（v2.91）：仅改用户点名的 **#${slot}**；交付 structured-slot-patch JSON，由 Worker 确定性渲染并合并。
资料：当前 KB（只读参考 citation）+ 点名 slot 相关资料 + session 附件（按需 textUrl）。**不要**展开完整 13-slot reading plan。

${buildHermesKnowledgeNetworkStructuredPatchProtocol(slot)}

**可选：只读拉取当前版（已有 Appendix A source id / 版式参考）**
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`
工作文件仅供阅读已有 source id；**禁止**整页编辑或 PUT。

**硬性禁止**
- **禁止** bash ${KB_PUT_SCRIPT} / curl PUT
- **禁止** sectionHtml / slot-html-patch / 整页 \\\`\\\`\\\`html（除非 requires_full_update 后用户改走 multi-slot/full）
- timeline-milestones：**仅**项目级节点；行业/市场新闻不得写入 timeline`;

}

/** incremental 单 slot：Hermes 交付 slot-html-patch JSON（兼容 fallback，非默认） */
export function buildHermesKnowledgeNetworkSlotPatchProtocol(
  slot: CanonicalKbSlot,
): string {
  return `

【知识网络 · Slot HTML Patch 增量交付（单 slot · schema v2.91 · 兼容 fallback）】
⚠️ **非默认路径**。正常应交付 structured-slot-patch；仅当 Worker/平台明确要求 HTML patch 时才使用本格式。
用户仅更新 **#${slot}**。交付 slot-html-patch JSON；**不要** curl PUT。

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（改了什么、证据/缺口变化）。
2. 附 **一个** \\\`\\\`\\\`json 代码块（type 必须为 slot-html-patch）：
\\\`\\\`\\\`json
{
  "type": "slot-html-patch",
  "schemaVersion": "2.91",
  "mode": "incremental",
  "slot": "${slot}",
  "replace": "section",
  "sectionHtml": "<section class=\\"block kb-panel\\" id=\\"${slot}\\">...</section>",
  "appendixUpdates": {
    "sourceIndexHtml": null,
    "glossaryHtml": null,
    "dataDictionaryHtml": null,
    "versionLedgerRowHtml": null
  },
  "summary": "仅更新 ${slot}，……"
}
\\\`\\\`\\\`
3. sectionHtml 必须是**完整** \`<section id="${slot}">…</section>\`；**禁止**含 html/body/script/KB-CONFIG/nav/kb-shell。
4. citation **仅可引用**当前 KB Appendix A 已存在的 \`#source-*\` id；若需新增来源，改走整页 fallback。`;
}

/** 单 slot incremental 专用工作流（slot-html-patch 兼容 fallback） */
export function buildHermesKnowledgeNetworkSlotPatchWorkflow(
  jfoBase: string,
  projectId: string,
  projectTitleHint: string,
  slot: CanonicalKbSlot,
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;

  return `

【知识网络 · Slot HTML Patch 工作流（兼容 fallback · 非默认）】
⚠️ 首选 structured-slot-patch。本工作流仅在无法输出结构化 JSON 时的兼容路径。
增量更新（v2.91）：仅改用户点名的 **#${slot}**。

${buildHermesKnowledgeNetworkSlotPatchProtocol(slot)}

**可选：只读拉取当前版**
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`

**再次强调**
- **禁止** bash ${KB_PUT_SCRIPT} / curl PUT 整页 HTML
- 首选 structured-slot-patch；仅 JSON 完全无法生成或必须新增 Appendix A 时，才用整页 \\\`\\\`\\\`html fallback`;
}

/** Hermes Agent 指令：整页 HTML 文件回路 + curl PUT（initial/full/多 slot incremental/reorder） */
export function buildHermesKnowledgeNetworkFileProtocol(
  jfoBase: string,
  projectId: string,
  userId: string,
  jobId: string,
  projectTitleHint: string,
  mode: KnowledgeNetworkUpdateMode,
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;
  const { modeLine, materialsLine, getStep, editStep } = knModeWorkflowLines(mode);

  return `

【知识网络 · 一次回复双交付（Hermes v2.92 硬性）】
${modeLine}
${materialsLine}

**Skill 路径（Railway canonical）**
- 只读 \`${KB_SKILL_BASE}/\` 下文件；**禁止** \`~/.hermes/skills/\` 或 \`/opt/data/home/.hermes/skills/\`。
- deep refs 用 \`read_file ${KB_SKILL_BASE}/references/deep/…\` 或 \`skill_view opportunistic-investments-hermes\`；**禁止** \`skill_view knowledge-base-generation\`（legacy 已废弃）。

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（改了哪些 slot、Populated/Stub；重排则说明新 display-order）。
2. **PUT 成功（脚本输出 PUT OK）**：仅摘要，**禁止**在回复末尾附整页 \\\`\\\`\\\`html。
3. PUT 失败：说明 Worker 返回的 validation error；**最多修正 KB-CONFIG/HTML 后再 PUT 一次**；仍失败则停止，附整页 \\\`\\\`\\\`html 作 fallback。
4. **禁止**自行拼 curl / python / urllib PUT（Bearer 会被日志脱敏破坏）；**必须**用下方固定脚本。
5. **禁止**只写「已保存到 ${workFile}」而不 PUT 或代码块交付。

**容器内工作流**
工作文件：\`${workFile}\`（\`mkdir -p ./kb/${projectId}\`）
模板：\`${KB_SKILL_BASE}/assets/kb-template.html\`

**A. 拉取当前版** — ${getStep}
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`

**B. 编辑** — ${editStep}
KB-CONFIG 必须与 kb-config.md / kb-template.html **相同行格式**：
\`\`\`html
<!-- KB-CONFIG
schema-version: 2.91
display-order: snapshot, target-overview, ...
-->
\`\`\`
**禁止**仅用 JSON script 块承载 schema-version。

**C. PUT（唯一允许方式）**
\`\`\`bash
bash ${KB_PUT_SCRIPT} \\
  --file "${workFile}" \\
  --api-base "${jfoBase}" \\
  --project-id "${projectId}" \\
  --user-id "${userId}" \\
  --job-id "${jobId}" \\
  --mode "${mode}"
\`\`\`
脚本会先校验 \`schema-version: 2.91\` 行，再 curl PUT；成功时 stdout 含 \`PUT OK\`。`;
}
