export type ProjectKnowledgeNetworkEnv = {
  DB: D1Database;
  FILES: R2Bucket;
};

export type ProjectKnowledgeNetworkMeta = {
  projectId: string;
  r2Key: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  lastJobId: string | null;
  changelog: string | null;
};

export function projectKnowledgeNetworkR2Key(projectId: string): string {
  return `projects/${projectId}/knowledge-network/current.html`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function changelogFromAnswer(answer: string): string | null {
  const trimmed = answer.replace(/\s+/gu, " ").trim();
  if (!trimmed) return null;
  const withoutHtml = trimmed.replace(/```html[\s\S]*?```/gi, "").trim();
  const text = (withoutHtml || trimmed).slice(0, 500);
  return text || null;
}

export async function getProjectKnowledgeNetworkMeta(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
): Promise<ProjectKnowledgeNetworkMeta | null> {
  const row = await env.DB.prepare(
    `SELECT project_id, r2_key, version, updated_at, updated_by, last_job_id, changelog
     FROM project_knowledge_networks WHERE project_id = ?`,
  )
    .bind(projectId)
    .first<{
      project_id: string;
      r2_key: string;
      version: number;
      updated_at: string;
      updated_by: string;
      last_job_id: string | null;
      changelog: string | null;
    }>();
  if (!row) return null;
  return {
    projectId: row.project_id,
    r2Key: row.r2_key,
    version: row.version,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    lastJobId: row.last_job_id,
    changelog: row.changelog,
  };
}

export async function readProjectKnowledgeNetworkHtml(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
): Promise<string | null> {
  const meta = await getProjectKnowledgeNetworkMeta(env, projectId);
  if (!meta) return null;
  const object = await env.FILES.get(meta.r2Key);
  if (!object) return null;
  return object.text();
}

export async function upsertProjectKnowledgeNetwork(
  env: ProjectKnowledgeNetworkEnv,
  params: {
    projectId: string;
    userId: string;
    html: string;
    lastJobId?: string | null;
    answerSummary?: string | null;
  },
): Promise<ProjectKnowledgeNetworkMeta> {
  const html = params.html.trim();
  if (!html) {
    throw new Error("知识网络 HTML 为空，无法写入项目");
  }

  const projectId = params.projectId.trim();
  const userId = params.userId.trim();
  const r2Key = projectKnowledgeNetworkR2Key(projectId);
  const now = nowIso();

  const prev = await getProjectKnowledgeNetworkMeta(env, projectId);
  const version = (prev?.version ?? 0) + 1;
  const summary = params.answerSummary?.trim() ?? "";
  const changelog =
    (summary.length > 0 && summary.length <= 500 && !summary.startsWith("<")
      ? summary
      : null) ||
    changelogFromAnswer(summary) ||
    (prev ? `版本 ${version} 更新` : "首次生成");

  await env.FILES.put(r2Key, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });

  await env.DB.prepare(
    `INSERT INTO project_knowledge_networks (
       project_id, r2_key, version, updated_at, updated_by, last_job_id, changelog
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       r2_key = excluded.r2_key,
       version = excluded.version,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       last_job_id = excluded.last_job_id,
       changelog = excluded.changelog`,
  )
    .bind(
      projectId,
      r2Key,
      version,
      now,
      userId,
      params.lastJobId ?? null,
      changelog,
    )
    .run();

  return {
    projectId,
    r2Key,
    version,
    updatedAt: now,
    updatedBy: userId,
    lastJobId: params.lastJobId ?? null,
    changelog,
  };
}

export async function deleteProjectKnowledgeNetwork(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
): Promise<void> {
  const meta = await getProjectKnowledgeNetworkMeta(env, projectId);
  if (meta?.r2Key) {
    try {
      await env.FILES.delete(meta.r2Key);
    } catch {
      /* 忽略 R2 缺失 */
    }
  }
  await env.DB.prepare(`DELETE FROM project_knowledge_networks WHERE project_id = ?`)
    .bind(projectId)
    .run();
}

export async function maybePersistProjectKnowledgeNetwork(
  env: ProjectKnowledgeNetworkEnv,
  params: {
    projectId: string;
    userId: string;
    skillIntent: string;
    html: string | null | undefined;
    lastJobId?: string | null;
    answerSummary?: string | null;
  },
): Promise<ProjectKnowledgeNetworkMeta | null> {
  if (params.skillIntent !== "knowledge_network") return null;
  const html = (params.html ?? "").trim();
  if (!html) return null;
  return upsertProjectKnowledgeNetwork(env, {
    projectId: params.projectId,
    userId: params.userId,
    html,
    lastJobId: params.lastJobId ?? null,
    answerSummary: params.answerSummary ?? null,
  });
}
