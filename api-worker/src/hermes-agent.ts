import {
  extractKnowledgeNetworkHtml,
  extractKnowledgeNetworkHtmlLoose,
  type SkillIntent,
} from "./chat-modes";
import {
  buildHermesKnowledgeNetworkFileProtocol,
  buildHermesKnowledgeNetworkRequiredReads,
  buildHermesKnowledgeNetworkSlotPatchWorkflow,
  isVisualDebugKnRequest,
  messageTouchesMaturityScorecard,
  messageTouchesTimeline,
} from "./hermes-knowledge-network";
import { shouldUseSlotHtmlPatchMode } from "./knowledge-network-slot-patch";
import {
  buildKnowledgeNetworkSlotResolutionLines,
  resolveKnowledgeNetworkSlotsFromMessage,
} from "./knowledge-network-slot-aliases";
import { buildKnowledgeNetworkDeepRefResolutionLines } from "./knowledge-network-deep-refs";
import { buildJfoMaterialsInstructions } from "./hermes-materials-instructions";
import { detectKnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import {
  listHermesRunApprovalUrls,
  listHermesRunPollUrls,
  listHermesRunsBaseUrls,
  listHermesRunsPostUrls,
} from "./hermes-url";

export type HermesAgentEnv = {
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
  HERMES_MODEL?: string;
  JFO_API_PUBLIC_BASE?: string;
};

export type HermesRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "stopping"
  | string;

export type HermesRunPoll = {
  runId: string;
  status: HermesRunStatus;
  output: string;
  error: string | null;
  raw: unknown;
};

/** Runs API 的 model 字段用服务端 profile 名；勿用 qwen-plus（易与 Dashboard 代理混淆） */
function hermesRunModel(_env: HermesAgentEnv): string {
  return "hermes-agent";
}

export function isHermesAgentConfigured(env: HermesAgentEnv): boolean {
  return Boolean((env.HERMES_BASE_URL || "").trim() && (env.HERMES_API_KEY || "").trim());
}

/** 清理 secret 粘贴事故；Hermes 侧 hmac.compare_digest 仅支持 ASCII，非 ASCII 会 500 */
export function normalizeHermesApiKey(raw: string | undefined): string {
  return (raw || "")
    .trim()
    .replace(/undefined/giu, "")
    .replace(/["'\s]/gu, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function hermesAuthHeaders(env: HermesAgentEnv): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${normalizeHermesApiKey(env.HERMES_API_KEY)}`,
  };
}

/** 用 Worker 当前配置的 key 探测 Hermes 鉴权（供 /api/health） */
export async function probeHermesAuth(env: HermesAgentEnv): Promise<{
  ok: boolean;
  httpStatus: number;
  probeUrl: string;
  bodyPreview: string;
}> {
  const key = normalizeHermesApiKey(env.HERMES_API_KEY);
  const base = (env.HERMES_BASE_URL || "").trim();
  if (!key || !base) {
    return { ok: false, httpStatus: 0, probeUrl: "", bodyPreview: "HERMES_BASE_URL 或 HERMES_API_KEY 未配置" };
  }

  const urls = listHermesRunsBaseUrls(base).map((b) => `${b}/v1/models`);
  let last = { ok: false, httpStatus: 0, probeUrl: urls[0] ?? "", bodyPreview: "" };

  for (const probeUrl of urls) {
    try {
      const res = await fetch(probeUrl, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const bodyPreview = (await res.text()).replace(/\s+/gu, " ").slice(0, 120);
      last = { ok: res.ok, httpStatus: res.status, probeUrl, bodyPreview };
      if (res.ok) return last;
      // 裸 /v1/models 已响应 401/403：密钥问题，勿再用 /api/v1 覆盖成 404
      if (res.status === 401 || res.status === 403) return last;
    } catch (e) {
      last = {
        ok: false,
        httpStatus: 0,
        probeUrl,
        bodyPreview: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return last;
}

/** POST /v1/runs 探测（与 GET /models 区分；部分 Railway 仅开放 models） */
export async function probeHermesRunsStart(env: HermesAgentEnv): Promise<{
  ok: boolean;
  httpStatus: number;
  probeUrl: string;
  bodyPreview: string;
  runId: string | null;
}> {
  const key = normalizeHermesApiKey(env.HERMES_API_KEY);
  const base = (env.HERMES_BASE_URL || "").trim();
  if (!key || !base) {
    return {
      ok: false,
      httpStatus: 0,
      probeUrl: "",
      bodyPreview: "未配置",
      runId: null,
    };
  }

  const body = JSON.stringify({
    model: "hermes-agent",
    input: "ping",
    session_id: "jfo-probe",
  });
  const urls = listHermesRunsPostUrls(base);
  let last = {
    ok: false,
    httpStatus: 0,
    probeUrl: urls[0] ?? "",
    bodyPreview: "",
    runId: null as string | null,
  };

  for (const probeUrl of urls) {
    try {
      const res = await fetch(probeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body,
      });
      const text = await res.text();
      const bodyPreview = text.replace(/\s+/gu, " ").slice(0, 120);
      let runId: string | null = null;
      try {
        const raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        runId = String(raw.run_id || raw.id || "").trim() || null;
      } catch {
        /* ignore */
      }
      const ok = (res.ok || res.status === 202) && Boolean(runId);
      last = { ok, httpStatus: res.status, probeUrl, bodyPreview, runId };
      if (ok) {
        if (runId) {
          try {
            await fetch(`${probeUrl.replace(/\/runs$/u, "")}/runs/${encodeURIComponent(runId)}/stop`, {
              method: "POST",
              headers: { Authorization: `Bearer ${key}` },
            });
          } catch {
            /* 探测 run 尽力停止，忽略 */
          }
        }
        return last;
      }
      if (res.status === 401 || res.status === 403) return last;
    } catch (e) {
      last = {
        ok: false,
        httpStatus: 0,
        probeUrl,
        bodyPreview: e instanceof Error ? e.message : String(e),
        runId: null,
      };
    }
  }
  return last;
}

/** 内部给 Hermes Agent 的任务说明（可用 skill 名，用户不可见） */
export function buildHermesAgentInstructions(
  env: HermesAgentEnv,
  intent: SkillIntent,
  projectId: string,
  projectTitleHint: string,
  ctx?: {
    userId?: string;
    conversationId?: string;
    jobId?: string;
    userMessage?: string;
    hasExistingKb?: boolean;
  },
): string {
  const jfoBase = (env.JFO_API_PUBLIC_BASE || "https://jfo-api.jfo-api.workers.dev").trim();
  const userId = (ctx?.userId ?? "").trim();
  const conversationId = (ctx?.conversationId ?? "").trim();
  const knMode =
    intent === "knowledge_network"
      ? detectKnowledgeNetworkUpdateMode(
          ctx?.userMessage ?? "",
          Boolean(ctx?.hasExistingKb),
        )
      : undefined;
  const intentSkillMap: Record<Exclude<SkillIntent, "standard">, string> = {
    project_intake: "project-intake",
    knowledge_network: "opportunistic-investments-hermes",
    ic_memo: "ic-memo",
    dd_checklist: "dd-checklist",
    dd_claim_audit: "dd-claim-audit",
    document_reorganize: "document-reorganize",
    public_info_search: "public-info-search",
    term_annotator: "term-annotator",
    comp_analysis: "comp-analysis",
    background_check: "background-check",
    risk_matrix: "risk-matrix",
    returns_analysis: "returns-analysis",
    sensitivity_analysis: "sensitivity-analysis",
    value_creation_plan: "value-creation-plan",
    gap_tracking: "gap-tracking",
    node_monitoring: "node-monitoring",
  };

  const primarySkill =
    intent === "standard" ? "project-intake" : intentSkillMap[intent] ?? "project-intake";

  const lines = [
    "你是联合家办平台的后台分析引擎。用户在网站对话中提需求，你的回复将直接展示在家办平台（用户不知道后台 Agent、插件或技能包等实现细节）。",
    `当前项目 projectId=${projectId}（${projectTitleHint}）。`,
    "",
    "【工作顺序】",
    `1. jfo-r2-materials：先确认资料清单与当前 KB，再按任务按需读取正文（见下方策略；非机械全文拉取）。`,
    `2. 执行主任务（内部 skill：${primarySkill}）完成用户交付。`,
    buildJfoMaterialsInstructions(
      jfoBase,
      projectId,
      intent,
      userId,
      conversationId,
      knMode,
    ),
    "",
    "【对用户输出的要求】",
    "- 用简体中文，Markdown 表格与结构化正文。",
    "- 禁止提及 Hermes、skill 名、Opportunistic、JSON Schema、Cowork 本地文件夹、导出到其它系统。",
    "- 不要元叙述开场（如「我们以尽调视角」），直接交付分析结果。",
    "- 不要结尾推销后台模板或工具名。",
  ];

  if (intent === "ic_memo") {
    lines.push(
      "",
      "【IC 备忘录 · 平台交付】",
      "- 输出 Markdown 草稿（投资概要、逻辑、风险、条款、表决建议）。",
      "- 优先基于当前知识网络 KB；仅当 KB 缺关键事实时再按需拉原始资料。",
      "- 禁止声称已生成 Word/.docx 或「文件已保存到磁盘」——本平台当前不产出 .docx。",
    );
  }

  if (intent === "knowledge_network") {
    const jobId = (ctx?.jobId ?? "").trim() || "unknown-job";
    const userMessage = ctx?.userMessage ?? "";
    const mode = knMode ?? "initial";
    const visualDebug = isVisualDebugKnRequest(userMessage);
    const touchedSlots = resolveKnowledgeNetworkSlotsFromMessage(userMessage);
    const slotPatchSlot = shouldUseSlotHtmlPatchMode(mode, touchedSlots)
      ? touchedSlots[0]
      : null;
    const slotPatchMode = Boolean(slotPatchSlot);
    lines.push(
      buildHermesKnowledgeNetworkRequiredReads({
        mode,
        touchesTimeline: messageTouchesTimeline(userMessage),
        touchedSlots,
        slotPatchMode,
        touchesMaturityScorecard: messageTouchesMaturityScorecard(userMessage),
        includeStyleGuide: visualDebug,
        includeComponents: visualDebug,
      }),
      buildKnowledgeNetworkSlotResolutionLines(userMessage),
      buildKnowledgeNetworkDeepRefResolutionLines(mode, touchedSlots),
    );
    if (slotPatchSlot) {
      lines.push(
        buildHermesKnowledgeNetworkSlotPatchWorkflow(
          jfoBase,
          projectId,
          projectTitleHint,
          slotPatchSlot,
        ),
        "预注入摘录只供事实依据；slot patch 模式下 Worker 合并 JSON patch 入库，勿整页 PUT。",
      );
    } else {
      lines.push(
        buildHermesKnowledgeNetworkFileProtocol(
          jfoBase,
          projectId,
          userId || "system",
          jobId,
          projectTitleHint,
          mode,
        ),
        "预注入摘录只供事实依据；写入 HTML 时须保留 assets/kb-template.html 结构与 <!-- KB-CONFIG -->。",
      );
    }
  }

  return lines.join("\n");
}

export async function startHermesRun(
  env: HermesAgentEnv,
  params: {
    userMessage: string;
    sessionId: string;
    instructions: string;
    history: { role: string; content: string }[];
  },
): Promise<{ runId: string | null; error: string | null }> {
  const base = (env.HERMES_BASE_URL || "").trim();
  if (!base) return { runId: null, error: "未配置 HERMES_BASE_URL" };

  const urls = listHermesRunsPostUrls(base);
  const body = {
    model: hermesRunModel(env),
    input: params.userMessage,
    session_id: params.sessionId,
    instructions: params.instructions,
    conversation_history: params.history.slice(-12),
  };

  const attempts: string[] = [];
  const failures: string[] = [];
  try {
    for (const url of urls) {
      attempts.push(url);
      const res = await fetch(url, {
        method: "POST",
        headers: hermesAuthHeaders(env),
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let raw: Record<string, unknown> = {};
      try {
        raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        if (res.status === 403 || res.status === 404 || res.status === 405) {
          failures.push(`${url} → HTTP ${res.status}（非 JSON）`);
          continue;
        }
        const hint = rawText.replace(/\s+/gu, " ").slice(0, 120);
        return {
          runId: null,
          error: `Hermes Runs 返回非 JSON（HTTP ${res.status}，${url}）${hint ? `：${hint}` : ""}`,
        };
      }
      const ok = res.ok || res.status === 202;
      if (!ok) {
        const err =
          (raw.error as { message?: string } | undefined)?.message ||
          (raw.detail as string) ||
          (raw.message as string) ||
          `HTTP ${res.status}`;
        failures.push(`${url} → ${err}`);
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405) {
          continue;
        }
        return { runId: null, error: String(err) };
      }
      const runId = String(raw.run_id || raw.id || "").trim();
      if (!runId) {
        failures.push(`${url} → HTTP ${res.status} 但无 run_id`);
        continue;
      }
      return { runId, error: null };
    }
    return {
      runId: null,
      error: `Hermes Runs 不可用。${failures.join("；") || attempts.join(" ")}。请打开 /api/health 查看 hermesRunsOk；若 models 通而 runs 不通，需在 Railway 公网暴露完整 API（8642），非仅 Dashboard。`,
    };
  } catch (e) {
    return { runId: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export type HermesApprovalChoice = "once" | "session" | "always" | "deny";

/** POST /v1/runs/{id}/approval — 网站无人值守时由 Worker 代批 */
export async function submitHermesRunApproval(
  env: HermesAgentEnv,
  runId: string,
  choice: HermesApprovalChoice = "once",
): Promise<{ ok: boolean; httpStatus: number; detail: string }> {
  const base = (env.HERMES_BASE_URL || "").trim();
  if (!base || !runId) {
    return { ok: false, httpStatus: 0, detail: "未配置 HERMES_BASE_URL 或 runId" };
  }

  const body = JSON.stringify({ choice });
  const urls = listHermesRunApprovalUrls(base, runId);
  let last = { ok: false, httpStatus: 0, detail: "" };

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: hermesAuthHeaders(env),
        body,
      });
      const text = await res.text();
      let detail = text.replace(/\s+/gu, " ").slice(0, 160);
      if (!detail && res.ok) detail = `choice=${choice}`;
      if (!res.ok) {
        try {
          const raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          const err = raw.error as { message?: string } | undefined;
          detail = err?.message || (raw.detail as string) || detail || `HTTP ${res.status}`;
        } catch {
          detail = detail || `HTTP ${res.status}`;
        }
      }
      last = { ok: res.ok, httpStatus: res.status, detail };
      if (res.ok) return last;
      if (res.status === 404 || res.status === 405) continue;
    } catch (e) {
      last = {
        ok: false,
        httpStatus: 0,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return last;
}

function isWaitingForHermesApproval(status: string): boolean {
  return status.trim().toLowerCase() === "waiting_for_approval";
}

async function fetchHermesRunSnapshot(
  env: HermesAgentEnv,
  runId: string,
): Promise<HermesRunPoll> {
  const base = (env.HERMES_BASE_URL || "").trim();
  const urls = listHermesRunPollUrls(base, runId);
  let lastError = "Hermes 状态查询失败";

  for (const url of urls) {
    const res = await fetch(url, { headers: hermesAuthHeaders(env) });
    const rawText = await res.text();
    let raw: Record<string, unknown> = {};
    try {
      raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      if (res.status === 404) continue;
      return {
        runId,
        status: "failed",
        output: "",
        error: `Hermes 状态返回非 JSON（HTTP ${res.status}）`,
        raw: rawText.slice(0, 500),
      };
    }
    if (!res.ok) {
      lastError =
        (raw.error as { message?: string } | undefined)?.message ||
        (raw.message as string) ||
        `HTTP ${res.status}`;
      if (res.status === 404) continue;
      return { runId, status: "failed", output: "", error: String(lastError), raw };
    }

    const status = String(raw.status || "unknown");
    const output = String(raw.output || raw.result || "").trim();
    const error = raw.error ? String((raw.error as { message?: string }).message || raw.error) : null;
    return { runId, status, output, error, raw };
  }

  return { runId, status: "failed", output: "", error: lastError, raw: null };
}

export async function pollHermesRun(env: HermesAgentEnv, runId: string): Promise<HermesRunPoll> {
  const snap = await fetchHermesRunSnapshot(env, runId);
  if (!isWaitingForHermesApproval(snap.status)) return snap;

  const approval = await submitHermesRunApproval(env, runId, "once");
  if (!approval.ok) {
    return {
      ...snap,
      error: snap.error || `自动审批失败：${approval.detail}`,
    };
  }

  await new Promise((r) => setTimeout(r, 400));
  return fetchHermesRunSnapshot(env, runId);
}

export async function waitForHermesRun(
  env: HermesAgentEnv,
  runId: string,
  options: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<HermesRunPoll> {
  const pollIntervalMs = options.pollIntervalMs ?? 3000;
  const maxWaitMs = options.maxWaitMs ?? 8 * 60_000;
  const terminal = new Set(["completed", "failed", "cancelled"]);
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const snap = await pollHermesRun(env, runId);
    if (terminal.has(snap.status)) return snap;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return {
    runId,
    status: "failed",
    output: "",
    error: "Hermes 任务超时（可稍后刷新对话重试）",
    raw: null,
  };
}

export function finalizeHermesOutput(output: string, intent: SkillIntent): {
  answer: string;
  knowledgeNetworkHtml: string | null;
} {
  const answer = output.trim() || "（Hermes 已完成，但未返回可展示正文。）";
  const knowledgeNetworkHtml =
    intent === "knowledge_network"
      ? extractKnowledgeNetworkHtmlLoose(answer)
      : extractKnowledgeNetworkHtml(answer);
  return { answer, knowledgeNetworkHtml };
}
