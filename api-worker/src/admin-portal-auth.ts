export type AdminPortalAuthEnv = {
  ADMIN_PORTAL_USERNAME?: string;
  ADMIN_PORTAL_PASSWORD?: string;
  JFO_INTERNAL_KEY?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function adminUsername(env: AdminPortalAuthEnv): string {
  return (env.ADMIN_PORTAL_USERNAME ?? "admin").trim();
}

function adminPassword(env: AdminPortalAuthEnv): string {
  return (env.ADMIN_PORTAL_PASSWORD ?? "admin2026").trim();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

/** 由管理员密码派生的会话令牌（确定性，无需单独存 secret） */
export async function issueAdminPortalToken(env: AdminPortalAuthEnv): Promise<string> {
  const secret = adminPassword(env);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`jfo-admin-session:${adminUsername(env)}`),
  );
  return `jfo.admin.${bytesToBase64Url(new Uint8Array(sig))}`;
}

function extractBearer(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** 管理后台 Bearer 或运维 JFO_INTERNAL_KEY；通过返回 null */
export async function requireAdminPortalAuth(
  request: Request,
  env: AdminPortalAuthEnv,
): Promise<Response | null> {
  const token = extractBearer(request);
  if (!token) return json({ error: "Unauthorized" }, 401);

  const internalKey = (env.JFO_INTERNAL_KEY ?? "").trim();
  if (internalKey && token === internalKey) return null;

  const expected = await issueAdminPortalToken(env);
  if (token === expected) return null;

  return json({ error: "Unauthorized" }, 401);
}

/** POST /api/admin/login */
export async function handleAdminPortalLogin(
  request: Request,
  env: AdminPortalAuthEnv,
): Promise<Response> {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = (body.username ?? "").trim();
  const password = (body.password ?? "").trim();
  if (username !== adminUsername(env) || password !== adminPassword(env)) {
    return json({ error: "账号或密码错误" }, 401);
  }

  const token = await issueAdminPortalToken(env);
  return json({ ok: true, token, username });
}
