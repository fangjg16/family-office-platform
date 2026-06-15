import type { SkillIntent } from "./chat-modes";
import { extractKnowledgeNetworkHtmlLoose } from "./chat-modes";
import { syncCompletedAgentJobToChat } from "./chat-sync";
import { validateKnowledgeNetworkHtml } from "./knowledge-network-html-validation";
import { formatKnVersionDisplay } from "./knowledge-network-version";
import {
  detectKnowledgeNetworkUpdateMode,
  type KnowledgeNetworkUpdateMode,
} from "./knowledge-network-mode";
import {
  getProjectKnowledgeNetworkMeta,
  readProjectKnowledgeNetworkHtml,
  upsertProjectKnowledgeNetwork,
} from "./project-knowledge-network";

export type AgentJobEnv = {
  DB: D1Database;
  FILES: R2Bucket;
  /** 用于知识网络交付说明（是否已配置 Hermes→Worker 桥接密钥） */
  JFO_INTERNAL_KEY?: string;
};

/** 路径 B（从回复提取 HTML）成功时的说明：区分「未配密钥」与「已配但未 PUT」 */
function knowledgeNetworkExtractFallbackNote(env: AgentJobEnv): string {
  const bridgeConfigured = Boolean((env.JFO_INTERNAL_KEY ?? "").trim());
  if (bridgeConfigured) {
    return (
      "（本次 Hermes 未通过 curl PUT 回传，Worker 从回复提取 HTML 入库。" +
      "搭建期请按 docs/HERMES-RAILWAY-SSH-SETUP.md 在容器内重装 skills 并复测，直至显示「文件 API 回传」；" +
      "上线后本条可作为用户侧兜底。）"
    );
  }
  return (
    "（从回复提取 HTML 入库；请在 Railway Variables 与 Worker 执行 wrangler secret put JFO_INTERNAL_KEY 配置相同密钥，" +
    "以便 Hermes 使用 curl PUT 回传。）"
  );
}

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

async function resolveKnModeForJob(
  env: AgentJobEnv,
  row: AgentJobRow,
): Promise<KnowledgeNetworkUpdateMode> {
  let message = "";
  const msgRow = await env.DB.prepare(
    `SELECT content FROM user_chat_messages
     WHERE user_id = ? AND pending_job_id = ?
     ORDER BY sort_index DESC LIMIT 1`,
  )
    .bind(row.user_id, row.id)
    .first<{ content: string }>();
  if (msgRow?.content) message = msgRow.content;

  const meta = await getProjectKnowledgeNetworkMeta(env, row.project_id);
  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  const hadKbBeforeThisJob = Boolean(
    previousHtml?.trim() && meta?.lastJobId && meta.lastJobId !== row.id,
  );
  return detectKnowledgeNetworkUpdateMode(message, hadKbBeforeThisJob);
}

async function writeKnowledgeNetworkFromHtml(
  env: AgentJobEnv,
  row: AgentJobRow,
  html: string,
  answerSummary: string,
  knMode?: KnowledgeNetworkUpdateMode,
): Promise<{ meta: Awaited<ReturnType<typeof getProjectKnowledgeNetworkMeta>>; html: string } | null> {
  const previousHtml = await readProjectKnowledgeNetworkHtml(env, row.project_id);
  const mode =
    knMode ??
    (row.skill_intent === "knowledge_network"
      ? await resolveKnModeForJob(env, row)
      : "incremental");
  const validation = validateKnowledgeNetworkHtml(html, {
    mode,
    previousHtml,
    strict: true,
    touchesTimeline: mode !== "reorder" && /id=["']timeline["']/i.test(html),
  });
  if (!validation.ok) return null;

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
      const note = `\n\n已同步至**项目知识网络 v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（文件 API 回传，可在项目详情预览）。`;
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
        const note = `\n\n已同步至**项目知识网络 v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（文件 API 回传）。`;
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
    if (written?.meta) {
      const note = `\n\n已写入**项目知识网络 v${formatKnVersionDisplay(written.meta.version, written.meta.versionLabel)}**${knowledgeNetworkExtractFallbackNote(env)}`;
      const answer = result.answer.includes("项目知识网络 v")
        ? result.answer
        : `${result.answer}${note}`;
      return { status: "ok", answer, knowledgeNetworkHtml: written.html };
    }
  }

  const answerTrim = result.answer.trim();
  const viaChatFallback = (row.hermes_run_id ?? "").startsWith("chat-fallback-");

  /** 模型只回了文字（总结/分析）未贴 HTML：勿标「交付失败」，避免与「阅读/总结」类误触发混淆 */
  if (
    answerTrim.length >= 200 &&
    !/```html|<html[\s>]/i.test(answerTrim)
  ) {
    return {
      status: "ok",
      answer:
        answerTrim +
        "\n\n（本条回复**未包含** ```html 整页，因此**未写入**项目知识网络。若你只想查看或总结已有版本，请直接问「简单总结一下知识网络内容」或到项目详情预览；若要更新 HTML，请使用「生成/按板块更新/全量重做」等明确话术。）" +
        (viaChatFallback
          ? "\n\n（当前为聊天兼容模式，无法 curl PUT，生成 HTML 时须在回复末尾附整页代码块。）"
          : ""),
      knowledgeNetworkHtml: null,
    };
  }

  return {
    status: "failed",
    error: "知识网络交付失败",
    answer:
      (answerTrim || "Hermes 已结束，但未返回可用知识网络。") +
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
