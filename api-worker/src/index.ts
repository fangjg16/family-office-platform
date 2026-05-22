import {
  buildCitationSystemLines,
  citationMapFromSlots,
  getCitationSlots,
  matchCitationSlot,
} from "./citations";
import { handleGetChatState, handlePutChatState } from "./chat-sync";
import { extractPdfPlainText } from "./pdf-text";
import {
  chunkPlainText,
  isPlaceholderChunkText,
  scoreChunks,
  type ChunkRow,
} from "./search";
import {
  buildTavilyQuery,
  formatTavilyBlock,
  searchTavily,
  tavilyCapabilitySystemLines,
  wantsExternalSearch,
} from "./tavily-search";

export interface Env {
  FILES: R2Bucket;
  DB: D1Database;
  /** 推荐：直连千问，绕过 Railway Hermes 鉴权问题 */
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
  HERMES_MODEL?: string;
  /** 用户说「查外部资料」等时联网检索（与 Railway Hermes 的 Tavily 独立配置） */
  TAVILY_API_KEY?: string;
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
};

const FILE_ONLY_USER_PROMPT =
  /已发送\s*\d+\s*个文件|请基于资料继续|请阅读刚上传/u;

const GITHUB_PAGES_ORIGIN = "https://fangjg16.github.io";

/** Railway 一键模板：公网域名多为 Dashboard(9119)，OpenAI 兼容 API 在 /api/v1/... */
function resolveHermesApiRoot(base: string): string {
  const trimmed = base.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/api")) return trimmed;
  return `${trimmed}/api`;
}

function hermesChatCompletionsUrl(base: string): string {
  return `${resolveHermesApiRoot(base)}/v1/chat/completions`;
}

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = (env.ALLOWED_ORIGIN || GITHUB_PAGES_ORIGIN).trim();
  const ok =
    origin === allowed ||
    origin === `${allowed}/` ||
    origin?.startsWith(`${allowed}/`);
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function loadChunks(
  env: Env,
  projectId: string,
  userId: string,
  conversationId?: string,
): Promise<ChunkRow[]> {
  const sql = `
    SELECT c.id, c.document_id, c.chunk_index, c.text, d.filename
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.project_id = ?
      AND d.uploaded_by = ?
      AND (d.scope = 'package' OR (d.scope = 'session' AND d.conversation_id = ?))
    ORDER BY c.document_id, c.chunk_index
    LIMIT 500
  `;
  const { results } = await env.DB.prepare(sql)
    .bind(projectId, userId, conversationId ?? "")
    .all<ChunkRow>();
  return results ?? [];
}

async function handleHealth(env: Env): Promise<Response> {
  const hermes = (env.HERMES_BASE_URL || "").trim();
  const apiRoot = hermes ? resolveHermesApiRoot(hermes) : "";
  const dashscope = Boolean((env.DASHSCOPE_API_KEY || "").trim());
  const tavily = Boolean((env.TAVILY_API_KEY || "").trim());
  return json({
    ok: true,
    service: "jfo-api",
    llmMode: dashscope ? "dashscope" : hermes && env.HERMES_API_KEY ? "hermes" : "none",
    dashscopeConfigured: dashscope,
    tavilyConfigured: tavily,
    hermesConfigured: Boolean(hermes && env.HERMES_API_KEY),
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
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.filename, d.scope, d.conversation_id, d.mime, d.created_at, d.uploaded_by,
            (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
     FROM documents d
     WHERE d.project_id = ? AND d.uploaded_by = ?
     ORDER BY d.created_at DESC
     LIMIT 200`,
  )
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

  return json({ projectId, userId, files });
}

async function handleUpload(
  request: Request,
  env: Env,
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
  const userRoot = `projects/${projectId}/users/${uploadedBy}`;
  const prefix =
    scope === "session" && conversationId
      ? `${userRoot}/sessions/${conversationId}`
      : `${userRoot}/package`;
  const r2Key = `${prefix}/${docId}-${safeName}`;

  const mime = file.type || "";
  const bytes = await file.arrayBuffer();

  await env.FILES.put(r2Key, bytes, {
    httpMetadata: { contentType: mime || "application/octet-stream" },
  });

  const isText =
    mime.startsWith("text/") ||
    safeName.endsWith(".txt") ||
    safeName.endsWith(".md");
  const isPdf = mime === "application/pdf" || safeName.endsWith(".pdf");

  let text = "";
  let pdfWarning: string | undefined;
  let parsed = isText || isPdf;

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
  const base = (env.HERMES_BASE_URL || "").trim().replace(/\/$/, "");
  const key = (env.HERMES_API_KEY || "").trim();
  const model = (env.HERMES_MODEL || "qwen-plus").trim();
  if (!base || !key) {
    throw new Error("HERMES_BASE_URL 或 HERMES_API_KEY 未配置");
  }
  return callChatCompletions(hermesChatCompletionsUrl(base), key, model, messages, "Hermes");
}

async function callLlm(env: Env, messages: { role: string; content: string }[]) {
  if ((env.DASHSCOPE_API_KEY || "").trim()) {
    return callQwen(env, messages);
  }
  return callHermes(env, messages);
}

async function handleChat(request: Request, env: Env): Promise<Response> {
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
  const usedSlotIds = new Set<string>();

  let excerptBlock = "（未检索到资料摘录；请明确说明依据不足，勿编造。）";
  try {
    const allChunks = await loadChunks(env, projectId, userId, body.conversationId);
    const fileHint = (body.files ?? []).join(" ");
    const searchQuery = fileHint ? `${message} ${fileHint}` : message;
    let hits = scoreChunks(allChunks, searchQuery, 8);
    if (hits.length === 0 && allChunks.length > 0 && FILE_ONLY_USER_PROMPT.test(message)) {
      hits = allChunks.filter((c) => !isPlaceholderChunkText(c.text)).slice(-8);
      if (hits.length === 0) hits = allChunks.slice(-8);
    }
    if (hits.length > 0) {
      const onlyPlaceholders = hits.every((h) => isPlaceholderChunkText(h.text));
      if (onlyPlaceholders) {
        excerptBlock =
          "（资料文件已上传，但正文未解析成功，多为扫描版 PDF。请改传可复制文字的 PDF 或 .txt/.md，或重新上传后重试。）";
      } else {
        excerptBlock = hits
          .map((h) => {
            const slot = matchCitationSlot(slots, h.filename ?? "");
            if (slot) usedSlotIds.add(slot.id);
            const slotHint = slot ? `[ID:${slot.id}]` : "";
            return `${slotHint} 文件：${h.filename ?? "资料"}\n${h.text}`;
          })
          .join("\n\n---\n\n");
      }
    }
  } catch {
    /* D1 未初始化时仍可调 Hermes */
  }

  let externalBlock = "";
  let usedExternalSearch = false;
  if (wantsExternalSearch(message)) {
    usedExternalSearch = true;
    const fileHint = (body.files ?? []).join(" ");
    const historyForQuery = (body.history ?? []).filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    const tavilyQuery = buildTavilyQuery(message, fileHint, historyForQuery);
    const tavilyKey = (env.TAVILY_API_KEY || "").trim();
    if (!tavilyKey) {
      externalBlock = formatTavilyBlock([], "未配置 TAVILY_API_KEY（请在 Worker 执行 wrangler secret put TAVILY_API_KEY）");
    } else {
      const { hits, error } = await searchTavily(tavilyKey, tavilyQuery);
      externalBlock = formatTavilyBlock(hits, error);
    }
  }

  const activeSlots =
    usedSlotIds.size > 0 ? slots.filter((s) => usedSlotIds.has(s.id)) : slots;
  const citationLines = buildCitationSystemLines(activeSlots);

  const tavilyConfigured = Boolean((env.TAVILY_API_KEY || "").trim());

  const systemParts = [
    "你是联合家办平台项目助手，服务机会型投资尽调场景。回答须综合三类依据：（1）【资料摘录】中的项目内事实；（2）若有【外部检索】则纳入公开网页信息；（3）为衔接上下文的行业/流程推论——须标明「推论」或「待核实」，不得冒充已核实事实。",
    "你不是「只能读上传 PDF」的机器人：项目内问题以摘录为主；公开信息、政策、市场动态在触发联网或摘录不足时，应结合外部检索或明确说明缺口与下一步（如建议用户说「查外部资料：…」）。",
    "用户可能使用项目简称（如「南宁生鲜港」「南宁生鲜智慧港」）；与摘录中「南宁东盟生鲜食品智慧港」等明显同一项目时，应正常作答，勿因简称不同而拒绝。",
    "引用规范：上传资料用 [ID:n]（仅可引用摘录中实际出现且下列存在的编号）；网页用 [WEB:n] 并附 URL；勿混用。",
    "若用户需要系统化公开信息搜集、更新项目知识网络 HTML 或 IC 备忘录，说明该深度工作流在 Hermes 投资智库 skills 中完成，本对话侧重即时问答与对照核实。",
    ...tavilyCapabilitySystemLines(tavilyConfigured),
    "可用引用编号与文献名：",
    citationLines,
    "",
    "【资料摘录】",
    excerptBlock,
  ];

  if (usedExternalSearch) {
    systemParts.push(
      "",
      "【外部检索（Tavily）】",
      externalBlock,
      "",
      "【本轮指令】用户需要公开信息。以【外部检索】为主、与【资料摘录】交叉验证：一致处可加强信心，冲突处分别列出并建议待核项；勿否认本轮已具备的联网结果。",
    );
  }

  const history = (body.history ?? []).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const messages = [
    { role: "system", content: systemParts.join("\n") },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const { answer } = await callLlm(env, messages);
    return json({
      answer,
      citationMap,
      projectId,
      externalSearch: usedExternalSearch,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ answer: `AI 服务暂不可用：${msg}`, citationMap, projectId }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/u, "") || "/";

    try {
      let response: Response;

      if (path === "/api/health" && request.method === "GET") {
        response = await handleHealth(env);
      } else if (
        /^\/api\/projects\/[^/]+\/citations$/u.test(path) &&
        request.method === "GET"
      ) {
        const projectId = path.split("/")[3];
        response = await handleCitations(projectId);
      } else if (/^\/api\/projects\/[^/]+\/files$/u.test(path)) {
        const projectId = path.split("/")[3];
        if (request.method === "GET") {
          const uid = normalizeUserId(url.searchParams.get("userId"));
          if (!uid) {
            response = json({ error: "缺少 userId 查询参数" }, 400);
          } else {
            response = await handleListFiles(env, projectId, uid);
          }
        } else if (request.method === "POST") {
          response = await handleUpload(request, env, projectId);
        } else {
          response = json({ error: "Method Not Allowed" }, 405);
        }
      } else if (path === "/api/chat" && request.method === "POST") {
        response = await handleChat(request, env);
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
