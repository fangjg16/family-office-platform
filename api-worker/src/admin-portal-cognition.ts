import { listProjectDocumentsForAdmin } from "./admin-portal-documents";
import { getProjectById } from "./projects-db";
import { requireAdminPortalAuth } from "./admin-portal-auth";
import { loadChatStateData } from "./chat-sync";
import { KNOWN_WORKSPACE_USER_IDS } from "./workspace-known-users";

type Env = {
  DB: D1Database;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  HERMES_MODEL?: string;
  HERMES_BASE_URL?: string;
  HERMES_API_KEY?: string;
  ADMIN_PORTAL_USERNAME?: string;
  ADMIN_PORTAL_PASSWORD?: string;
  JFO_INTERNAL_KEY?: string;
};

type CognitionRow = {
  project_id: string;
  summary: string;
  generated_at: string;
  model: string | null;
  generated_by: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function readCachedCognition(
  env: Env,
  projectId: string,
): Promise<CognitionRow | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT project_id, summary, generated_at, model, generated_by
       FROM project_admin_cognition WHERE project_id = ?`,
    )
      .bind(projectId)
      .first<CognitionRow>();
    return row ?? null;
  } catch {
    return null;
  }
}

async function saveCognition(
  env: Env,
  projectId: string,
  summary: string,
  model: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO project_admin_cognition (project_id, summary, generated_at, model, generated_by)
     VALUES (?, ?, ?, ?, 'admin')
     ON CONFLICT(project_id) DO UPDATE SET
       summary = excluded.summary,
       generated_at = excluded.generated_at,
       model = excluded.model,
       generated_by = excluded.generated_by`,
  )
    .bind(projectId, summary, new Date().toISOString(), model)
    .run();
}

function snippet(text: string, max: number): string {
  const one = text.replace(/\s+/gu, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

async function collectProjectContext(env: Env, projectId: string) {
  const project = await getProjectById(env, projectId);
  if (!project) return null;

  const docs = await listProjectDocumentsForAdmin(env, projectId);
  const docLines = [
    ...docs.projectDocuments.map((d) => `资料包：${d.filename}（${d.parseStatus}）`),
    ...docs.conversationDocuments.map(
      (d) => `对话附件：${d.filename}（${d.userName}，${d.parseStatus}）`,
    ),
  ];

  const convSnippets: string[] = [];
  for (const userId of KNOWN_WORKSPACE_USER_IDS) {
    try {
      const state = await loadChatStateData(env, userId);
      for (const conv of state.conversations) {
        if (conv.projectId !== projectId) continue;
        const messages = state.messagesByConversation[conv.id] ?? [];
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          convSnippets.push(
            `${userId}：${snippet(lastUser.content, 120)}`,
          );
        }
      }
    } catch {
      /* ignore */
    }
    if (convSnippets.length >= 6) break;
  }

  return {
    project,
    docLines: docLines.slice(0, 12),
    convSnippets: convSnippets.slice(0, 6),
  };
}

type LlmCaller = (
  messages: { role: string; content: string }[],
) => Promise<{ answer: string; raw: unknown; model: string }>;

export async function generateProjectCognitionSummary(
  env: Env,
  projectId: string,
  callLlm: LlmCaller,
): Promise<{ summary: string; model: string } | { error: string }> {
  const ctx = await collectProjectContext(env, projectId);
  if (!ctx) return { error: "项目不存在" };

  const { project, docLines, convSnippets } = ctx;
  const userContent = [
    `请为家族办公室管理后台撰写「Agent 认知摘要」，供内部运营人员快速理解项目，不要输出 Markdown 标题。`,
    "",
    `项目名称：${project.name}`,
    `赛道：${project.category}`,
    `阶段：${project.phase}`,
    `内部摘要：${project.summary}`,
    `访客摘要：${project.guestSummary}`,
    "",
    `已上传文档（${docLines.length}）：`,
    docLines.length ? docLines.map((l) => `- ${l}`).join("\n") : "- 暂无",
    "",
    `近期对话片段（${convSnippets.length}）：`,
    convSnippets.length ? convSnippets.map((l) => `- ${l}`).join("\n") : "- 暂无",
    "",
    "请用 3～5 句中文说明：业务焦点、当前推进阶段、资料与对话反映的关键事实、访客与内部信息差异、需运营关注的风险或待办。",
  ].join("\n");

  try {
    const result = await callLlm([
      {
        role: "system",
        content:
          "你是合域家族办公室内部运营分析助手。输出简洁、专业、可执行，不编造文档或对话中未出现的事实。",
      },
      { role: "user", content: userContent },
    ]);
    const summary = result.answer.trim();
    if (!summary) return { error: "模型未返回摘要" };
    await saveCognition(env, projectId, summary, result.model);
    return { summary, model: result.model };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleGetProjectCognition(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;

  const cached = await readCachedCognition(env, projectId);
  if (!cached) {
    return json({ ok: true, projectId, cached: false, summary: null }, 200);
  }
  return json({
    ok: true,
    projectId,
    cached: true,
    summary: cached.summary,
    generatedAt: cached.generated_at,
    model: cached.model,
  });
}

export async function handleGenerateProjectCognition(
  request: Request,
  env: Env,
  projectId: string,
  callLlm: LlmCaller,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;

  const result = await generateProjectCognitionSummary(env, projectId, callLlm);
  if ("error" in result) return json({ error: result.error }, 502);
  return json({
    ok: true,
    projectId,
    cached: true,
    summary: result.summary,
    generatedAt: new Date().toISOString(),
    model: result.model,
  });
}

export async function loadProjectCognitionMap(
  env: Env,
  projectIds: string[],
): Promise<
  Record<string, { summary: string; generatedAt: string; model: string | null }>
> {
  const map: Record<string, { summary: string; generatedAt: string; model: string | null }> =
    {};
  for (const projectId of projectIds) {
    const row = await readCachedCognition(env, projectId);
    if (row) {
      map[projectId] = {
        summary: row.summary,
        generatedAt: row.generated_at,
        model: row.model,
      };
    }
  }
  return map;
}
