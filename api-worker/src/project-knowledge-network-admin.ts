import { backfillProjectKnowledgeNetworks } from "./project-knowledge-network";
import { requireHermesAuth, type HermesBridgeEnv } from "./hermes-bridge";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** POST /api/admin/project-knowledge-network/backfill — Bearer JFO_INTERNAL_KEY */
export async function handleBackfillProjectKnowledgeNetworks(
  request: Request,
  env: HermesBridgeEnv & { DB: D1Database; FILES: R2Bucket },
  url: URL,
): Promise<Response> {
  const auth = requireHermesAuth(request, env);
  if (auth) return auth;

  const projectId = (url.searchParams.get("projectId") ?? "").trim() || undefined;
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  try {
    const results = await backfillProjectKnowledgeNetworks(env, { projectId, force });
    return json({ ok: true, count: results.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
}
