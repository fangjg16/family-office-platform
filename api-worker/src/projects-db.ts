import { auditAllMessagesInConversationDeleted } from "./chat-audit";
import { deleteProjectKnowledgeNetwork } from "./project-knowledge-network";

export type ProjectPhase =
  | "Active（资源筹备中）"
  | "Completed（已签约）"
  | "Paused（暂停）"
  | "Cancelled（已取消）";

export type ProjectRow = {
  id: string;
  name: string;
  category: string;
  phase: ProjectPhase;
  summary: string;
  guest_summary: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectJson = {
  id: string;
  name: string;
  category: string;
  phase: ProjectPhase;
  summary: string;
  guestSummary: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function rowToJson(row: ProjectRow): ProjectJson {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    phase: row.phase,
    summary: row.summary,
    guestSummary: row.guest_summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(env: { DB: D1Database }): Promise<ProjectJson[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, category, phase, summary, guest_summary, created_by, created_at, updated_at
     FROM projects
     ORDER BY updated_at DESC`,
  ).all<ProjectRow>();
  return (results ?? []).map(rowToJson);
}

export async function getProjectById(
  env: { DB: D1Database },
  id: string,
): Promise<ProjectJson | null> {
  const row = await env.DB.prepare(
    `SELECT id, name, category, phase, summary, guest_summary, created_by, created_at, updated_at
     FROM projects WHERE id = ?`,
  )
    .bind(id)
    .first<ProjectRow>();
  return row ? rowToJson(row) : null;
}

/** 仅用 ASCII，避免 PATCH 路径含中文导致边缘 404 */
export function buildProjectId(_name: string): string {
  const suffix = crypto.randomUUID().replace(/-/gu, "").slice(0, 12);
  return `proj-${suffix}`;
}

export async function createProject(
  env: { DB: D1Database },
  input: {
    name: string;
    summary: string;
    guestSummary?: string;
    category?: string;
    phase?: ProjectPhase;
    createdBy?: string | null;
  },
): Promise<ProjectJson> {
  const t = nowIso();
  const id = buildProjectId(input.name);
  const guestSummary =
    (input.guestSummary ?? "").trim() ||
    "项目在管推进中，详情按权限展示。";
  await env.DB.prepare(
    `INSERT INTO projects (
      id, name, category, phase, summary, guest_summary, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.name.trim(),
      (input.category ?? "未分类").trim() || "未分类",
      input.phase ?? "Active（资源筹备中）",
      input.summary.trim(),
      guestSummary,
      input.createdBy ?? null,
      t,
      t,
    )
    .run();
  const created = await getProjectById(env, id);
  if (!created) throw new Error("项目创建后读取失败");
  return created;
}

const VALID_PHASES: ProjectPhase[] = [
  "Active（资源筹备中）",
  "Completed（已签约）",
  "Paused（暂停）",
  "Cancelled（已取消）",
];

export function normalizeProjectPhase(raw: string | undefined): ProjectPhase {
  const p = (raw ?? "").trim() as ProjectPhase;
  return VALID_PHASES.includes(p) ? p : "Active（资源筹备中）";
}

export async function updateProject(
  env: { DB: D1Database },
  id: string,
  input: {
    name?: string;
    summary?: string;
    guestSummary?: string;
    category?: string;
    phase?: ProjectPhase;
  },
): Promise<ProjectJson | null> {
  const existing = await getProjectById(env, id);
  if (!existing) return null;

  const name = (input.name ?? existing.name).trim();
  if (!name) throw new Error("项目名称不能为空");

  const summary = (input.summary ?? existing.summary).trim();
  const guestSummary = (input.guestSummary ?? existing.guestSummary).trim();
  const category = ((input.category ?? existing.category).trim() || "未分类");
  const phase = input.phase ?? existing.phase;

  await env.DB.prepare(
    `UPDATE projects
     SET name = ?, category = ?, phase = ?, summary = ?, guest_summary = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(name, category, phase, summary, guestSummary, nowIso(), id)
    .run();

  return getProjectById(env, id);
}

/** 删除项目及其资料、分块、对话记录（实操闭环，避免孤儿数据） */
export async function deleteProjectCascade(
  env: { DB: D1Database; FILES: R2Bucket },
  projectId: string,
): Promise<boolean> {
  const existing = await getProjectById(env, projectId);
  if (!existing) return false;

  const { results: docs } = await env.DB.prepare(
    `SELECT id, r2_key FROM documents WHERE project_id = ?`,
  )
    .bind(projectId)
    .all<{ id: string; r2_key: string }>();

  for (const doc of docs ?? []) {
    await env.DB.prepare(`DELETE FROM chunks WHERE document_id = ?`)
      .bind(doc.id)
      .run();
    if (doc.r2_key) {
      try {
        await env.FILES.delete(doc.r2_key);
      } catch {
        /* R2 缺失时仍继续清 D1 */
      }
    }
  }

  await env.DB.prepare(`DELETE FROM documents WHERE project_id = ?`)
    .bind(projectId)
    .run();
  await env.DB.prepare(`DELETE FROM agent_jobs WHERE project_id = ?`)
    .bind(projectId)
    .run();

  const { results: convs } = await env.DB.prepare(
    `SELECT user_id, id FROM user_conversations WHERE project_id = ?`,
  )
    .bind(projectId)
    .all<{ user_id: string; id: string }>();

  for (const c of convs ?? []) {
    await auditAllMessagesInConversationDeleted(
      env,
      c.user_id,
      c.id,
      "conversation_delete",
    );
    await env.DB.prepare(
      `DELETE FROM user_chat_messages WHERE user_id = ? AND conversation_id = ?`,
    )
      .bind(c.user_id, c.id)
      .run();
  }
  await env.DB.prepare(`DELETE FROM user_conversations WHERE project_id = ?`)
    .bind(projectId)
    .run();
  try {
    await deleteProjectKnowledgeNetwork(env, projectId);
  } catch {
    /* R2/D1 缺失时仍删除项目行 */
  }
  await env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(projectId).run();
  return true;
}
