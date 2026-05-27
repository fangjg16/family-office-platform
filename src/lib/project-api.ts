import { normalizeProjectPhase } from "@/workspace/projects";

/** Cloudflare Worker 基址（由 VITE_AI_CHAT_ENDPOINT 推导） */
export function apiBaseFromChatEndpoint(chatEndpoint: string): string {
  const trimmed = chatEndpoint.trim().replace(/\/+$/u, "");
  if (trimmed.endsWith("/api/chat")) {
    return trimmed.replace(/\/api\/chat$/u, "");
  }
  if (trimmed.endsWith("/api/ragflow/chat")) {
    return trimmed.replace(/\/api\/ragflow\/chat$/u, "");
  }
  return trimmed;
}

export const AI_CHAT_ENDPOINT =
  (import.meta.env.VITE_AI_CHAT_ENDPOINT as string | undefined)?.trim() ||
  (import.meta.env.VITE_RAGFLOW_CHAT_ENDPOINT as string | undefined)?.trim() ||
  "";

export const ENABLE_LIVE_CHAT =
  import.meta.env.VITE_ENABLE_LIVE_CHAT === "1" ||
  import.meta.env.VITE_ENABLE_LIVE_CHAT === "true" ||
  Boolean(AI_CHAT_ENDPOINT);

export type ApiProjectJson = {
  id: string;
  name: string;
  category: string;
  phase: string;
  summary: string;
  guestSummary: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function mapApiProject(row: ApiProjectJson) {
  return {
    id: row.id,
    name: row.name || "未命名项目",
    category: row.category || "未分类",
    phase: normalizeProjectPhase(row.phase),
    summary: row.summary || "",
    guestSummary: row.guestSummary || "",
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function fetchProjectsFromApi(
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<import("@/workspace/projects").WorkspaceProject[]> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  if (!base) return [];
  const res = await fetch(`${base}/api/projects`);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `项目列表加载失败（${res.status}）`);
  }
  const data = (await res.json()) as { projects?: ApiProjectJson[] };
  return (data.projects ?? []).map(mapApiProject);
}

export async function fetchProjectByIdFromApi(
  projectId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<import("@/workspace/projects").WorkspaceProject | null> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  if (!base) return null;
  const res = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `项目加载失败（${res.status}）`);
  }
  const data = (await res.json()) as { project?: ApiProjectJson };
  return data.project ? mapApiProject(data.project) : null;
}

export async function createProjectViaApi(
  input: {
    name: string;
    detail?: string;
    category?: string;
    userId?: string;
  },
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<import("@/workspace/projects").WorkspaceProject> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  if (!base) throw new Error("未配置 VITE_AI_CHAT_ENDPOINT，无法创建项目");
  const res = await fetch(`${base}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      detail: input.detail,
      category: input.category,
      userId: input.userId,
      createdBy: input.userId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    project?: ApiProjectJson;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `创建项目失败（${res.status}）`);
  }
  if (!data.project) throw new Error("创建成功但未返回项目数据");
  return mapApiProject(data.project);
}

export async function updateProjectViaApi(
  projectId: string,
  input: {
    name?: string;
    detail?: string;
    guestSummary?: string;
    category?: string;
    phase?: string;
    userId: string;
  },
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<import("@/workspace/projects").WorkspaceProject> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  if (!base) throw new Error("未配置 VITE_AI_CHAT_ENDPOINT");
  let res: Response;
  try {
    res = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name: input.name,
        detail: input.detail,
        guestSummary: input.guestSummary,
        category: input.category,
        phase: input.phase,
        userId: input.userId,
      }),
    });
  } catch {
    throw new Error("无法连接 API（多为跨域未放行 PATCH）。请确认 Worker 已部署最新版后强刷页面。");
  }
  const data = (await res.json().catch(() => ({}))) as {
    project?: ApiProjectJson;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || `更新项目失败（${res.status}）`);
  if (!data.project) throw new Error("更新成功但未返回项目数据");
  return mapApiProject(data.project);
}

export async function deleteProjectViaApi(
  projectId: string,
  userId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<void> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  if (!base) throw new Error("未配置 VITE_AI_CHAT_ENDPOINT");
  const q = new URLSearchParams({ userId, projectId });
  let res: Response;
  try {
    res = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}?${q}`, {
      method: "DELETE",
    });
  } catch {
    throw new Error("无法连接 API（多为跨域未放行 DELETE）。请确认 Worker 已部署最新版后强刷页面。");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `删除项目失败（${res.status}）`);
}

export type ProjectFileRecord = {
  id: string;
  filename: string;
  scope: "package" | "session";
  conversationId: string | null;
  mime: string | null;
  createdAt: string;
  uploadedBy?: string | null;
  chunkCount: number;
};

/** 项目资料包按 projectId 共享；userId 仅用于拉取该用户的对话临时文件 */
export async function fetchProjectFiles(
  projectId: string,
  userId: string,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<ProjectFileRecord[]> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const q = new URLSearchParams({ userId });
  const res = await fetch(`${base}/api/projects/${projectId}/files?${q}`);
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `资料列表加载失败（${res.status}）`);
  }
  const data = (await res.json()) as { files?: ProjectFileRecord[] };
  return data.files ?? [];
}

export function filterPackageFiles(files: ProjectFileRecord[]): ProjectFileRecord[] {
  return files.filter((f) => f.scope === "package");
}

export function filterConversationSessionFiles(
  files: ProjectFileRecord[],
  conversationId: string,
): ProjectFileRecord[] {
  return files.filter(
    (f) => f.scope === "session" && f.conversationId === conversationId,
  );
}

/** 同名文件保留最新一条，避免重复上传占满列表 */
export function dedupeFilesByFilename(
  files: ProjectFileRecord[],
): ProjectFileRecord[] {
  const byName = new Map<string, ProjectFileRecord>();
  for (const f of files) {
    const prev = byName.get(f.filename);
    if (!prev || f.createdAt > prev.createdAt) {
      byName.set(f.filename, f);
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function uploadProjectPackageFile(
  projectId: string,
  userId: string,
  file: File,
  chatEndpoint = AI_CHAT_ENDPOINT,
): Promise<void> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const form = new FormData();
  form.append("file", file);
  form.append("userId", userId);
  form.append("scope", "package");
  const res = await fetch(`${base}/api/projects/${projectId}/files`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `上传失败（${res.status}）`);
  }
}
