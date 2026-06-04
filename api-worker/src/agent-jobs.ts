import type { SkillIntent } from "./chat-modes";
import { extractKnowledgeNetworkHtmlLoose } from "./chat-modes";
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

function extractKnHtmlFromResult(result: {
  answer: string;
  knowledgeNetworkHtml: string | null;
}): string | null {
  const direct = (result.knowledgeNetworkHtml ?? "").trim();
  if (direct) return direct;
  return extractKnowledgeNetworkHtmlLoose(result.answer);
}

async function writeKnowledgeNetworkFromHtml(
  env: AgentJobEnv,
  row: AgentJobRow,
  html: string,
  answerSummary: string,
): Promise<{ meta: Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>; html: string } | null> {
  await upsertProjectKnowledgeNetwork(env, {
    projectId: row.project_id,
    userId: row.user_id,
    html,
    lastJobId: row.id,
    answerSummary,
  });
  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const stored = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  if (!meta || !stored) return null;
  return { meta, html: stored };
}

async function finalizeKnowledgeNetworkJobResult(
  env: AgentJobEnv,
  row: AgentJobRow,
  result: { answer: string; knowledgeNetworkHtml: string | null },
): Promise<JobFinalizeResult> {
  let meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);

  // 路径 A：Hermes 已 curl PUT（最理想）
  if (meta?.lastJobId === row.id) {
    const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
    if (html) {
      const note = `\n\n已同步至**项目知识网络 v${meta.version}**（文件 API 回传，可在项目详情预览）。`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer}${note}`;
      return { status: "ok", answer, knowledgeNetworkHtml: html };
    }
  }

  // 给 Hermes 几秒迟到的 PUT
  if (!meta || meta.lastJobId !== row.id) {
    await sleep(4000);
    meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
    if (meta?.lastJobId === row.id) {
      const html = await readProjectKnowledgeNetworkHtml(env, row.project_id);
      if (html) {
        const note = `\n\n已同步至**项目知识网络 v${meta.version}**（文件 API 回传）。`;
        return {
          status: "ok",
          answer: result.answer.includes("项目知识网络 v")
            ? result.answer
            : `${result.answer}${note}`,
          knowledgeNetworkHtml: html,
        };
      }
    }
  }

  // 路径 B：从 Hermes 回复提取 HTML 写入（PUT 失败时的主交付）
  const extracted = extractKnHtmlFromResult(result);
  if (extracted) {
    const written = await writeKnowledgeNetworkFromHtml(
      env,
      row,
      extracted,
      "从 Hermes 回复提取 HTML",
    );
    if (written) {
      const note = `\n\n已写入**项目知识网络 v${written.meta.version}**（从回复提取 HTML；建议 Railway 配置密钥以便下次走 curl PUT）。`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer}${note}`;
      return { status: "ok", answer, knowledgeNetworkHtml: written.html };
    }
  }

  const viaChatFallback = (row.hermes_run_id ?? "").startsWith("chat-fallback-");
  return {
    status: "failed",
    error: "知识网络交付失败",
    answer:
      (result.answer.trim() || "Hermes 已结束，但未返回可用知识网络。") +
      "\n\n本条回复须在同一次交付末尾附完整 ```html 整页（含 <!DOCTYPE），平台才能预览并写入项目知识网络。" +
      (viaChatFallback
        ? "\n\n（当前为聊天兼容模式，无法 curl，代码块为唯一交付方式。）"
        : ""),
  };
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
  const answer = (answerForChat ?? "").trim() || `深度分析失败：${error}`;

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
