import { extractKnowledgeNetworkHtml, type SkillIntent } from "./chat-modes";
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
  ctx?: { userId?: string; conversationId?: string },
): string {
  const jfoBase = (env.JFO_API_PUBLIC_BASE || "https://jfo-api.jfo-api.workers.dev").trim();
  const userId = (ctx?.userId ?? "").trim();
  const conversationId = (ctx?.conversationId ?? "").trim();
  const intentSkillMap: Record<Exclude<SkillIntent, "standard">, string> = {
    project_intake: "project-intake",
    knowledge_network: "knowledge-base-generation",
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
    "你是联合家办平台的后台分析引擎。用户在网站对话中提需求，你的回复将直接展示在家办平台（用户不知道 Hermes、skill 等实现细节）。",
    `当前项目 projectId=${projectId}（${projectTitleHint}）。`,
    "",
    "【必须执行的工作顺序】",
    `1. 先执行 skill「jfo-r2-materials」：用 bash/curl 拉取网站资料 manifest 与全文。`,
    `   a) 项目资料包（全项目共享）：GET ${jfoBase}/api/hermes/projects/${projectId}/manifest?scope=package`,
    ...(userId && conversationId
      ? [
          `   b) 本对话内上传的附件（须纳入，勿忽略）：GET ${jfoBase}/api/hermes/projects/${projectId}/manifest?scope=session&userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId)}`,
          `   或一次拉取资料包+本对话附件：GET ${jfoBase}/api/hermes/projects/${projectId}/manifest?scope=all&userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId)}`,
        ]
      : []),
    "   Header: Authorization: Bearer $JFO_INTERNAL_KEY",
    "   对每个 parsed=true 的文件 GET textUrl 拉正文。",
    `2. 再执行 skill「${primarySkill}」完成用户任务。`,
    "",
    "【对用户输出的要求】",
    "- 用简体中文，Markdown 表格与结构化正文。",
    "- 禁止提及 Hermes、skill 名、Opportunistic、JSON Schema、导出到其它系统。",
    "- 不要元叙述开场（如「我们以尽调视角」），直接交付分析结果。",
    "- 不要结尾推销「如需 Hermes 模板」。",
  ];

  if (intent === "knowledge_network") {
    lines.push(
      "",
      "【知识网络 HTML — 硬性要求】",
      "执行 knowledge-base-generation；**先读 skill 目录 kb-template.html**，将其中 `<style>`、panel-switcher 脚本与 HTML 壳 **原样带入** `<head>`/`<body>`，再按 STYLE_GUIDE 填内容（Portable 米色）。禁止手写一套「看起来像」的简化 CSS。",
      "若上方有【Worker 预注入 · 项目资料摘录】：「本对话上传附件」优先于资料包；摘录只供**事实与细节**（时间轴节点、商业模式、财务数字）；**不得**为塞摘录而破坏模板结构或省略 kb-template 已有组件。",
      "有资料时必须体现（非纯段落糊弄）：项目快照含 .kb-summary；业务模式有流程时用 Journey Map；有术语则维护附录 B。",
      "时间轴 slot（#timeline）必须同时输出 <h3>8.1</h3>、<h3>8.2</h3>、<h3>8.3</h3> 三个子块；8.2 无推进中事项时写 Stub/缺乏资料 callout，禁止从 8.1 直跳 8.3。",
      "8.1 已发生事件：多条或 >4 条日级事件时用 .tl-tree（年→月→日嵌套 details），勿仅用「年份 + badge」扁平列表；结构对照 knowledge-base-generation/assets/components.html Section D。",
      "「投资论点」写在十一决策框架（#decision-framework）内，3–5 条且每条带 href 指向对应 section 锚点的证据链，勿单独裸 <ul> 漂在其它 panel。",
      "必须把完整 HTML 正文放在回复末尾的 ```html ... ``` 代码块中（以 <!DOCTYPE html> 或 <html 开头）。",
      "禁止只写「文件已保存」「文件位置：xxx.html」而不附 HTML 源码——家办网站无法访问 Hermes 服务器磁盘，预览按钮只认代码块。",
      "可先给 3–5 行摘要（含各 section Populated/Stub 一句），再跟 ```html 代码块。",
      `逻辑文件名（摘要里可提）：[AI] ${projectTitleHint}_知识网络.html`,
    );
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
  let answer = output.trim() || "（Hermes 已完成，但未返回可展示正文。）";
  const knowledgeNetworkHtml =
    intent === "knowledge_network" ? extractKnowledgeNetworkHtml(answer) : null;
  if (
    intent === "knowledge_network" &&
    !knowledgeNetworkHtml &&
    /知识网络|\.html|文件位置/u.test(answer)
  ) {
    answer += `

---

**网站预览说明**：本次回复未包含 \`\`\`html 代码块，因此无法在本页点击预览。HTML 若只写在 Hermes 容器里，家办平台读不到。请再发一句：「请把完整知识网络 HTML 放在 \\\`\\\`\\\`html 代码块里返回，不要只写文件路径。」`;
  }
  return { answer, knowledgeNetworkHtml };
}
