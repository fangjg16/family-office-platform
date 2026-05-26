import type { SkillIntent } from "./chat-modes";

export type AgentJobEnv = { DB: D1Database };

export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export type AgentJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  conversation_id: string | null;
  skill_intent: string;
  status: AgentJobStatus;
  hermes_run_id: string | null;
  answer: string | null;
  knowledge_network_html: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function createAgentJob(
  env: AgentJobEnv,
  row: {
    id: string;
    projectId: string;
    userId: string;
    conversationId?: string;
    skillIntent: SkillIntent;
  },
): Promise<void> {
  const t = nowIso();
  await env.DB.prepare(
    `INSERT INTO agent_jobs (
      id, project_id, user_id, conversation_id, skill_intent, status,
      hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, NULL, ?, ?)`,
  )
    .bind(
      row.id,
      row.projectId,
      row.userId,
      row.conversationId ?? null,
      row.skillIntent,
      t,
      t,
    )
    .run();
}

export async function markAgentJobRunning(
  env: AgentJobEnv,
  jobId: string,
  hermesRunId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'running', hermes_run_id = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(hermesRunId, nowIso(), jobId)
    .run();
}

export async function completeAgentJob(
  env: AgentJobEnv,
  jobId: string,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'completed', answer = ?, knowledge_network_html = ?, error = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(result.answer, result.knowledgeNetworkHtml, nowIso(), jobId)
    .run();
}

export async function failAgentJob(env: AgentJobEnv, jobId: string, error: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(error, nowIso(), jobId)
    .run();
}

export async function getAgentJob(
  env: AgentJobEnv,
  jobId: string,
  userId: string,
): Promise<AgentJobRow | null> {
  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ? AND user_id = ?`,
  )
    .bind(jobId, userId)
    .first<AgentJobRow>();
  return row ?? null;
}
