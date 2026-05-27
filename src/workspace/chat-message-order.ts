import type { LiveChatMessage } from "@/workspace/chat-types";
import { parseTimeLabel } from "@/workspace/chat-time";

function timestampFromMessageId(id: string): number {
  if (/^assistant-job-/u.test(id)) return Number.MAX_SAFE_INTEGER;
  const m = /^user-(\d+)$/u.exec(id) ?? /^assistant-(\d+)$/u.exec(id);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function compareMessages(a: LiveChatMessage, b: LiveChatMessage): number {
  const ai = a.sortIndex;
  const bi = b.sortIndex;
  if (ai != null && bi != null && ai !== bi) return ai - bi;

  const dt = parseTimeLabel(a.time) - parseTimeLabel(b.time);
  if (dt !== 0) return dt;

  const idt = timestampFromMessageId(a.id) - timestampFromMessageId(b.id);
  if (idt !== 0) return idt;

  if (a.role !== b.role) {
    return a.role === "user" ? -1 : 1;
  }

  return a.id.localeCompare(b.id);
}

/** 对话气泡按时间正序（旧在上、新在下） */
export function sortMessagesChronologically(
  messages: LiveChatMessage[],
): LiveChatMessage[] {
  return [...messages].sort(compareMessages);
}

export function sortMessagesByConversation(
  map: Record<string, LiveChatMessage[]>,
): Record<string, LiveChatMessage[]> {
  const out: Record<string, LiveChatMessage[]> = {};
  for (const [key, list] of Object.entries(map)) {
    if (!Array.isArray(list) || list.length === 0) continue;
    out[key] = sortMessagesChronologically(list);
  }
  return out;
}

/** 新消息追加时写入递增 sortIndex，刷新后与云端一致 */
export function appendMessageWithSortIndex(
  list: LiveChatMessage[],
  message: LiveChatMessage,
): LiveChatMessage[] {
  const maxIdx = list.reduce((max, m) => Math.max(max, m.sortIndex ?? -1), -1);
  return [...list, { ...message, sortIndex: maxIdx + 1 }];
}
