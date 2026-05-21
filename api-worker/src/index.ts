import {
  buildCitationSystemLines,
  citationMapFromSlots,
  getCitationSlots,
} from "./citations";
import { chunkPlainText, scoreChunks, type ChunkRow } from "./search";

export interface Env {
  FILES: R2Bucket;
  DB: D1Database;
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
  HERMES_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

type ChatBody = {
  projectId?: string;
  conversationId?: string;
  userId?: string;
  role?: string;
  message?: string;
  history?: { role: string; content: string }[];
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

async function loadChunks(
  env: Env,
  projectId: string,
  conversationId?: string,
): Promise<ChunkRow[]> {
  const sql = `
    SELECT c.id, c.document_id, c.chunk_index, c.text, d.filename
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.project_id = ?
      AND (d.scope = 'package' OR (d.scope = 'session' AND d.conversation_id = ?))
    ORDER BY c.document_id, c.chunk_index
    LIMIT 500
  `;
  const { results } = await env.DB.prepare(sql)
    .bind(projectId, conversationId ?? "")
    .all<ChunkRow>();
  return results ?? [];
}

async function handleHealth(env: Env): Promise<Response> {
  const hermes = (env.HERMES_BASE_URL || "").trim();
  return json({
    ok: true,
    service: "jfo-api",
    hermesConfigured: Boolean(hermes),
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

  const scope = String(form.get("scope") || "package");
  const conversationId = form.get("conversationId")
    ? String(form.get("conversationId"))
    : null;
  const docId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-一-龥]/gu, "_");
  const prefix =
    scope === "session" && conversationId
      ? `projects/${projectId}/sessions/${conversationId}`
      : `projects/${projectId}/package`;
  const r2Key = `${prefix}/${docId}-${safeName}`;

  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const mime = file.type || "";
  const isText =
    mime.startsWith("text/") ||
    safeName.endsWith(".txt") ||
    safeName.endsWith(".md");

  let text = "";
  if (isText) {
    text = await file.text();
  } else if (safeName.endsWith(".pdf")) {
    text = `（已上传 PDF：${file.name}。当前 MVP 未在云端解析 PDF，请补充同内容的 .txt/.md 以便检索与引用。）`;
  } else {
    text = `（已上传文件：${file.name}，类型 ${mime || "未知"}，暂未解析正文。）`;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO documents (id, project_id, conversation_id, filename, r2_key, mime, scope, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      docId,
      projectId,
      conversationId,
      file.name,
      r2Key,
      mime,
      scope === "session" ? "session" : "package",
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
    parsed: isText || safeName.endsWith(".pdf"),
  });
}

async function callHermes(
  env: Env,
  messages: { role: string; content: string }[],
): Promise<{ answer: string; raw: unknown }> {
  const base = (env.HERMES_BASE_URL || "").trim().replace(/\/$/, "");
  const key = (env.HERMES_API_KEY || "").trim();
  const model = (env.HERMES_MODEL || "qwen-plus").trim();

  if (!base || !key) {
    throw new Error("HERMES_BASE_URL 或 HERMES_API_KEY 未配置");
  }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      (raw.error as { message?: string } | undefined)?.message ||
      (raw.message as string) ||
      `Hermes HTTP ${res.status}`;
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

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ChatBody;
  const projectId = body.projectId?.trim();
  const message = body.message?.trim();

  if (!projectId || !message) {
    return json({ error: "projectId 与 message 必填" }, 400);
  }

  const slots = getCitationSlots(projectId);
  const citationMap = citationMapFromSlots(slots);
  const citationLines = buildCitationSystemLines(slots);

  let excerptBlock = "（未检索到资料摘录；请明确说明依据不足，勿编造。）";
  try {
    const allChunks = await loadChunks(env, projectId, body.conversationId);
    const hits = scoreChunks(allChunks, message, 6);
    if (hits.length > 0) {
      excerptBlock = hits
        .map((h, idx) => {
          const slotHint = slots[idx]?.id ? `[ID:${slots[idx].id}]` : "";
          return `${slotHint} 文件：${h.filename ?? "资料"}\n${h.text}`;
        })
        .join("\n\n---\n\n");
    }
  } catch {
    /* D1 未初始化时仍可调 Hermes */
  }

  const systemParts = [
    "你是联合家办平台项目助手。仅依据【资料摘录】回答；无依据须说明。",
    "引用必须使用 [ID:n] 格式，n 只能使用下列编号：",
    citationLines,
    "",
    "【资料摘录】",
    excerptBlock,
  ];

  const history = (body.history ?? []).filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const messages = [
    { role: "system", content: systemParts.join("\n") },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const { answer } = await callHermes(env, messages);
    return json({
      answer,
      citationMap,
      projectId,
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
      } else if (
        /^\/api\/projects\/[^/]+\/files$/u.test(path) &&
        request.method === "POST"
      ) {
        const projectId = path.split("/")[3];
        response = await handleUpload(request, env, projectId);
      } else if (path === "/api/chat" && request.method === "POST") {
        response = await handleChat(request, env);
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
