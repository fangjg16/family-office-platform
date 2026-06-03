import { listChatAuditLog, type AuditEvent } from "./chat-audit";
import { requireHermesAuth, type HermesBridgeEnv } from "./hermes-bridge";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** GET /api/admin/chat-audit — 运维/Admin Portal（Bearer JFO_INTERNAL_KEY） */
export async function handleGetChatAudit(
  request: Request,
  env: HermesBridgeEnv,
  url: URL,
): Promise<Response> {
  const auth = requireHermesAuth(request, env);
  if (auth) return auth;

  const userId = (url.searchParams.get("userId") ?? "").trim() || undefined;
  const conversationId =
    (url.searchParams.get("conversationId") ?? "").trim() || undefined;
  const messageId = (url.searchParams.get("messageId") ?? "").trim() || undefined;
  const eventRaw = (url.searchParams.get("event") ?? "").trim();
  const event: AuditEvent | undefined =
    eventRaw === "created" || eventRaw === "deleted" ? eventRaw : undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 80;

  if (!userId && !conversationId && !messageId) {
    return json(
      {
        error: "请至少提供 userId、conversationId 或 messageId 之一作为筛选条件",
      },
      400,
    );
  }

  const entries = await listChatAuditLog(env, {
    userId,
    conversationId,
    messageId,
    event,
    limit,
  });

  return json({
    ok: true,
    count: entries.length,
    entries,
  });
}
