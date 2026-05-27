import { getProjectById, type ProjectJson, type ProjectPhase } from "./projects-db";

/** 从路由段解析 projectId（兼容未解码的 %E4%B8%AD…） */
export function decodePathProjectId(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function pushCandidate(set: Set<string>, value: string | null | undefined): void {
  const v = (value ?? "").trim();
  if (!v) return;
  set.add(v);
  try {
    const decoded = decodeURIComponent(v);
    if (decoded) set.add(decoded);
  } catch {
    /* ignore */
  }
}

export function projectIdCandidates(pathId: string, bodyId?: string | null): string[] {
  const set = new Set<string>();
  pushCandidate(set, bodyId);
  pushCandidate(set, pathId);
  pushCandidate(set, decodePathProjectId(pathId));
  return Array.from(set);
}

function inferNameFromProjectId(projectId: string): string {
  const core = projectId.replace(/^proj-/u, "").replace(/-[a-f0-9]{8,}$/iu, "");
  const cleaned = core.replace(/-+/gu, " ").trim();
  return cleaned || "未命名项目";
}

/** 资料已上传但 projects 行缺失时补一条（历史/异常流程） */
async function healProjectRowFromDocuments(
  env: { DB: D1Database },
  projectId: string,
): Promise<ProjectJson | null> {
  const doc = await env.DB.prepare(
    `SELECT filename, uploaded_by FROM documents WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(projectId)
    .first<{ filename: string; uploaded_by: string | null }>();
  if (!doc) return null;

  const t = new Date().toISOString();
  const name = inferNameFromProjectId(projectId);
  const summary = `${name}（由资料包自动恢复的项目登记，可在此编辑完善）。`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO projects (
      id, name, category, phase, summary, guest_summary, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      projectId,
      name,
      "未分类",
      "Active（资源筹备中）" satisfies ProjectPhase,
      summary,
      `${name} 项目在管推进中，详情按权限展示。`,
      doc.uploaded_by,
      t,
      t,
    )
    .run();

  return getProjectById(env, projectId);
}

/** 编辑/删除前解析项目：路径 id、body id、URL 解码、资料包反查补登记 */
export async function resolveProjectForManage(
  env: { DB: D1Database },
  pathId: string,
  bodyId?: string | null,
): Promise<ProjectJson | null> {
  for (const id of projectIdCandidates(pathId, bodyId)) {
    const row = await getProjectById(env, id);
    if (row) return row;
  }

  for (const id of projectIdCandidates(pathId, bodyId)) {
    const healed = await healProjectRowFromDocuments(env, id);
    if (healed) return healed;
  }

  return null;
}
