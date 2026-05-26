/**
 * 资料访问规则：
 * - scope=package：按 projectId 共享（全项目、各账号、各对话共用）
 * - scope=session：按 uploaded_by + conversation_id 隔离
 */

export type DocumentRow = {
  id: string;
  filename: string;
  scope: string;
  conversation_id: string | null;
  mime: string | null;
  r2_key: string;
  uploaded_by: string | null;
  created_at?: string;
};

export function packageR2Key(projectId: string, docId: string, safeName: string): string {
  return `projects/${projectId}/package/${docId}-${safeName}`;
}

export function sessionR2Key(
  projectId: string,
  userId: string,
  conversationId: string,
  docId: string,
  safeName: string,
): string {
  return `projects/${projectId}/users/${userId}/sessions/${conversationId}/${docId}-${safeName}`;
}

/** 网站列表：项目资料包（共享）+ 该用户的对话临时文件 */
export const LIST_FILES_SQL = `
  SELECT d.id, d.filename, d.scope, d.conversation_id, d.mime, d.created_at, d.uploaded_by,
         (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count
  FROM documents d
  WHERE d.project_id = ?
    AND (d.scope = 'package' OR (d.scope = 'session' AND d.uploaded_by = ?))
  ORDER BY d.created_at DESC
  LIMIT 200
`;

/** 对话 RAG：项目资料包（共享）+ 当前用户当前对话的 session */
export const LOAD_CHUNKS_SQL = `
  SELECT c.id, c.document_id, c.chunk_index, c.text, d.filename, d.scope
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  WHERE d.project_id = ?
    AND (
      d.scope = 'package'
      OR (d.scope = 'session' AND d.uploaded_by = ? AND d.conversation_id = ?)
    )
  ORDER BY c.document_id, c.chunk_index
  LIMIT 500
`;

export function isPackageScope(scope: string): boolean {
  return scope !== "session";
}

/** 校验读取权限；通过返回 null，否则返回错误文案 */
export function documentAccessError(
  row: Pick<DocumentRow, "scope" | "uploaded_by">,
  userId: string | null,
): string | null {
  if (isPackageScope(row.scope)) return null;
  if (!userId) return "缺少 userId（对话临时文件须指定上传者）";
  if (row.uploaded_by !== userId) return "文档不存在或无权访问";
  return null;
}
