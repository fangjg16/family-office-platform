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

export type ProjectKnowledgeNetworkVersionRow = {
  version: number;
  r2Key: string;
  updatedAt: string;
  updatedBy: string;
  changelog: string | null;
};

export function projectKnowledgeNetworkR2Key(projectId: string): string {
  return `projects/${projectId}/knowledge-network/current.html`;
}

export function projectKnowledgeNetworkArchiveR2Key(
  projectId: string,
  version: number,
): string {
  return `projects/${projectId}/knowledge-network/v${version}.html`;
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

export async function listProjectKnowledgeNetworkVersions(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
): Promise<ProjectKnowledgeNetworkVersionRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT version, r2_key, updated_at, updated_by, changelog
     FROM project_knowledge_network_versions
     WHERE project_id = ?
     ORDER BY version DESC`,
  )
    .bind(projectId)
    .all<{
      version: number;
      r2_key: string;
      updated_at: string;
      updated_by: string;
      changelog: string | null;
    }>();
  return (results ?? []).map((r) => ({
    version: r.version,
    r2Key: r.r2_key,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by,
    changelog: r.changelog,
  }));
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

export async function readProjectKnowledgeNetworkVersionHtml(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
  version: number,
): Promise<string | null> {
  const current = await getProjectKnowledgeNetworkMeta(env, projectId);
  if (current?.version === version) {
    const object = await env.FILES.get(current.r2Key);
    return object ? object.text() : null;
  }
  const row = await env.DB.prepare(
    `SELECT r2_key FROM project_knowledge_network_versions
     WHERE project_id = ? AND version = ?`,
  )
    .bind(projectId, version)
    .first<{ r2_key: string }>();
  if (!row) return null;
  const object = await env.FILES.get(row.r2_key);
  return object ? object.text() : null;
}

async function archiveCurrentVersion(
  env: ProjectKnowledgeNetworkEnv,
  prev: ProjectKnowledgeNetworkMeta,
): Promise<void> {
  const archiveKey = projectKnowledgeNetworkArchiveR2Key(prev.projectId, prev.version);
  const currentObject = await env.FILES.get(prev.r2Key);
  if (currentObject) {
    const html = await currentObject.text();
    await env.FILES.put(archiveKey, html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
  }
  await env.DB.prepare(
    `INSERT INTO project_knowledge_network_versions (
       project_id, version, r2_key, updated_at, updated_by, changelog
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, version) DO UPDATE SET
       r2_key = excluded.r2_key,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       changelog = excluded.changelog`,
  )
    .bind(
      prev.projectId,
      prev.version,
      archiveKey,
      prev.updatedAt,
      prev.updatedBy,
      prev.changelog,
    )
    .run();
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
  if (prev) {
    await archiveCurrentVersion(env, prev);
  }
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
      /* 忽略 */
    }
  }
  const versions = await listProjectKnowledgeNetworkVersions(env, projectId);
  for (const v of versions) {
    try {
      await env.FILES.delete(v.r2Key);
    } catch {
      /* 忽略 */
    }
  }
  await env.DB.prepare(`DELETE FROM project_knowledge_network_versions WHERE project_id = ?`)
    .bind(projectId)
    .run();
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

export type BackfillResult = {
  projectId: string;
  action: "skipped" | "created" | "updated" | "unchanged";
  version?: number;
  source?: "agent_jobs" | "user_chat_messages";
};

async function latestKnHtmlForProject(
  env: ProjectKnowledgeNetworkEnv,
  projectId: string,
): Promise<{ html: string; updatedAt: string; userId: string; source: "agent_jobs" | "user_chat_messages" } | null> {
  const jobRow = await env.DB.prepare(
    `SELECT knowledge_network_html, updated_at, user_id
     FROM agent_jobs
     WHERE project_id = ? AND skill_intent = 'knowledge_network'
       AND knowledge_network_html IS NOT NULL AND TRIM(knowledge_network_html) != ''
     ORDER BY updated_at DESC LIMIT 1`,
  )
    .bind(projectId)
    .first<{
      knowledge_network_html: string;
      updated_at: string;
      user_id: string;
    }>();

  const msgRow = await env.DB.prepare(
    `SELECT m.knowledge_network_html, m.updated_at, m.user_id
     FROM user_chat_messages m
     INNER JOIN user_conversations c ON c.user_id = m.user_id AND c.id = m.conversation_id
     WHERE c.project_id = ? AND m.role = 'assistant'
       AND m.knowledge_network_html IS NOT NULL AND TRIM(m.knowledge_network_html) != ''
     ORDER BY m.updated_at DESC LIMIT 1`,
  )
    .bind(projectId)
    .first<{
      knowledge_network_html: string;
      updated_at: string;
      user_id: string;
    }>();

  const candidates: {
    html: string;
    updatedAt: string;
    userId: string;
    source: "agent_jobs" | "user_chat_messages";
  }[] = [];
  if (jobRow?.knowledge_network_html?.trim()) {
    candidates.push({
      html: jobRow.knowledge_network_html.trim(),
      updatedAt: jobRow.updated_at,
      userId: jobRow.user_id,
      source: "agent_jobs",
    });
  }
  if (msgRow?.knowledge_network_html?.trim()) {
    candidates.push({
      html: msgRow.knowledge_network_html.trim(),
      updatedAt: msgRow.updated_at,
      userId: msgRow.user_id,
      source: "user_chat_messages",
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return candidates[0];
}

/** 从 agent_jobs / user_chat_messages 回填项目知识网络（Admin） */
export async function backfillProjectKnowledgeNetworks(
  env: ProjectKnowledgeNetworkEnv,
  options?: { projectId?: string; force?: boolean },
): Promise<BackfillResult[]> {
  const targetId = options?.projectId?.trim();
  const force = options?.force === true;
  const results: BackfillResult[] = [];

  let projectIds: string[] = [];
  if (targetId) {
    projectIds = [targetId];
  } else {
    const fromJobs = await env.DB.prepare(
      `SELECT DISTINCT project_id FROM agent_jobs
       WHERE skill_intent = 'knowledge_network' AND knowledge_network_html IS NOT NULL`,
    ).all<{ project_id: string }>();
    const fromMsgs = await env.DB.prepare(
      `SELECT DISTINCT c.project_id AS project_id
       FROM user_chat_messages m
       INNER JOIN user_conversations c ON c.user_id = m.user_id AND c.id = m.conversation_id
       WHERE m.knowledge_network_html IS NOT NULL`,
    ).all<{ project_id: string }>();
    const set = new Set<string>();
    for (const r of fromJobs.results ?? []) {
      if (r.project_id) set.add(r.project_id);
    }
    for (const r of fromMsgs.results ?? []) {
      if (r.project_id) set.add(r.project_id);
    }
    projectIds = Array.from(set);
  }

  for (const projectId of projectIds) {
    const latest = await latestKnHtmlForProject(env, projectId);
    if (!latest) {
      results.push({ projectId, action: "skipped" });
      continue;
    }
    const existing = await getProjectKnowledgeNetworkMeta(env, projectId);
    if (existing && !force) {
      if (existing.updatedAt >= latest.updatedAt) {
        results.push({ projectId, action: "unchanged", version: existing.version });
        continue;
      }
    }
    const meta = await upsertProjectKnowledgeNetwork(env, {
      projectId,
      userId: latest.userId,
      html: latest.html,
      answerSummary: `历史回填（${latest.source}）`,
    });
    results.push({
      projectId,
      action: existing ? "updated" : "created",
      version: meta.version,
      source: latest.source,
    });
  }
  return results;
}
