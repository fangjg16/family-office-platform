import type { LiveChatMessage } from "@/workspace/chat-types";

function parseTimeLabel(label: string | undefined): number {
  const raw = (label ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\//gu, "-");
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? 0 : t;
}

/** 对话气泡按时间正序（旧在上、新在下） */
export function sortMessagesChronologically(
  messages: LiveChatMessage[],
): LiveChatMessage[] {
  return [...messages].sort((a, b) => {
    const dt = parseTimeLabel(a.time) - parseTimeLabel(b.time);
    if (dt !== 0) return dt;
    return a.id.localeCompare(b.id);
  });
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
