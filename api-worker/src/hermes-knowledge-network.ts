import type { HermesBridgeEnv } from "./hermes-bridge";
import { finalizeAgentJobAfterKnPut } from "./agent-jobs";
import {
  buildKnowledgeNetworkDeepRefResolutionLines,
  resolveKnowledgeNetworkDeepRefs,
} from "./knowledge-network-deep-refs";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { isCanonicalKbSlot } from "./knowledge-network-fragment-validation";
import { buildFragmentSlotRenderingRecipe } from "./knowledge-network-fragment-slot-recipes";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { validateKnowledgeNetworkHtmlForWrite } from "./knowledge-network-html-validation";
import { resolveKnowledgeNetworkPutJobId } from "./knowledge-network-guards";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";
import {
  buildBatch2EnvelopeSpec,
  buildBatch2RepairEnvelopePrompt,
  buildBatch2StructuredExampleBlock,
} from "./knowledge-network-slot-batch-batch2-protocol";
import {
  buildBatch3EnvelopeSpec,
  buildBatch3StructuredExampleBlock,
} from "./knowledge-network-slot-batch-batch3-protocol";
import { buildMinimalSlotBatchRepairPrompt } from "./knowledge-network-slot-batch-minimal-repair";
import { knPublicSearchMaterialsLine } from "./knowledge-network-kn-policy";

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
    const validation = validateKnowledgeNetworkHtmlForWrite(html, {
      mode: putMode,
      previousHtml,
      strict: true,
      touchesTimeline:
        putMode !== "reorder" && /id=["']timeline-milestones["']/i.test(html),
    });
    if (!validation.ok) {
      return json({ error: validation.error ?? "HTML 校验失败" }, 400);
    }
    const htmlToStore = validation.html ?? html;
    const meta = await upsertProjectKnowledgeNetwork(env, {
      projectId,
      userId,
      html: htmlToStore,
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
  const validation = validateKnowledgeNetworkHtmlForWrite(html, {
    mode: putMode,
    previousHtml,
    strict: true,
    touchesTimeline:
      putMode !== "reorder" && /id=["']timeline-milestones["']/i.test(html),
  });
  if (!validation.ok) {
    return json({ error: validation.error ?? "HTML 校验失败" }, 400);
  }

  const htmlToStore = validation.html ?? html;
  const meta = await upsertProjectKnowledgeNetwork(env, {
    projectId,
    userId,
    html: htmlToStore,
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
  /** incremental 且用户仅点名 1 个 slot：structured-slot-patch 为正常交付路径 */
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
  const isStructuredKbDataMode = mode === "initial" || mode === "full";
  if (isStructuredKbDataMode) {
    add("references/structured-kb-data-schema.md");
    add("examples-kb-data.json");
  } else {
    add("assets/kb-template.html");
  }

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

  const ruleSummary = [
    "",
    "规则摘要（Hermes v2.92 · schema v2.91）：",
    "- 13 个 core canonical slot + Appendix A–D；展示顺序由 <!-- KB-CONFIG --> display-order 驱动（schema-version: 2.91）。",
    "- legacy v2.8 / 11-slot KB 须全量重建（Route A），禁止增量 patch 旧 anchor。",
    "- 资料仅经 jfo-r2-materials：manifest/digest → 按需 textUrl，禁止机械全文拉取。",
    "- 正文 citation（如 #source-U-1）须对应 Appendix A id；Worker 渲染时自动生成 nav / KB-CONFIG / revealAnchor。",
    "- **timeline-milestones** 仅写项目推进节点；行业/市场背景写 industry-market/comps-benchmark/risks-mitigation。",
    "- **成熟度三张卡** `.stat-value` 由 Worker 在入库后重算；Hermes **禁止**为抬高 Factor A / maturity / qualityCoverage 编造事实或凑数。",
    "- **Factor A = Evidence Maturity**（v2.93 maturity-scoring.md）：13 个 core slot 硬证据成熟度均值，分母固定 13；每 slot 用 conservative cap（如无投资额/量化回报则 valuation≤5%、无可比则 comps=0% 等）。gap rows / 结构覆盖度不抬高 Factor A。",
    "- **禁止** legacy v2.8 anchors（assets、business-model、timeline 等）、skills_reference.md、根目录 kb-template.html。",
    "- **deep refs**：initial/full 读齐 7 个 references/deep/*.md；incremental 仅读点名 slot 映射；reorder 不读。",
    isStructuredKbDataMode
      ? "- **initial/full 主路径**：交付 `structured-kb-data` JSON（见 references/structured-kb-data-schema.md 与 examples-kb-data.json）；**禁止**默认 jfo_kb_put.sh / 整页 ```html / 手写 nav / KB-CONFIG / Appendix D。"
      : "- **禁止** read_file examples-kb-data.json、scripts/、components.html、visual-style-guide（非视觉调试）。",
    isStructuredKbDataMode
      ? "- **KB 目标**：事实可追溯、缺口清楚、结构稳定；交付事实、证据、缺口、判断与下一步验证动作（structured JSON）。"
      : "",
    isStructuredKbDataMode
      ? "- **coverage target**：≥N 条 = fact rows + valid gap rows（非 hard factual minimum）；gap 须显式标注，不得伪装成事实。"
      : "",
    isStructuredKbDataMode
      ? "- **maturity 占位即可**：factorA/B/combined 由 Worker 入库后轻量重算；**勿**在 prompt 中追求高分或自填虚高百分比。"
      : "",
    isStructuredKbDataMode
      ? "- PUT / 整页 HTML / kb-template.html 仅为 structured-kb-data 无法交付时的 **fallback**，不是默认路径。"
      : "",
    "- **附录 D version-ledger**：平台在入库时自动从 D1 版本表合并全部历史行；Hermes **禁止**输出 versionLedger 或 Appendix D HTML。",
  ].filter(Boolean);
  lines.push(...ruleSummary);

  if (mode === "full" || mode === "initial") {
    lines.push(
      "- 模式：首次/全量 — **主路径**交付 structured-kb-data JSON（13 slots + sources）；Worker 确定性渲染 HTML 并入库。",
      "- **Hermes 职责**：事实、证据引用（evidenceSourceIds / 证据列）、缺口（gap rows）、判断与 nextAction；**不为分数服务**。",
      "- **coverage target**：每 slot 见 structured-kb-data-schema.md；资料不足写 gap rows，禁止薄 table / 空 row / 编造。",
      "- **禁止**默认 bash jfo_kb_put.sh / 整页 ```html / 手写 nav / KB-CONFIG / Appendix D / revealAnchor。",
      "- Worker repair 仅修：envelope、缺字段、空表、引用、gap 不完整、幻觉；**不因 Evidence Maturity 低反复 repair**。",
    );
  } else if (mode === "incremental" && slotPatchMode) {
    lines.push(
      "- 模式：单 slot 增量 — **主路径**为交付 `structured-slot-patch` JSON，由 Worker 确定性渲染并合并入库。",
      "- **禁止** jfo_kb_put.sh / curl PUT 整页 / 回复末尾整页 ```html / sectionHtml（Hermes PUT 仅为旧版兼容）。",
      "- `slot-html-patch` 仅为平台 backward-compatible fallback，**不是**默认交付格式。",
      "- evidenceSourceIds **仅可引用**当前 Appendix A 已有 source id；若需新增来源索引，返回 requires_full_update 或改走整页 fallback。",
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
          "全量重做（v2.91）：legacy v2.8 KB 须重建；按 kb-schema 13-slot 产出 structured-kb-data JSON，由 Worker 渲染。",
        materialsLine: knPublicSearchMaterialsLine("full"),
        getStep: "全量可跳过 GET；或 curl GET … || echo NO_CURRENT_KB（只读参考，勿整页编辑）",
        editStep:
          "填充 structured-kb-data（13 slots + sources + maturity + meta）；**禁止**手写整页 HTML / nav / KB-CONFIG / Appendix D。",
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
        materialsLine: knPublicSearchMaterialsLine("incremental"),
        getStep: "必做：curl GET 当前版到工作文件",
        editStep:
          "局部编辑点名 slot；若含 timeline-milestones 须读 timeline-rules.md 并过 eligibility gate。",
      };
    case "initial":
    default:
      return {
        modeLine:
          "首次生成（v2.91）：无已发布版；按 kb-schema 13-slot 产出 structured-kb-data JSON，由 Worker 渲染。",
        materialsLine: knPublicSearchMaterialsLine("initial"),
        getStep: "无旧版可跳过 GET；或 curl GET … || echo NO_CURRENT_KB（只读参考）",
        editStep:
          "填充 structured-kb-data JSON（config/meta/maturity/slots/sources）；timeline-milestones 须经 eligibility gate。",
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
  "legal-ownership": `{ "entities": [{ "主体/权利": "目标主体（待确认）", "角色/归属": "…", "限制/负担": "—", "证据/缺口": "资料未提供" }], "unresolvedLegalIssues": [{ "issue": "…", "whyItMatters": "…", "requiredEvidence": "…", "owner": "…", "decisionImpact": "…", "riskLevel": "中" }] }`,
  "regulatory-compliance": `{ "regulatoryGaps": [{ "jurisdiction": "…", "requirement": "…", "currentEvidence": "未提供", "gap": "待确认/需法律意见", "nextAction": "…", "riskLevel": "高" }] }`,
  "resource-network": `{ "parties": [{ "主体/资源": "…", "关系与作用": "…" }], "missingResources": [] }`,
  "comps-benchmark": `{ "compsRows": [{ "可比对象": "…", "可比逻辑": "…" }], "relevanceNotes": [] }`,
  "valuation-returns": `{ "scenarios": [{ "label": "Base", "value": "…", "detail": "…" }], "sensitivityItems": [], "gaps": [] }`,
  "diligence-gaps": `{ "questionGroups": [{ "priority": "P1", "title": "…", "questions": [{ "question": "…", "whyItMatters": "…", "owner": "…" }] }] }`,
  "risks-mitigation": `{ "riskRows": [{ "level": "高", "risk": "…", "cause": "…", "impact": "…", "mitigation": "…", "evidenceSourceIds": ["A-1"] }] }`,
  "timeline-milestones": `{ "occurred": [{ "date": "2026-06-01", "title": "…", "detail": "…", "phase": "occurred" }], "inProgress": [], "future": [], "gaps": [] }`,
  "decision-framework": `{ "recommendation": "…", "decisionTable": [{ "选项": "继续推进", "好处": "…" }], "nextActions": [] }`,
};

/** initial / full：Hermes 交付 structured-kb-data JSON（主路径），Worker 确定性渲染整页 */
export function buildHermesKnowledgeNetworkStructuredKbDataProtocol(
  mode: "initial" | "full",
): string {
  return `

【知识网络 · Structured KB Data 全量交付（${mode} · schema v2.91 · 主路径）】
本任务**必须**交付 **structured-kb-data** JSON；Worker 确定性渲染 nav / KB-CONFIG / 13 slots / Appendix A–C。

**发布门槛（Worker）**
- KB 目标：**事实可追溯、缺口清楚、结构稳定** — 非把分数做高。
- **coverage target** = fact rows + valid gap rows（≥N 非 hard factual minimum）；gap 须显式标注。
- **Hard gate**（须 repair）：空 row、无法映射、明显幻觉、断引用等。
- **Soft warning**（不阻止发布）：Evidence Maturity 低、gap-first、无法量化估值、缺可比等。
- \`maturity\` 填占位即可；Factor A = **Evidence Maturity**（13 slot 硬证据 cap 均值）；gap rows 不抬高 Factor A。

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（覆盖哪些 slot、主要证据与缺口）。
2. 附 **一个** \\\`\\\`\\\`json 代码块（type 必须为 structured-kb-data）：
\\\`\\\`\\\`json
{
  "type": "structured-kb-data",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "summary": "…",
  "config": { "displayOrder": ["snapshot", "…"], "projectType": "general" },
  "meta": { "title": "…", "autoSummary": "…" },
  "maturity": { "factorA": "—", "factorB": "—", "combined": "—", "tier": "Early" },
  "slots": { "snapshot": { … }, …13 keys… },
  "sources": [{ "id": "U-1", "type": "…", "title": "…" }],
  "terms": [],
  "dataDictionary": []
}
\\\`\\\`\\\`
3. slots 须含 **13 个 canonical key**；payload 形状见 structured-kb-data-schema.md 与 examples-kb-data.json。
4. sources.id **禁止 duplicate**；所有 evidenceSourceIds 须先出现在 sources 中。
5. **禁止** versionLedger / Appendix D HTML / 整页 \\\`\\\`\\\`html / sectionHtml / 手写 nav / KB-CONFIG / revealAnchor。
6. **禁止**默认 bash ${KB_PUT_SCRIPT}；仅当 JSON 完全无法交付时才 fallback PUT 或整页 HTML。`;
}

/** Worker repair_needed 时注入 Hermes 的补全指令（同一 job，最多一次） */
export function buildHermesStructuredKbRepairPrompt(repairMessage: string): string {
  return `【structured-kb-data · hard/结构 repair（同一 job · 仅一次）】

上一轮 JSON **未通过 Worker hard publish gate**。请**只**修 structured-kb-data JSON，**禁止**写 HTML / PUT。

**禁止以提高 Factor A / maturity / qualityCoverage 为目标**；资料不足补 gap rows，不补假事实。

**缺项清单**
${repairMessage}

**要求**
1. 输出 **一个** \\\`\\\`\\\`json 代码块，type 必须为 structured-kb-data，含完整 13 slots + sources。
2. 修 envelope / 缺字段 / 空表 / 引用 / gap rows 不完整 / 幻觉；gap 须含 requiredEvidence、decisionImpact 或 nextAction。
3. maturity 填占位；Worker 入库后轻量重算 13-slot Evidence Maturity + Source Diversity。`;
}

/** initial / full 专用工作流（structured-kb-data 主路径） */
export function buildHermesKnowledgeNetworkStructuredKbDataWorkflow(
  jfoBase: string,
  projectId: string,
  projectTitleHint: string,
  mode: "initial" | "full",
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;
  const { modeLine, materialsLine, getStep, editStep } = knModeWorkflowLines(mode);

  return `

【知识网络 · Structured KB Data 工作流（Hermes v2.92 · ${mode} · 主路径）】
${modeLine}
${materialsLine}

${buildHermesKnowledgeNetworkStructuredKbDataProtocol(mode)}

**资料与 schema**
- 必读 \`${KB_SKILL_BASE}/references/structured-kb-data-schema.md\` 与 \`examples-kb-data.json\`
- slot payload 与 incremental \`structured-slot-patch\` 对齐；完整 13 slot 一次交付

**可选：只读拉取旧版（legacy 参考 / source id）** — ${getStep}
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`
${editStep}

**硬性禁止（默认路径）**
- **禁止** bash ${KB_PUT_SCRIPT} / curl PUT 整页 HTML
- **禁止** 回复末尾整页 \\\`\\\`\\\`html / 手写 nav / KB-CONFIG / Appendix D
- Worker 渲染成功后自动 validate + upsert + sync chat

**Fallback（仅 structured JSON 无法交付时）**
- 见下方「文件 API fallback」段落（jfo_kb_put.sh 或整页 \\\`\\\`\\\`html）`;
}

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

/** incremental 单 slot：Hermes 交付 kb-fragment-batch JSON（fragment 主路径） */
export function buildHermesKnowledgeNetworkFragmentIncrementalProtocol(
  slot: string,
): string {
  const recipe = isCanonicalKbSlot(slot)
    ? buildFragmentSlotRenderingRecipe(slot)
    : `- **${slot}**（extension slot · 自定义模块）保持 kb-panel section 结构；禁止 shell/nav/KB-CONFIG。`;
  return `

【知识网络 · kb-fragment-batch 增量交付（单 slot · schema v2.91 · fragment 主路径）】
用户仅更新 **#${slot}**。交付 **kb-fragment-batch** JSON（\`mode: "incremental"\`）；**禁止** structured-slot-patch / curl PUT / 整页 \\\`\\\`\\\`html。

**对用户可见回复**
1. 先写 3–8 行简体中文摘要（改了什么、证据/缺口变化）。
2. 附 **一个** \\\`\\\`\\\`json 代码块（type 必须为 kb-fragment-batch）：
\\\`\\\`\\\`json
{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "mode": "incremental",
  "batchIndex": 0,
  "summary": "仅更新 ${slot}。",
  "sourceProposals": [],
  "fragments": {
    "${slot}": "<section class=\\"block kb-panel\\" id=\\"${slot}\\">...</section>"
  },
  "appendixFragments": null
}
\\\`\\\`\\\`
3. \`fragments.${slot}\` 必须是**完整** \`<section id="${slot}">…</section>\`；遵守 Codex 渲染食谱，禁止 shell/nav/KB-CONFIG。
4. citation：Appendix A 已有 \`#source-*\`，或本批 \`sourceProposals\` 临时 key（Worker 入库时分配 U-N/A-N）。
5. 资料不足写 gap callout / 缺口表，禁止 empty-shell。
6. structured-slot-patch / slot-html-patch 仅为 structured 模式 fallback，**不是**本任务格式。

**本 slot 渲染食谱**
${recipe}`;
}

/** 单 slot incremental 专用工作流（kb-fragment-batch 主路径） */
export function buildHermesKnowledgeNetworkFragmentIncrementalWorkflow(
  jfoBase: string,
  projectId: string,
  projectTitleHint: string,
  slot: string,
): string {
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;

  return `

【知识网络 · Fragment Incremental 工作流（Hermes v2.92 · 单 slot · fragment 主路径）】
增量更新：仅改用户点名的 **#${slot}**；交付 kb-fragment-batch JSON，Worker 合并 section 入库。
资料：当前 KB（只读 citation）+ 点名 slot 相关资料 + session 附件（按需 textUrl）。

${buildHermesKnowledgeNetworkFragmentIncrementalProtocol(slot)}

**可选：只读拉取当前版（已有 source id / 版式参考）**
\`\`\`bash
curl -sS -f -H "Authorization: Bearer $JFO_INTERNAL_KEY" \\
  "${url}?format=raw" -o "${workFile}" || echo "NO_CURRENT_KB"
\`\`\`
工作文件仅供阅读已有 source id；**禁止**整页编辑或 PUT。

**硬性禁止**
- **禁止** bash ${KB_PUT_SCRIPT} / curl PUT
- **禁止** structured-slot-patch / 整页 \\\`\\\`\\\`html
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

/** Hermes Agent 指令：整页 HTML 文件回路 + curl PUT（fallback / incremental / reorder） */
export function buildHermesKnowledgeNetworkFileProtocol(
  jfoBase: string,
  projectId: string,
  userId: string,
  jobId: string,
  projectTitleHint: string,
  mode: KnowledgeNetworkUpdateMode,
  options?: { asFallback?: boolean },
): string {
  const asFallback = options?.asFallback ?? (mode === "initial" || mode === "full");
  const url = hermesKnowledgeNetworkCurrentUrl(jfoBase, projectId);
  const workFile = `./kb/${projectId}/[AI]_${projectTitleHint}_知识网络.html`;
  const { modeLine, materialsLine, getStep, editStep } = knModeWorkflowLines(mode);

  return `

【知识网络 · ${asFallback ? "文件 API fallback（非默认）" : "一次回复双交付（Hermes v2.92 硬性）"}】
${asFallback ? "⚠️ initial/full 默认须交付 structured-kb-data JSON；本段落仅在 JSON 无法交付时使用。\n" : ""}${modeLine}
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

export function buildHermesSlotBatchWorkflow(params: {
  mode: "initial" | "full";
  projectTitle: string;
  batchIndex: number;
  totalBatches: number;
  slots: string[];
  repairHints?: string;
  priorSlots?: string[];
}): string {
  const slotList = params.slots.join(", ");
  const prior =
    params.priorSlots?.length ?
      `\n已完成 slot：${params.priorSlots.join(", ")}。本批勿重复输出。`
    : "";
  const repair = params.repairHints?.trim()
    ? `\n\n【Repair】上一轮本批 hard/结构问题（与 Factor A / maturity 无关）：\n${params.repairHints}\n请只补本批 slot，仍用 structured-slot-batch JSON；资料不足补 gap rows，勿编造事实。`
    : "";
  const gapFirstSlots = params.slots.filter(
    (s) => s === "legal-ownership" || s === "regulatory-compliance",
  );
  const gapFirstBlock =
    gapFirstSlots.length > 0
      ? `

**legal-ownership / regulatory-compliance · gap-first（资料不足时）**
- 若缺合同/许可/审批文件：**禁止编造事实**；用 unresolvedLegalIssues / regulatoryGaps 结构化缺口行（coverage target ≥4 = fact + gap）。
- legal 每条：issue、whyItMatters、requiredEvidence、owner/party、decisionImpact（+ riskLevel）。
- regulatory 每条：jurisdiction、requirement、currentEvidence（可写「未提供」）、gap、nextAction、riskLevel；许可状态仅可写「待确认/需法律意见」。
- gap rows 可帮助 slot 结构通过；**不**为提高 Evidence Maturity 编造事实。`
      : "";
  const isBatch2 = params.batchIndex === 1;
  const isBatch3 = params.batchIndex === 2;
  const batch2Protocol = isBatch2
    ? buildBatch2EnvelopeSpec(params.mode) + buildBatch2StructuredExampleBlock()
    : "";
  const batch3Protocol = isBatch3
    ? buildBatch3EnvelopeSpec(params.mode) + buildBatch3StructuredExampleBlock()
    : "";
  const strictJsonOnly = isBatch2 || isBatch3;
  const deliveryFormat = strictJsonOnly
    ? `**交付格式（Batch ${params.batchIndex + 1} · 仅 JSON）**
回复 **只能** 含 **一个** \\\`\\\`\\\`json 代码块（见上方 envelope + 组件片段示例）；禁止 JSON 外任何文字。allowed 组件是菜单，不是必填套餐。`
    : `**交付格式（必须）**
1. 2–4 行简体中文摘要（本批覆盖内容与证据/缺口）。
2. **一个** \\\`\\\`\\\`json 代码块，type 必须为 \`structured-slot-batch\`：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "batchIndex": ${params.batchIndex},
  "summary": "…",
  ${params.batchIndex === 0 ? '"config": { "displayOrder": ["snapshot", "…"], "projectType": "general" },\n  "meta": { "title": "' + params.projectTitle + '", "autoSummary": "…" },\n  "sources": [{ "id": "U-1", "type": "用户上传", "title": "…" }],' : ""}
  "slots": [
    { "slot": "${params.slots[0]}", "payload": { … }, "status": "ready" }
  ]
}
\\\`\\\`\\\``;
  return `

【知识网络 · Slot-Batched Structured Generation（${params.mode} · 批次 ${params.batchIndex + 1}/${params.totalBatches}）】
Worker 已启用 **分批 structured 生成**；**禁止**一次性输出完整 13-slot structured-kb-data。

**本批须交付 slot**：${slotList}${prior}${gapFirstBlock}${batch2Protocol}${batch3Protocol}${repair}

${deliveryFormat}

**Quality Contract（本批 · coverage target，非分数目标）**
- 每 slot coverage target = fact rows + valid gap rows（见 schema）；禁止空 row / 无法映射列名。
- 缺资料写 **gap rows**（requiredEvidence / decisionImpact / nextAction），勿填空对象或假事实。
- table row 使用 canonical 中文列名（或 schema alias）。
- batch 0 须含 config + meta + sources；后续批次只补本批 slots。
- **禁止**整页 HTML / 13-slot 大包 / PUT / versionLedger。
- maturity / Factor A / qualityCoverage **由 Worker 入库后计算**；Hermes 勿追求高分。`;
}

export function buildHermesSlotBatchRepairPrompt(
  repairMessage: string,
  failedSlots: string[],
  options?: { batchIndex?: number; mode?: "initial" | "full" },
): string {
  const batchIndex = options?.batchIndex ?? 0;
  return buildMinimalSlotBatchRepairPrompt({
    repairMessage,
    failedSlots: failedSlots as import("./knowledge-network-slot-aliases").CanonicalKbSlot[],
    batchIndex,
    mode: options?.mode ?? "full",
  });
}
