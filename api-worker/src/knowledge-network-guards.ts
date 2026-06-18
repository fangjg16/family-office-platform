import type { AgentJobEnv } from "./agent-jobs";
import { isHermesAgentConfigured, type HermesAgentEnv } from "./hermes-agent";

export type KnPipelineCheck = { ok: true } | { ok: false; error: string };

/** P0：知识网络 Hermes 任务启动前门禁 */
export function checkKnowledgeNetworkPipelineReady(
  env: HermesAgentEnv & { JFO_INTERNAL_KEY?: string; JFO_API_PUBLIC_BASE?: string },
): KnPipelineCheck {
  if (!isHermesAgentConfigured(env)) {
    return {
      ok: false,
      error:
        "深度知识网络须 Hermes Agent（HERMES_BASE_URL + HERMES_API_KEY）。请配置后重试。",
    };
  }
  if (!(env.JFO_INTERNAL_KEY ?? "").trim()) {
    return {
      ok: false,
      error:
        "知识网络文件回路未配置：Worker 缺少 JFO_INTERNAL_KEY（Hermes 无法 GET/PUT 回传 HTML）。",
    };
  }
  const base = (
    env.JFO_API_PUBLIC_BASE ?? "https://jfo-api.jfo-api.workers.dev"
  ).trim();
  if (!base) {
    return {
      ok: false,
      error:
        "知识网络文件回路未配置：Worker 缺少 JFO_API_PUBLIC_BASE（Hermes 无法拼回传 URL）。",
    };
  }
  return { ok: true };
}

/** 该项目该用户进行中的知识网络任务（pending / running） */
export async function findActiveKnowledgeNetworkJobId(
  env: AgentJobEnv,
  projectId: string,
  userId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT id FROM agent_jobs
     WHERE project_id = ? AND user_id = ? AND skill_intent = 'knowledge_network'
       AND status IN ('pending', 'running')
     ORDER BY datetime(created_at) DESC
     LIMIT 1`,
  )
    .bind(projectId, userId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export type ResolvedPutJobId = {
  jobId: string | null;
  /** 是否由服务端自动绑定（查询参数未带 jobId） */
  autoBound: boolean;
  rejected?: "cancelled" | "terminal";
};

/**
 * P0：PUT 时解析 jobId — 查询参数优先；缺失则绑到进行中的 KN 任务。
 */
export async function resolveKnowledgeNetworkPutJobId(
  env: AgentJobEnv,
  projectId: string,
  userId: string,
  requestedJobId: string | null,
): Promise<ResolvedPutJobId> {
  const req = (requestedJobId ?? "").trim();
  if (req) {
    const row = await env.DB.prepare(
      `SELECT id, status FROM agent_jobs
       WHERE id = ? AND project_id = ? AND user_id = ? AND skill_intent = 'knowledge_network'`,
    )
      .bind(req, projectId, userId)
      .first<{ id: string; status: string }>();
    if (row) {
      if (row.status === "cancelled") {
        return { jobId: null, autoBound: false, rejected: "cancelled" as const };
      }
      if (row.status === "failed" || row.status === "completed") {
        return { jobId: null, autoBound: false, rejected: "terminal" as const };
      }
      return { jobId: row.id, autoBound: false };
    }
  }

  const active = await findActiveKnowledgeNetworkJobId(env, projectId, userId);
  if (active) {
    return { jobId: active, autoBound: true };
  }

  if (req) {
    return { jobId: req, autoBound: false };
  }

  return { jobId: null, autoBound: false };
}
