/** chat_sync PUT 时保护 agent job 相关消息不被误删/误覆盖 */

export function isJobScopedMessageId(messageId: string): boolean {
  return /^user-job-/u.test(messageId) || /^assistant-job-/u.test(messageId);
}

export function jobIdFromScopedMessageId(messageId: string): string | null {
  const userMatch = /^user-job-(.+)$/u.exec(messageId);
  if (userMatch?.[1]) return userMatch[1];
  const assistantMatch = /^assistant-job-(.+)$/u.exec(messageId);
  if (assistantMatch?.[1]) return assistantMatch[1];
  return null;
}

export function isAgentJobStatusActive(status: string | null | undefined): boolean {
  return status === "pending" || status === "running";
}

export type MessageProtectionRow = {
  id: string;
  pending_job_id?: string | null;
};

/** 普通 chat_sync 不得删除该消息 */
export function shouldProtectMessageFromSyncDelete(
  row: MessageProtectionRow,
  jobStatusById: ReadonlyMap<string, string>,
): boolean {
  const pending = (row.pending_job_id ?? "").trim();
  if (pending && isAgentJobStatusActive(jobStatusById.get(pending))) {
    return true;
  }
  const scopedJobId = jobIdFromScopedMessageId(row.id);
  if (scopedJobId && isAgentJobStatusActive(jobStatusById.get(scopedJobId))) {
    return true;
  }
  return false;
}

/** 活跃 job 的 pending 行不得被客户端快照清空 pendingJobId */
export function shouldSkipSyncUpsertOverwrite(
  existing: MessageProtectionRow & { pending_job_id?: string | null },
  incoming: { pendingJobId?: string | null },
  jobStatusById: ReadonlyMap<string, string>,
): boolean {
  if (!shouldProtectMessageFromSyncDelete(existing, jobStatusById)) return false;
  const existingPending = (existing.pending_job_id ?? "").trim();
  const incomingPending =
    typeof incoming.pendingJobId === "string" ? incoming.pendingJobId.trim() : "";
  return Boolean(existingPending && !incomingPending);
}
