import type { SkillIntent } from "./chat-modes";
import { extractKnowledgeNetworkHtml } from "./chat-modes";
import { syncCompletedAgentJobToChat } from "./chat-sync";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";

export type AgentJobEnv = { DB: D1Database; FILES: R2Bucket };

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

const KN_PUT_FAIL_ERROR =
  "知识网络未通过 API 回传：任务结束前须成功 PUT /api/hermes/projects/{projectId}/knowledge-network/current（见 Hermes 任务说明）。";

type JobFinalizeResult =
  | {
      status: "ok";
      answer: string;
      knowledgeNetworkHtml: string | null;
    }
  | {
      status: "failed";
      error: string;
      answer: string;
    };

async function trySalvageKnowledgeNetworkFromAnswer(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<JobFinalizeResult | null> {
  const salvaged =
    (result.knowledgeNetworkHtml?.trim() || "") ||
    extractKnowledgeNetworkHtml(result.answer) ||
    "";
  if (!salvaged) return null;

  await upsertProjectKnowledgeNetwork(env, {
    projectId: row.project_id,
    userId: row.user_id,
    html: salvaged,
    lastJobId: row.id,
    answerSummary: "Hermes 未 PUT，Worker 从回复提取 HTML 写入",
  });

  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  if (!meta || !html) return null;

  const salvageNote = `\n\n已写入**项目知识网络 v${meta.version}**（Hermes 未执行 curl PUT，系统从回复中提取 HTML）。建议在 Railway 配置 \`JFO_INTERNAL_KEY\` 与 \`JFO_API_PUBLIC_BASE\`，下次走文件回传更稳。`;
  const answer = result.answer.includes("项目知识网络 v")
    ? result.answer
    : `${result.answer}${salvageNote}`;

  return { status: "ok", answer, knowledgeNetworkHtml: html };
}

async function finalizeKnowledgeNetworkJobResult(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<JobFinalizeResult> {
  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  if (meta?.lastJobId !== row.id) {
    const salvaged = await trySalvageKnowledgeNetworkFromAnswer(env, row, result);
    if (salvaged) return salvaged;

    const viaChatFallback = (row.hermes_run_id ?? "").startsWith("chat-fallback-");
    return {
      status: "failed",
      error: KN_PUT_FAIL_ERROR,
      answer:
        (result.answer.trim() || "Hermes 已结束，但未检测到与本任务绑定的 PUT 回传。") +
        (viaChatFallback
          ? "\n\n当前为**聊天兼容模式**（Runs 不可用），无法在容器内 curl PUT。请确认 Railway 已开放 POST /v1/runs，或让 Hermes 在回复中包含完整 ```html 代码块以便系统提取。"
          : "\n\n请确认 Railway Hermes 已配置 JFO_INTERNAL_KEY、JFO_API_PUBLIC_BASE，且任务说明中的 curl PUT 已执行成功。"),
    };
  }

  const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  if (!html) {
    return {
      status: "failed",
      error: "知识网络元数据已登记，但 R2 文件缺失。",
      answer: result.answer,
    };
  }

  const note = `\n\n已同步至**项目知识网络 v${meta.version}**（可在项目详情预览）。`;
  const answer = result.answer.includes("项目知识网络 v")
    ? result.answer
    : `${result.answer}${note}`;

  return { status: "ok", answer, knowledgeNetworkHtml: html };
}

async function finalizeJobResult(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<JobFinalizeResult> {
  if (row.skill_intent !== "knowledge_network") {
    return {
      status: "ok",
      answer: result.answer,
      knowledgeNetworkHtml: result.knowledgeNetworkHtml,
    };
  }
  return finalizeKnowledgeNetworkJobResult(env, row, result);
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
  const rowBefore = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();

  if (!rowBefore) return;

  const finalized = await finalizeJobResult(env, rowBefore, result);

  if (finalized.status === "failed") {
    await failAgentJob(env, jobId, finalized.error, finalized.answer);
    return;
  }

  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'completed', answer = ?, knowledge_network_html = ?, error = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(finalized.answer, finalized.knowledgeNetworkHtml, nowIso(), jobId)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();
  if (row) {
    await syncCompletedAgentJobToChat(env, row, {
      answer: finalized.answer,
      knowledgeNetworkHtml: finalized.knowledgeNetworkHtml,
    });
  }
}

export async function failAgentJob(
  env: AgentJobEnv,
  jobId: string,
  error: string,
  answerForChat?: string | null,
): Promise<void> {
  const answer =
    (answerForChat ?? "").trim() ||
    `深度分析失败：${error}`;

  await env.DB.prepare(
    `UPDATE agent_jobs SET status = 'failed', error = ?, answer = ?, knowledge_network_html = NULL, updated_at = ? WHERE id = ?`,
  )
    .bind(error, answer, nowIso(), jobId)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
            hermes_run_id, answer, knowledge_network_html, error, created_at, updated_at
     FROM agent_jobs WHERE id = ?`,
  )
    .bind(jobId)
    .first<AgentJobRow>();

  if (row?.conversation_id) {
    await syncCompletedAgentJobToChat(env, row, {
      answer,
      knowledgeNetworkHtml: null,
    });
  }
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
