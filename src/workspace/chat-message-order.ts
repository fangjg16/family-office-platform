import type { LiveChatMessage } from "@/workspace/chat-types";

/** 解析 getCurrentDateTimeLabel / 云端 time_label（如 2026/5/27 10:30） */
function parseTimeLabel(label: string | undefined): number {
  const raw = (label ?? "").trim();
  if (!raw) return 0;

  const zh = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})/u.exec(raw);
  if (zh) {
    const y = Number(zh[1]);
    const mo = Number(zh[2]);
    const d = Number(zh[3]);
    const h = Number(zh[4]);
    const mi = Number(zh[5]);
    return new Date(y, mo - 1, d, h, mi).getTime();
  }

  const t = Date.parse(raw.replace(/\//gu, "-"));
  return Number.isNaN(t) ? 0 : t;
}

function timestampFromMessageId(id: string): number {
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
