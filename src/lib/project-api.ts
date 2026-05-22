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
