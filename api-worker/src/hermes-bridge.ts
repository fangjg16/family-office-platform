import {
  documentAccessError,
  isPackageScope,
  type DocumentRow,
} from "./documents-access";
import {
  handleHermesGetKnowledgeNetworkCurrent,
  handleHermesPutKnowledgeNetworkCurrent,
} from "./hermes-knowledge-network";
import { isPlaceholderChunkText } from "./search";

export type HermesBridgeEnv = {
  FILES: R2Bucket;
  DB: D1Database;
  JFO_INTERNAL_KEY?: string;
  JFO_API_PUBLIC_BASE?: string;
};

const MAX_TEXT_CHARS = 500_000;

/** 与网站 projects.ts 对齐，仅用于 manifest 展示 */
const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  "nn-fresh-port": "南宁生鲜食品智慧港",
  shrimp: "虾仁项目",
  "natgeo-rwa": "国家地理 RWA",
  "europe-hotel-ma": "欧洲酒店并购",
  "coastal-estate": "滨海庄园",
  "cross-trade": "跨境贸易",
  "digital-portal": "数字门户",
  "ip-invest": "IP 投资",
  "hk-us-equity": "港美股权",
  "energy-ma": "能源并购",
  "med-channel": "医疗渠道",
  "offshore-trust": "离岸信托",
  "edu-ma": "教育并购",
};

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function normalizeUserId(raw: string | null): string | null {
  const id = (raw ?? "").trim();
  return id.length > 0 ? id : null;
}

function publicBaseUrl(request: Request, env: HermesBridgeEnv): string {
  const fromEnv = (env.JFO_API_PUBLIC_BASE || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

/** 401/503 时返回 Response；通过则返回 null */
export function requireHermesAuth(
  request: Request,
  env: HermesBridgeEnv,
): Response | null {
  const expected = (env.JFO_INTERNAL_KEY || "").trim();
  if (!expected) {
    return json(
      {
        detail:
          "服务端未配置 JFO_INTERNAL_KEY，请在 Worker 执行 wrangler secret put JFO_INTERNAL_KEY",
      },
      503,
    );
  }
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) {
    return json({ detail: "Unauthorized" }, 401);
  }
  return null;
}

function buildDocUrls(
  base: string,
  projectId: string,
  documentId: string,
  scope: string,
  userId: string | null,
): { textUrl: string; downloadUrl: string } {
  const prefix = `${base}/api/hermes/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`;
  if (isPackageScope(scope)) {
    return { textUrl: `${prefix}/text`, downloadUrl: `${prefix}/download` };
  }
  const q = `userId=${encodeURIComponent(userId ?? "")}`;
  return {
    textUrl: `${prefix}/text?${q}`,
    downloadUrl: `${prefix}/download?${q}`,
  };
}

export async function handleHermesHealth(): Promise<Response> {
  return json({
    ok: true,
    service: "jfo-hermes-bridge",
    r2Bucket: "jfo-files",
    packageScope: "project",
  });
}

export async function handleHermesManifest(
  request: Request,
  env: HermesBridgeEnv,
  projectId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const userId = normalizeUserId(url.searchParams.get("userId"));
  const scopeParam = (url.searchParams.get("scope") || "package").trim();
  const conversationId = url.searchParams.get("conversationId");

  let scopeSql: "package" | "session" | "all" = "package";
  if (scopeParam === "session") scopeSql = "session";
  else if (scopeParam === "all") scopeSql = "all";

  if ((scopeSql === "session" || scopeSql === "all") && !userId) {
    return json(
      {
        error: "缺少 userId 查询参数",
        hint: "scope=session 或 all 须指定账号；scope=package 仅按项目共享，可不传 userId。",
      },
      400,
    );
  }

  const base = publicBaseUrl(request, env);

  type Row = {
    id: string;
    filename: string;
    scope: string;
    conversation_id: string | null;
    mime: string | null;
    created_at: string;
    uploaded_by: string | null;
    chunk_count: number;
    sample_text: string | null;
  };

  let sql = `
    SELECT d.id, d.filename, d.scope, d.conversation_id, d.mime, d.created_at, d.uploaded_by,
           (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count,
           (SELECT c.text FROM chunks c WHERE c.document_id = d.id AND c.chunk_index = 0 LIMIT 1) AS sample_text
    FROM documents d
    WHERE d.project_id = ?
  `;
  const binds: (string | null)[] = [projectId];

  if (scopeSql === "package") {
    sql += ` AND d.scope = 'package'`;
  } else if (scopeSql === "session") {
    sql += ` AND d.scope = 'session' AND d.uploaded_by = ?`;
    binds.push(userId);
    if (conversationId) {
      sql += ` AND d.conversation_id = ?`;
      binds.push(conversationId);
    }
  } else {
    if (conversationId) {
      sql += ` AND (d.scope = 'package' OR (d.scope = 'session' AND d.uploaded_by = ? AND d.conversation_id = ?))`;
      binds.push(userId, conversationId);
    } else {
      sql += ` AND (d.scope = 'package' OR (d.scope = 'session' AND d.uploaded_by = ?))`;
      binds.push(userId);
    }
  }

  sql += ` ORDER BY d.created_at DESC LIMIT 200`;

  const { results } = await env.DB.prepare(sql).bind(...binds).all<Row>();

  const files = (results ?? []).map((r) => {
    const chunkCount = Number(r.chunk_count) || 0;
    const sample = (r.sample_text ?? "").trim();
    const parsed =
      chunkCount > 0 && sample.length > 0 && !isPlaceholderChunkText(sample);
    const scope = r.scope === "session" ? "session" : "package";
    const urls = buildDocUrls(
      base,
      projectId,
      r.id,
      scope,
      scope === "session" ? userId : null,
    );
    return {
      documentId: r.id,
      filename: r.filename,
      scope,
      conversationId: r.conversation_id,
      mime: r.mime,
      createdAt: r.created_at,
      uploadedBy: r.uploaded_by,
      chunkCount,
      parsed,
      ...urls,
    };
  });

  return json({
    projectId,
    projectName: PROJECT_DISPLAY_NAMES[projectId] ?? projectId,
    userId: userId ?? null,
    scope: scopeParam === "all" ? "all" : scopeSql,
    packageScope: "project",
    syncedAt: new Date().toISOString(),
    files,
    instructions:
      "Hermes：scope=package 为项目共享资料；scope=session 为本对话附件（须带 userId+conversationId）；scope=all 为二者合并。对每个 parsed=true 的文件 GET textUrl 阅读全文。",
  });
}

async function loadDocument(
  env: HermesBridgeEnv,
  projectId: string,
  documentId: string,
  userId: string | null,
): Promise<
  | { ok: true; row: DocumentRow }
  | { ok: false; response: Response }
> {
  const { results } = await env.DB.prepare(
    `SELECT id, filename, mime, r2_key, scope, uploaded_by, conversation_id
     FROM documents
     WHERE id = ? AND project_id = ?`,
  )
    .bind(documentId, projectId)
    .all<DocumentRow>();

  const row = results?.[0];
  if (!row) {
    return {
      ok: false,
      response: json({ error: "文档不存在" }, 404),
    };
  }

  const accessErr = documentAccessError(row, userId);
  if (accessErr) {
    return {
      ok: false,
      response: json(
        {
          error: accessErr,
          hint: isPackageScope(row.scope)
            ? undefined
            : "对话临时文件请在 URL 加 userId=上传者账号",
        },
        accessErr.includes("缺少") ? 400 : 404,
      ),
    };
  }

  return { ok: true, row };
}

export async function handleHermesDocumentText(
  env: HermesBridgeEnv,
  projectId: string,
  documentId: string,
  userId: string | null,
): Promise<Response> {
  const doc = await loadDocument(env, projectId, documentId, userId);
  if (!doc.ok) return doc.response;

  const { results } = await env.DB.prepare(
    `SELECT chunk_index, text FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC`,
  )
    .bind(documentId)
    .all<{ chunk_index: number; text: string }>();

  const parts = (results ?? []).map((r) => r.text);
  let text = parts.join("\n\n");
  const chunkCount = parts.length;
  let truncated = false;

  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
  }

  const parsed =
    chunkCount > 0 &&
    parts.some((p) => p.trim().length > 0 && !isPlaceholderChunkText(p));

  return json({
    projectId,
    documentId,
    filename: doc.row.filename,
    mime: doc.row.mime,
    scope: isPackageScope(doc.row.scope) ? "package" : "session",
    chunkCount,
    parsed,
    text,
    truncated,
    maxChars: MAX_TEXT_CHARS,
  });
}

export async function handleHermesDocumentDownload(
  env: HermesBridgeEnv,
  projectId: string,
  documentId: string,
  userId: string | null,
): Promise<Response> {
  const doc = await loadDocument(env, projectId, documentId, userId);
  if (!doc.ok) return doc.response;

  const object = await env.FILES.get(doc.row.r2_key);
  if (!object) {
    return json({ error: "R2 中找不到文件对象" }, 404);
  }

  const headers = new Headers();
  const mime = doc.row.mime || "application/octet-stream";
  headers.set("Content-Type", mime);
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(doc.row.filename)}"`,
  );

  return new Response(object.body, { status: 200, headers });
}

/**
 * 处理 /api/hermes/* 路由。若不是 Hermes 路径返回 null，由 index 继续路由。
 */
export async function tryHandleHermesRoutes(
  request: Request,
  env: HermesBridgeEnv,
  path: string,
): Promise<Response | null> {
  if (!path.startsWith("/api/hermes")) return null;

  if (path === "/api/hermes/health" && request.method === "GET") {
    const auth = requireHermesAuth(request, env);
    if (auth) return auth;
    return handleHermesHealth();
  }

  const auth = requireHermesAuth(request, env);
  if (auth) return auth;

  const manifestMatch = /^\/api\/hermes\/projects\/([^/]+)\/manifest$/u.exec(path);
  if (manifestMatch && request.method === "GET") {
    return handleHermesManifest(request, env, manifestMatch[1]);
  }

  const textMatch =
    /^\/api\/hermes\/projects\/([^/]+)\/documents\/([^/]+)\/text$/u.exec(path);
  if (textMatch && request.method === "GET") {
    const userId = normalizeUserId(new URL(request.url).searchParams.get("userId"));
    return handleHermesDocumentText(env, textMatch[1], textMatch[2], userId);
  }

  const downloadMatch =
    /^\/api\/hermes\/projects\/([^/]+)\/documents\/([^/]+)\/download$/u.exec(
      path,
    );
  if (downloadMatch && request.method === "GET") {
    const userId = normalizeUserId(new URL(request.url).searchParams.get("userId"));
    return handleHermesDocumentDownload(
      env,
      downloadMatch[1],
      downloadMatch[2],
      userId,
    );
  }

  const knCurrentMatch =
    /^\/api\/hermes\/projects\/([^/]+)\/knowledge-network\/current$/u.exec(path);
  if (knCurrentMatch) {
    const projectId = knCurrentMatch[1];
    if (request.method === "GET") {
      return handleHermesGetKnowledgeNetworkCurrent(request, env, projectId);
    }
    if (request.method === "PUT") {
      return handleHermesPutKnowledgeNetworkCurrent(request, env, projectId);
    }
    return json({ error: "Method Not Allowed" }, 405);
  }

  return json({ error: "Not Found" }, 404);
}
