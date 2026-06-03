import { citationMapFromSlots, getCitationSlots } from "./citations";
import { handleGetChatAudit } from "./chat-audit-admin";
import { handleBackfillProjectKnowledgeNetworks } from "./project-knowledge-network-admin";
import {
  handleGetActiveAgentJobs,
  handleGetChatState,
  handlePutChatState,
} from "./chat-sync";
import { extractPdfPlainText } from "./pdf-text";
import { extractSpreadsheetPlainText } from "./spreadsheet-text";
import { buildHermesMaterialsDigest } from "./hermes-materials-digest";
import {
  detectSkillIntent,
  shouldRouteToHermes,
  usesFullPackageCorpus,
  type SkillIntent,
} from "./chat-modes";
import {
  completeAgentJob,
  createAgentJob,
  failAgentJob,
  getAgentJob,
  markAgentJobRunning,
  type AgentJobRow,
} from "./agent-jobs";
import {
  buildHermesAgentInstructions,
  finalizeHermesOutput,
  isHermesAgentConfigured,
  normalizeHermesApiKey,
  probeHermesAuth,
  probeHermesRunsStart,
  pollHermesRun,
  startHermesRun,
  waitForHermesRun,
} from "./hermes-agent";
import { refreshConversationMemorySummary } from "./chat-memory";
import {
  buildChatPipelineStream,
  fetchChatCompletionsStream,
  jfoSseError,
  transformOpenAiStreamToJfo,
} from "./chat-stream";
import { CHAT_STATUS, prepareStandardChatContext } from "./chat-context";
import {
  generateConversationTopic,
  isFirstUserTurnInHistory,
} from "./conversation-topic";
import { invalidateChunkCache } from "./chunk-cache";
import { embedDocumentChunks } from "./embeddings";
import { chunkPlainText, isGenericProjectQuestion } from "./search";
import { getProjectById as getDbProjectById } from "./projects-db";
import { LIST_FILES_SQL, packageR2Key, sessionR2Key } from "./documents-access";
import { handleDeleteProjectFile } from "./documents-routes";
import { tryHandleHermesRoutes } from "./hermes-bridge";
import {
  handleCreateProject,
  handleDeleteProject,
  handleGetProject,
  handleListProjects,
  handleUpdateProject,
} from "./projects-routes";
import {
  handleGetProjectKnowledgeNetwork,
  handleGetProjectKnowledgeNetworkVersion,
} from "./project-knowledge-network-routes";
import {
  getProjectKnowledgeNetworkMeta,
} from "./project-knowledge-network";
import {
  buildKnowledgeNetworkModeInstructions,
  detectKnowledgeNetworkUpdateMode,
} from "./knowledge-network-mode";
import { checkKnowledgeNetworkPipelineReady } from "./knowledge-network-guards";
import { decodePathProjectId } from "./projects-resolve";
import {
  assertValidHermesBaseUrl,
  hermesChatCompletionsUrl,
  listHermesChatCompletionsUrls,
  normalizeHermesBaseUrl,
  resolveHermesApiRoot,
} from "./hermes-url";

export interface Env {
  FILES: R2Bucket;
  DB: D1Database;
  /** 可选：Hermes 未配置时，同步快答降级为直连千问 */
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
  HERMES_MODEL?: string;
  /** 用户说「查外部资料」等时联网检索（与 Railway Hermes 的 Tavily 独立配置） */
  TAVILY_API_KEY?: string;
  /** Hermes 只读拉取网站 R2 资料（见 docs/HERMES-R2-READ.md） */
  JFO_INTERNAL_KEY?: string;
  JFO_API_PUBLIC_BASE?: string;
  ALLOWED_ORIGIN?: string;
}

type ChatBody = {
  projectId?: string;
  conversationId?: string;
  userId?: string;
  role?: string;
  message?: string;
  /** 本轮附带的文件名，用于检索 */
  files?: string[];
  history?: { role: string; content: string }[];
  /** 默认 true：轻问同步路径使用 SSE 流式 */
  stream?: boolean;
};

const GITHUB_PAGES_ORIGIN = "https://fangjg16.github.io";

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = (env.ALLOWED_ORIGIN || GITHUB_PAGES_ORIGIN).trim();
  const ok =
    origin === allowed ||
    origin === `${allowed}/` ||
    origin?.startsWith(`${allowed}/`);
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function normalizeUserId(raw: string | null | undefined): string | null {
  const id = (raw ?? "").trim();
  return id.length > 0 ? id : null;
}

async function handleHealth(env: Env): Promise<Response> {
  const hermes = (env.HERMES_BASE_URL || "").trim();
  const apiRoot = hermes ? resolveHermesApiRoot(hermes) : "";
  const dashscope = Boolean((env.DASHSCOPE_API_KEY || "").trim());
  const hermesUnified = isHermesAgentConfigured(env);
  const tavily = Boolean((env.TAVILY_API_KEY || "").trim());
  const hermesBridge = Boolean((env.JFO_INTERNAL_KEY || "").trim());
  const hermesAuth =
    hermesUnified ? await probeHermesAuth(env) : { ok: false, httpStatus: 0, probeUrl: "", bodyPreview: "" };
  const hermesRuns = hermesUnified
    ? await probeHermesRunsStart(env)
    : { ok: false, httpStatus: 0, probeUrl: "", bodyPreview: "", runId: null };
  return json({
    ok: true,
    service: "jfo-api",
    llmMode: hermesUnified ? "hermes-unified" : dashscope ? "dashscope-fallback" : "none",
    llmFastPath: hermesUnified ? "hermes-chat-completions" : dashscope ? "dashscope" : null,
    llmDeepPath: hermesUnified ? "hermes-runs-async" : dashscope ? "dashscope-deep-sync" : null,
    dashscopeConfigured: dashscope,
    dashscopeFallbackAvailable: dashscope && hermesUnified,
    tavilyConfigured: tavily,
    hermesBridgeConfigured: hermesBridge,
    hermesConfigured: Boolean(hermes && env.HERMES_API_KEY),
    hermesAgentRunsConfigured: hermesUnified,
    hermesAuthOk: hermesAuth.ok,
    hermesAuthHttpStatus: hermesAuth.httpStatus,
    hermesAuthProbeUrl: hermesAuth.probeUrl || null,
    hermesAuthHint: hermesAuth.ok
      ? "Hermes GET /v1/models 密钥有效"
      : hermesAuth.httpStatus === 401
        ? "Hermes 返回 401：Railway API_SERVER_KEY 与 Worker HERMES_API_KEY 须完全一致（纯 ASCII）"
        : hermesAuth.httpStatus === 404 && (hermesAuth.probeUrl || "").includes("/api/v1")
          ? "误探测 /api/v1/models（8642 请用 /v1/models）；若本地 runs 已通，请 wrangler secret put HERMES_API_KEY 后 deploy"
          : hermesAuth.bodyPreview || "Hermes 鉴权探测失败",
    hermesRunsOk: hermesRuns.ok,
    hermesRunsHttpStatus: hermesRuns.httpStatus,
    hermesRunsProbeUrl: hermesRuns.probeUrl || null,
    hermesRunsHint: hermesRuns.ok
      ? "POST /v1/runs 可用"
      : hermesRuns.httpStatus === 401
        ? "Runs 401：请 npx.cmd wrangler secret put HERMES_API_KEY（与 Railway API_SERVER_KEY 相同）"
        : hermesAuth.ok
          ? `models 通但 runs 失败（HTTP ${hermesRuns.httpStatus}）：${hermesRuns.bodyPreview}`
          : `Runs 探测失败（HTTP ${hermesRuns.httpStatus}）：${hermesRuns.bodyPreview || "见 hermesAuthHint"}`,
    hermesChatUrl: hermes ? hermesChatCompletionsUrl(hermes) : null,
    apiRoot: apiRoot || null,
    origin: env.ALLOWED_ORIGIN || GITHUB_PAGES_ORIGIN,
  });
}

async function handleCitations(projectId: string): Promise<Response> {
  const slots = getCitationSlots(projectId);
  return json({
    projectId,
    slots,
    map: citationMapFromSlots(slots),
  });
}

async function handleListFiles(
  env: Env,
  projectId: string,
  userId: string,
): Promise<Response> {
  type Row = {
    id: string;
    filename: string;
    scope: string;
    conversation_id: string | null;
    mime: string | null;
    created_at: string;
    chunk_count: number;
    uploaded_by: string | null;
  };
  const { results } = await env.DB.prepare(LIST_FILES_SQL)
    .bind(projectId, userId)
    .all<Row>();

  const files = (results ?? []).map((r) => ({
    id: r.id,
    filename: r.filename,
    scope: r.scope === "session" ? "session" : "package",
    conversationId: r.conversation_id,
    mime: r.mime,
    createdAt: r.created_at,
    uploadedBy: r.uploaded_by,
    chunkCount: Number(r.chunk_count) || 0,
  }));

  return json({
    projectId,
    userId,
    packageScope: "project",
    files,
  });
}

async function handleUpload(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  projectId: string,
): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ error: "缺少 file 字段" }, 400);
  }

  const uploadedBy = normalizeUserId(String(form.get("userId") || ""));
  if (!uploadedBy) {
    return json({ error: "缺少 userId（请登录后上传）" }, 400);
  }

  const scope = String(form.get("scope") || "package");
  const conversationId = form.get("conversationId")
    ? String(form.get("conversationId"))
    : null;
  const docId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-一-龥]/gu, "_");
  const r2Key =
    scope === "session" && conversationId
      ? sessionR2Key(projectId, uploadedBy, conversationId, docId, safeName)
      : packageR2Key(projectId, docId, safeName);

  const mime = file.type || "";
  const bytes = await file.arrayBuffer();

  await env.FILES.put(r2Key, bytes, {
    httpMetadata: { contentType: mime || "application/octet-stream" },
  });

  const isText =
    mime.startsWith("text/") ||
    safeName.endsWith(".txt") ||
    safeName.endsWith(".md") ||
    safeName.endsWith(".html") ||
    safeName.endsWith(".htm");
  const isPdf = mime === "application/pdf" || safeName.endsWith(".pdf");
  const isSpreadsheet =
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel" ||
    safeName.endsWith(".xlsx") ||
    safeName.endsWith(".xls");

  let text = "";
  let pdfWarning: string | undefined;
  let parsed = isText || isPdf || isSpreadsheet;

  if (isText) {
    text = new TextDecoder().decode(bytes);
  } else if (isPdf) {
    const extracted = await extractPdfPlainText(bytes, file.name);
    pdfWarning = extracted.warning;
    if (extracted.parsed && extracted.text) {
      text = extracted.text;
    } else {
      parsed = false;
      text = `（已上传 PDF：${file.name}。${extracted.warning ?? "未能提取正文"}）`;
    }
  } else if (isSpreadsheet) {
    const extracted = await extractSpreadsheetPlainText(bytes, file.name);
    pdfWarning = extracted.warning;
    if (extracted.parsed && extracted.text) {
      text = extracted.text;
    } else {
      parsed = false;
      text = `（已上传 Excel：${file.name}。${extracted.warning ?? "未能提取表格正文"}）`;
    }
  } else {
    parsed = false;
    text = `（已上传文件：${file.name}，类型 ${mime || "未知"}，暂未解析正文。）`;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO documents (id, project_id, conversation_id, filename, r2_key, mime, scope, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      docId,
      projectId,
      conversationId,
      file.name,
      r2Key,
      mime,
      scope === "session" ? "session" : "package",
      uploadedBy,
      now,
    )
    .run();

  const parts = chunkPlainText(text);
  for (let i = 0; i < parts.length; i++) {
    await env.DB.prepare(
      `INSERT INTO chunks (id, document_id, chunk_index, text) VALUES (?, ?, ?, ?)`,
    )
      .bind(`${docId}-${i}`, docId, i, parts[i])
      .run();
  }

  await invalidateChunkCache(
    projectId,
    uploadedBy,
    scope === "session" ? conversationId ?? undefined : undefined,
  );

  if (parsed && parts.length > 0) {
    ctx.waitUntil(embedDocumentChunks(env, docId));
  }

  return json({
    ok: true,
    documentId: docId,
    filename: file.name,
    r2Key,
    chunks: parts.length,
    parsed,
    pdfWarning: pdfWarning ?? null,
  });
}

async function callChatCompletions(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  label: string,
): Promise<{ answer: string; raw: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  const rawText = await res.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    if (/<!doctype html/i.test(rawText)) {
      throw new Error(
        `${label} 返回了网页而非 API。请检查服务地址（Railway 常见误指 Dashboard 9119）。`,
      );
    }
    throw new Error(`${label} 返回非 JSON（HTTP ${res.status}）`);
  }

  if (!res.ok) {
    const err =
      (raw.error as { message?: string } | undefined)?.message ||
      (raw.detail as string) ||
      (raw.message as string) ||
      `${label} HTTP ${res.status}`;
    throw new Error(String(err));
  }

  const choice = raw.choices as { message?: { content?: string } }[] | undefined;
  const answer =
    choice?.[0]?.message?.content?.trim() ||
    (raw.answer as string) ||
    (raw.output as string) ||
    "";

  return { answer: answer || "模型未返回正文。", raw };
}

async function callQwen(env: Env, messages: { role: string; content: string }[]) {
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  const model = (env.HERMES_MODEL || "qwen-plus").trim();
  const base = (
    env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
  )
    .trim()
    .replace(/\/$/, "");
  if (!key) {
    throw new Error("未配置 DASHSCOPE_API_KEY");
  }
  return callChatCompletions(`${base}/chat/completions`, key, model, messages, "千问");
}

async function callHermes(env: Env, messages: { role: string; content: string }[]) {
  const rawBase = (env.HERMES_BASE_URL || "").trim();
  const key = normalizeHermesApiKey(env.HERMES_API_KEY);
  const model = (env.HERMES_MODEL || "qwen-plus").trim();
  if (!rawBase || !key) {
    throw new Error("HERMES_BASE_URL 或 HERMES_API_KEY 未配置");
  }
  assertValidHermesBaseUrl(rawBase);
  const urls = listHermesChatCompletionsUrls(rawBase);
  let lastErr = "Hermes chat 不可用";
  for (const url of urls) {
    try {
      return await callChatCompletions(url, key, model, messages, "Hermes");
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (/401|403|404|405/u.test(lastErr)) continue;
      throw e;
    }
  }
  throw new Error(lastErr);
}

function isHermesAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("unauthorized") ||
    m.includes("invalid api key") ||
    m.includes("authentication") ||
    /\b401\b/.test(m) ||
    /\b403\b/.test(m)
  );
}

/** Hermes 已接通但上游模型 URL/密钥未配好时，可降级千问 */
function isHermesUpstreamMisconfigError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("invalid url") ||
    m.includes("undefined") ||
    m.includes("返回了网页") ||
    m.includes("enotfound") ||
    m.includes("fetch failed")
  );
}

function shouldFallbackToDashscope(hermesErrorMessage: string): boolean {
  return isHermesAuthError(hermesErrorMessage) || isHermesUpstreamMisconfigError(hermesErrorMessage);
}

async function callLlm(
  env: Env,
  messages: { role: string; content: string }[],
): Promise<{ answer: string; raw: unknown; llmBackend: string }> {
  const dashscopeReady = Boolean((env.DASHSCOPE_API_KEY || "").trim());

  if (isHermesAgentConfigured(env)) {
    try {
      const result = await callHermes(env, messages);
      return { ...result, llmBackend: "hermes-chat" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (dashscopeReady && shouldFallbackToDashscope(msg)) {
        const result = await callQwen(env, messages);
        return { ...result, llmBackend: "dashscope-fallback" };
      }
      throw e;
    }
  }

  if (dashscopeReady) {
    const result = await callQwen(env, messages);
    return { ...result, llmBackend: "dashscope" };
  }

  throw new Error("未配置 HERMES_BASE_URL/HERMES_API_KEY，也未配置 DASHSCOPE_API_KEY");
}

async function streamLlm(
  env: Env,
  messages: { role: string; content: string }[],
  meta: Record<string, unknown>,
  onDone?: (fullAnswer: string) => void,
): Promise<ReadableStream<Uint8Array>> {
  const dashscopeReady = Boolean((env.DASHSCOPE_API_KEY || "").trim());
  const model = (env.HERMES_MODEL || "qwen-plus").trim();

  if (isHermesAgentConfigured(env)) {
    const rawBase = (env.HERMES_BASE_URL || "").trim();
    const key = normalizeHermesApiKey(env.HERMES_API_KEY);
    if (rawBase && key) {
      assertValidHermesBaseUrl(rawBase);
      const urls = listHermesChatCompletionsUrls(rawBase);
      let lastErr = "Hermes 流式不可用";
      for (const url of urls) {
        try {
          const upstream = await fetchChatCompletionsStream(
            url,
            key,
            model,
            messages,
            "Hermes",
          );
          return transformOpenAiStreamToJfo(
            upstream,
            { ...meta, llmBackend: "hermes-chat-stream" },
            onDone,
          );
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (dashscopeReady && shouldFallbackToDashscope(lastErr)) break;
          if (/401|403|404|405/u.test(lastErr)) continue;
          throw e;
        }
      }
      if (!dashscopeReady) throw new Error(lastErr);
    }
  }

  if (dashscopeReady) {
    const key = (env.DASHSCOPE_API_KEY || "").trim();
    const base = (
      env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
      .trim()
      .replace(/\/$/, "");
    const upstream = await fetchChatCompletionsStream(
      `${base}/chat/completions`,
      key,
      model,
      messages,
      "千问",
    );
    return transformOpenAiStreamToJfo(
      upstream,
      { ...meta, llmBackend: "dashscope-stream" },
      onDone,
    );
  }

  throw new Error("未配置流式 LLM");
}

/** 获取 OpenAI 兼容原始 SSE（供 buildChatPipelineStream 包装） */
async function fetchLlmUpstream(
  env: Env,
  messages: { role: string; content: string }[],
): Promise<{ upstream: ReadableStream<Uint8Array>; llmBackend: string }> {
  const dashscopeReady = Boolean((env.DASHSCOPE_API_KEY || "").trim());
  const model = (env.HERMES_MODEL || "qwen-plus").trim();

  if (isHermesAgentConfigured(env)) {
    const rawBase = (env.HERMES_BASE_URL || "").trim();
    const key = normalizeHermesApiKey(env.HERMES_API_KEY);
    if (rawBase && key) {
      assertValidHermesBaseUrl(rawBase);
      const urls = listHermesChatCompletionsUrls(rawBase);
      let lastErr = "Hermes 流式不可用";
      for (const url of urls) {
        try {
          const upstream = await fetchChatCompletionsStream(url, key, model, messages, "Hermes");
          return { upstream, llmBackend: "hermes-chat-stream" };
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          if (dashscopeReady && shouldFallbackToDashscope(lastErr)) break;
          if (/401|403|404|405/u.test(lastErr)) continue;
          throw e;
        }
      }
      if (!dashscopeReady) throw new Error(lastErr);
    }
  }

  if (dashscopeReady) {
    const key = (env.DASHSCOPE_API_KEY || "").trim();
    const base = (
      env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
      .trim()
      .replace(/\/$/, "");
    const upstream = await fetchChatCompletionsStream(
      `${base}/chat/completions`,
      key,
      model,
      messages,
      "千问",
    );
    return { upstream, llmBackend: "dashscope-stream" };
  }

  throw new Error("未配置流式 LLM");
}

async function processHermesJobBackground(
  env: Env,
  jobId: string,
  runId: string,
  intent: SkillIntent,
): Promise<void> {
  try {
    const maxWaitMs = intent === "knowledge_network" ? 18 * 60_000 : 10 * 60_000;
    const result = await waitForHermesRun(env, runId, {
      maxWaitMs,
      pollIntervalMs: 3000,
    });
    if (result.status === "completed") {
      const finalized = finalizeHermesOutput(result.output, intent);
      await completeAgentJob(env, jobId, finalized);
      return;
    }
    await failAgentJob(env, jobId, result.error || `Hermes 任务结束：${result.status}`);
  } catch (e) {
    await failAgentJob(env, jobId, e instanceof Error ? e.message : String(e));
  }
}

/** Railway 公网未开放 POST /v1/runs 时，用 Hermes chat/completions 跑深度任务（无 tool 进度） */
async function processHermesJobViaChat(
  env: Env,
  jobId: string,
  intent: SkillIntent,
  params: {
    message: string;
    history: { role: string; content: string }[];
    instructions: string;
  },
): Promise<void> {
  try {
    const messages = [
      { role: "system", content: params.instructions },
      ...params.history.slice(-12),
      { role: "user", content: params.message },
    ];
    const { answer } = await callHermes(env, messages);
    const finalized = finalizeHermesOutput(answer, intent);
    await completeAgentJob(env, jobId, finalized);
  } catch (e) {
    await failAgentJob(env, jobId, e instanceof Error ? e.message : String(e));
  }
}

async function handleChatViaHermes(
  env: Env,
  ctx: ExecutionContext,
  params: {
    projectId: string;
    userId: string;
    conversationId?: string;
    message: string;
    history: { role: string; content: string }[];
    chatMode: SkillIntent;
    citationMap: Record<string, string>;
    projectTitleHint: string;
    files?: string[];
  },
): Promise<Response> {
  if (params.chatMode === "knowledge_network") {
    const gate = checkKnowledgeNetworkPipelineReady(env);
    if (!gate.ok) {
      return json(
        {
          error: gate.error,
          answer: gate.error,
          citationMap: params.citationMap,
          projectId: params.projectId,
          async: false,
          chatMode: params.chatMode,
          skillIntent: params.chatMode,
        },
        503,
      );
    }
  }

  const jobId = crypto.randomUUID();
  try {
    await createAgentJob(env, {
      id: jobId,
      projectId: params.projectId,
      userId: params.userId,
      conversationId: params.conversationId,
      skillIntent: params.chatMode,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const missingTable = /no such table:\s*agent_jobs/i.test(msg);
    return json(
      {
        error: missingTable
          ? "agent_jobs 表未创建。请在 api-worker 目录执行：npx wrangler d1 execute jfo-meta --remote --file=./migrations/0004_agent_jobs.sql"
          : `无法创建异步任务：${msg}`,
        answer: missingTable
          ? "深度分析暂不可用：数据库未迁移。请联系管理员执行 D1 迁移（agent_jobs 表）后重试。"
          : `深度分析启动失败：${msg}`,
        citationMap: params.citationMap,
        projectId: params.projectId,
        async: false,
      },
      missingTable ? 503 : 500,
    );
  }

  const sessionId = `jfo-${params.projectId}-${params.conversationId || "default"}`;
  let instructions = buildHermesAgentInstructions(
    env,
    params.chatMode,
    params.projectId,
    params.projectTitleHint,
    {
      userId: params.userId,
      conversationId: params.conversationId,
      jobId,
      userMessage: params.message,
    },
  );

  if (params.chatMode === "knowledge_network") {
    try {
      const knMode = detectKnowledgeNetworkUpdateMode(params.message);
      const existingMeta = await getProjectKnowledgeNetworkMeta(env, params.projectId);
      instructions += buildKnowledgeNetworkModeInstructions(
        knMode,
        Boolean(existingMeta),
      );
    } catch {
      /* 无表时仍依赖 Hermes 文件回路说明 */
    }
  }

  if (usesFullPackageCorpus(params.chatMode)) {
    try {
      const digest = await buildHermesMaterialsDigest(
        env,
        params.projectId,
        params.userId,
        params.conversationId,
        params.message,
        params.files,
      );
      if (digest) instructions += digest;
    } catch {
      /* D1 未就绪时仍依赖 Hermes jfo-r2-materials */
    }
  }

  const { runId, error } = await startHermesRun(env, {
    userMessage: params.message,
    sessionId,
    instructions,
    history: params.history,
  });

  if (error || !runId) {
    const fallbackId = `chat-fallback-${jobId}`;
    await markAgentJobRunning(env, jobId, fallbackId);
    ctx.waitUntil(
      processHermesJobViaChat(env, jobId, params.chatMode, {
        message: params.message,
        history: params.history,
        instructions,
      }),
    );
    return json({
      async: true,
      jobId,
      assistantMessageId: `assistant-job-${jobId}`,
      status: "running",
      answer:
        "已提交深度分析。引擎走长对话兼容模式（Runs 未启动时自动降级），通常 3～10 分钟；下方会显示实时进度。",
      citationMap: params.citationMap,
      projectId: params.projectId,
      chatMode: params.chatMode,
      skillIntent: params.chatMode,
      hermesRunId: fallbackId,
      deepPath: "hermes-chat-fallback",
    });
  }

  await markAgentJobRunning(env, jobId, runId);
  ctx.waitUntil(processHermesJobBackground(env, jobId, runId, params.chatMode));

  return json({
    async: true,
    jobId,
    assistantMessageId: `assistant-job-${jobId}`,
    status: "running",
    answer:
      "已提交深度分析任务，正在由后台引擎处理（通常 1～5 分钟）。下方会显示实时进度，完成后自动更新。",
    citationMap: params.citationMap,
    projectId: params.projectId,
    chatMode: params.chatMode,
    skillIntent: params.chatMode,
    hermesRunId: runId,
    deepPath: "hermes-runs",
  });
}

function formatJobElapsedLabel(elapsedSec: number): string {
  if (elapsedSec < 60) return `${elapsedSec} 秒`;
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

function buildAgentJobProgressLabel(
  row: {
    status: string;
    hermes_run_id: string | null;
    created_at: string;
  },
  hermesStatus: string | null,
): string {
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(row.created_at)) / 1000),
  );
  const waited = formatJobElapsedLabel(elapsedSec);
  if (row.status === "pending") return `任务排队中（已等待 ${waited}）`;
  const runId = row.hermes_run_id || "";
  if (runId.startsWith("chat-fallback-")) {
    return `长对话生成中（已等待 ${waited}，兼容模式）`;
  }
  const hs = (hermesStatus || "").toLowerCase();
  if (hs === "queued") return `已排队，等待引擎启动（已等待 ${waited}）`;
  if (hs === "running" || hs === "started") return `引擎执行中（已等待 ${waited}）`;
  if (hs === "waiting_for_approval") {
    return `已自动放行工具命令，引擎继续执行（已等待 ${waited}）`;
  }
  if (hs === "completed") return `引擎已完成，正在写入对话结果（已等待 ${waited}）`;
  if (hs === "failed" || hs === "cancelled") return `引擎已结束：${hs}（已等待 ${waited}）`;
  if (hs) return `后台处理中 · ${hs}（已等待 ${waited}）`;
  return `后台处理中（已等待 ${waited}）`;
}

/** Worker waitUntil 可能先于 Hermes 结束；轮询时发现 Run 已终态则回写 D1 */
async function syncAgentJobFromHermesRun(env: Env, row: AgentJobRow): Promise<{
  row: AgentJobRow;
  hermesStatus: string | null;
}> {
  const runId = row.hermes_run_id || "";
  if (
    (row.status !== "running" && row.status !== "pending") ||
    !runId ||
    runId.startsWith("chat-fallback-") ||
    !isHermesAgentConfigured(env)
  ) {
    return { row, hermesStatus: null };
  }

  try {
    const snap = await pollHermesRun(env, runId);
    const hermesStatus = snap.status;
    const terminal = new Set(["completed", "failed", "cancelled"]);
    if (!terminal.has(snap.status)) {
      return { row, hermesStatus };
    }

    const intent = row.skill_intent as SkillIntent;
    if (snap.status === "completed") {
      const finalized = finalizeHermesOutput(snap.output, intent);
      await completeAgentJob(env, row.id, finalized);
    } else {
      await failAgentJob(
        env,
        row.id,
        snap.error || `Hermes 任务结束：${snap.status}`,
      );
    }
    const updated = await getAgentJob(env, row.id, row.user_id);
    return { row: updated ?? row, hermesStatus };
  } catch {
    return { row, hermesStatus: null };
  }
}

async function handleAgentJobPoll(
  env: Env,
  jobId: string,
  userId: string,
): Promise<Response> {
  let row = await getAgentJob(env, jobId, userId);
  if (!row) return json({ error: "任务不存在或无权访问" }, 404);

  const synced = await syncAgentJobFromHermesRun(env, row);
  row = synced.row;
  const hermesStatus = synced.hermesStatus;

  const runId = row.hermes_run_id || "";
  const deepPath = runId.startsWith("chat-fallback-")
    ? "hermes-chat-fallback"
    : runId
      ? "hermes-runs"
      : null;
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(row.created_at)) / 1000),
  );

  const progressLabel =
    row.status === "completed"
      ? "已完成"
      : row.status === "failed"
        ? "失败"
        : buildAgentJobProgressLabel(row, hermesStatus);

  let projectKnowledgeNetworkVersion: number | undefined;
  if (
    row.status === "completed" &&
    row.skill_intent === "knowledge_network" &&
    row.knowledge_network_html
  ) {
    try {
      const knMeta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
      if (knMeta) projectKnowledgeNetworkVersion = knMeta.version;
    } catch {
      /* 忽略 */
    }
  }

  return json({
    jobId: row.id,
    status: row.status,
    answer: row.answer,
    knowledgeNetworkHtml: row.knowledge_network_html,
    projectKnowledgeNetworkVersion,
    error: row.error,
    skillIntent: row.skill_intent,
    projectId: row.project_id,
    hermesRunId: row.hermes_run_id,
    updatedAt: row.updated_at,
    elapsedSec,
    hermesStatus,
    deepPath,
    progressLabel,
  });
}

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = (await request.json()) as ChatBody;
  const projectId = body.projectId?.trim();
  const message = body.message?.trim();

  if (!projectId || !message) {
    return json({ error: "projectId 与 message 必填" }, 400);
  }

  const userId = normalizeUserId(body.userId);
  if (!userId) {
    return json({ error: "userId 必填（请登录后对话）" }, 400);
  }

  const slots = getCitationSlots(projectId);
  const citationMap = citationMapFromSlots(slots);
  const chatMode: SkillIntent = detectSkillIntent(message);
  let projectTitleHint =
    projectId === "nn-fresh-port" ? "南宁东盟生鲜食品智慧港" : projectId;
  let dbProjectSummary = "";
  try {
    const dbProject = await getDbProjectById(env, projectId);
    if (dbProject?.name) projectTitleHint = dbProject.name;
    if (dbProject?.summary) {
      dbProjectSummary = `【项目登记信息】\n项目名称：${dbProject.name}\n阶段：${dbProject.phase}\n简介：${dbProject.summary}\n\n`;
    }
  } catch {
    /* D1 未就绪时忽略 */
  }

  const history = (body.history ?? []).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  if (shouldRouteToHermes(chatMode) && isHermesAgentConfigured(env)) {
    return handleChatViaHermes(env, ctx, {
      projectId,
      userId,
      conversationId: body.conversationId,
      message,
      history,
      chatMode,
      citationMap,
      projectTitleHint,
      files: body.files,
    });
  }

  const deepMode =
    !isHermesAgentConfigured(env) && usesFullPackageCorpus(chatMode);
  const overviewQuestion = isGenericProjectQuestion(message);
  const injectPackageCorpus = deepMode || overviewQuestion;
  const tavilyConfigured = Boolean((env.TAVILY_API_KEY || "").trim());
  const conversationKey = (body.conversationId ?? "").trim();
  const wantStream = body.stream !== false;
  const firstUserTurn = isFirstUserTurnInHistory(history);

  const contextParams = {
    env,
    projectId,
    userId,
    conversationId: body.conversationId,
    message,
    files: body.files,
    history,
    chatMode,
    deepMode,
    overviewQuestion,
    injectPackageCorpus,
    dbProjectSummary,
    projectTitleHint,
    hermesConfigured: isHermesAgentConfigured(env),
    tavilyConfigured,
  };

  const scheduleMemoryRefresh = (assistantAnswer: string) => {
    const fullHistory = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: assistantAnswer },
    ];
    ctx.waitUntil(
      refreshConversationMemorySummary(env, userId, conversationKey, fullHistory, async (prompt) => {
        const { answer } = await callQwen(env, [
          { role: "system", content: "你是简洁的对话摘要助手。" },
          { role: "user", content: prompt },
        ]);
        return answer;
      }),
    );
  };

  try {
    if (wantStream) {
      const stream = buildChatPipelineStream(async (emitStatus) => {
        const topicPromise = firstUserTurn
          ? generateConversationTopic(env, message)
          : null;
        const prepared = await prepareStandardChatContext({
          ...contextParams,
          onStatus: emitStatus,
        });
        emitStatus(CHAT_STATUS.generating);
        const [conversationTopic, llm] = await Promise.all([
          topicPromise,
          fetchLlmUpstream(env, prepared.messages),
        ]);
        const { upstream, llmBackend } = llm;
        return {
          meta: {
            ...prepared.streamMeta,
            llmBackend,
            ...(conversationTopic ? { conversationTopic } : {}),
          },
          upstream,
          onDone: (answer) => scheduleMemoryRefresh(answer),
        };
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const prepared = await prepareStandardChatContext(contextParams);
    const [conversationTopic, llmResult] = await Promise.all([
      firstUserTurn ? generateConversationTopic(env, message) : Promise.resolve(undefined),
      callLlm(env, prepared.messages),
    ]);
    const { answer, llmBackend } = llmResult;
    scheduleMemoryRefresh(answer);
    return json({
      answer,
      citationMap: prepared.streamMeta.citationMap as Record<string, string>,
      projectId,
      externalSearch: prepared.usedExternalSearch,
      chatMode,
      skillIntent: chatMode,
      llmBackend,
      ...(conversationTopic ? { conversationTopic } : {}),
      ...(chatMode === "knowledge_network"
        ? {
            knowledgeNetworkHtml: null,
            note: "知识网络须走 Hermes 深度任务与 PUT 文件回路，轻问路径不写入项目 KB。",
          }
        : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (wantStream) {
      return new Response(jfoSseError(`AI 服务暂不可用：${msg}`), {
        status: 502,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }
    return json({ answer: `AI 服务暂不可用：${msg}`, citationMap, projectId }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/u, "") || "/";

    try {
      let response: Response;

      if (
        (path === "/api/health" || path === "/health") &&
        request.method === "GET"
      ) {
        response = await handleHealth(env);
      } else if (path === "/" && request.method === "GET") {
        response = json({
          ok: true,
          service: "jfo-api",
          health: "/api/health",
          hint: "家办 API 运行中；健康检查请访问 GET /api/health",
        });
      } else if (path.startsWith("/api/hermes")) {
        const hermesRes = await tryHandleHermesRoutes(request, env, path);
        response = hermesRes ?? json({ error: "Not Found" }, 404);
      } else if (path === "/api/projects" && request.method === "GET") {
        response = await handleListProjects(env);
      } else if (path === "/api/projects" && request.method === "POST") {
        response = await handleCreateProject(request, env);
      } else if (/^\/api\/projects\/[^/]+$/u.test(path)) {
        const pathProjectId = decodePathProjectId(path.split("/")[3] ?? "");
        if (request.method === "GET") {
          response = await handleGetProject(
            env,
            pathProjectId,
            url.searchParams.get("projectId"),
          );
        } else if (request.method === "PATCH" || request.method === "PUT") {
          response = await handleUpdateProject(request, env, pathProjectId);
        } else if (request.method === "DELETE") {
          response = await handleDeleteProject(request, env, pathProjectId);
        } else {
          response = json({ error: "Method Not Allowed" }, 405);
        }
      } else if (
        /^\/api\/projects\/[^/]+\/knowledge-network\/versions\/(\d+)$/u.test(path) &&
        request.method === "GET"
      ) {
        const projectId = decodePathProjectId(path.split("/")[3] ?? "");
        const version = Number(path.split("/")[5] ?? "0");
        response = await handleGetProjectKnowledgeNetworkVersion(
          env,
          projectId,
          version,
          url.searchParams.get("userId"),
        );
      } else if (
        /^\/api\/projects\/[^/]+\/knowledge-network$/u.test(path) &&
        request.method === "GET"
      ) {
        const projectId = decodePathProjectId(path.split("/")[3] ?? "");
        const htmlParam = (url.searchParams.get("html") ?? "1").trim();
        const includeHtml = htmlParam !== "0" && htmlParam !== "false";
        response = await handleGetProjectKnowledgeNetwork(
          env,
          projectId,
          url.searchParams.get("userId"),
          includeHtml,
        );
      } else if (path === "/api/admin/project-knowledge-network/backfill" && request.method === "POST") {
        response = await handleBackfillProjectKnowledgeNetworks(request, env, url);
      } else if (
        /^\/api\/projects\/[^/]+\/citations$/u.test(path) &&
        request.method === "GET"
      ) {
        const projectId = decodePathProjectId(path.split("/")[3] ?? "");
        response = await handleCitations(projectId);
      } else if (/^\/api\/projects\/[^/]+\/files\/[^/]+$/u.test(path)) {
        const projectId = decodePathProjectId(path.split("/")[3] ?? "");
        const docId = path.split("/")[5] ?? "";
        if (request.method === "DELETE") {
          response = await handleDeleteProjectFile(request, env, projectId, docId);
        } else {
          response = json({ error: "Method Not Allowed" }, 405);
        }
      } else if (/^\/api\/projects\/[^/]+\/files$/u.test(path)) {
        const projectId = decodePathProjectId(path.split("/")[3] ?? "");
        if (request.method === "GET") {
          const uid = normalizeUserId(url.searchParams.get("userId"));
          if (!uid) {
            response = json({ error: "缺少 userId 查询参数" }, 400);
          } else {
            response = await handleListFiles(env, projectId, uid);
          }
        } else if (request.method === "POST") {
          response = await handleUpload(request, env, ctx, projectId);
        } else {
          response = json({ error: "Method Not Allowed" }, 405);
        }
      } else if (path === "/api/chat" && request.method === "POST") {
        response = await handleChat(request, env, ctx);
      } else if (/^\/api\/agent-jobs\/[^/]+$/u.test(path) && request.method === "GET") {
        const jobId = path.split("/")[3];
        const uid = normalizeUserId(url.searchParams.get("userId"));
        if (!uid) {
          response = json({ error: "缺少 userId 查询参数" }, 400);
        } else {
          response = await handleAgentJobPoll(env, jobId, uid);
        }
      } else if (
        /^\/api\/users\/[^/]+\/active-agent-jobs$/u.test(path) &&
        request.method === "GET"
      ) {
        const routeUserId = normalizeUserId(path.split("/")[3]);
        if (!routeUserId) {
          response = json({ error: "无效 userId" }, 400);
        } else {
          response = await handleGetActiveAgentJobs(env, routeUserId);
        }
      } else if (path === "/api/admin/chat-audit" && request.method === "GET") {
        response = await handleGetChatAudit(request, env, url);
      } else if (/^\/api\/users\/[^/]+\/chat-state$/u.test(path)) {
        const routeUserId = normalizeUserId(path.split("/")[3]);
        if (!routeUserId) {
          response = json({ error: "无效 userId" }, 400);
        } else if (request.method === "GET") {
          response = await handleGetChatState(env, routeUserId);
        } else if (request.method === "PUT") {
          const body = (await request.json()) as Parameters<typeof handlePutChatState>[2];
          response = await handlePutChatState(env, routeUserId, body);
        } else {
          response = json({ error: "Method Not Allowed" }, 405);
        }
      } else {
        response = json({ error: "Not Found" }, 404);
      }

      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: msg }, 500, cors);
    }
  },
};
