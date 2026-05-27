import type { LiveChatMessage } from "@/workspace/chat-types";

function timestampFromMessageId(id: string): number {
  if (/^assistant-job-/u.test(id)) return Number.MAX_SAFE_INTEGER;
  const m = /^user-(\d+)$/u.exec(id) ?? /^assistant-(\d+)$/u.exec(id);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function messageSortKey(m: LiveChatMessage): number {
  const idx = m.sortIndex;
  if (idx != null) return idx * 1e15 + parseTimeLabel(m.time);
  return parseTimeLabel(m.time) || timestampFromMessageId(m.id);
}

/** 解析 getCurrentDateTimeLabel / 云端 time_label / ISO */
export function parseTimeLabel(label: string | undefined): number {
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

/** 侧栏日期：统一为 2026/5/27 */
export function formatSidebarDateLabel(raw: string | undefined): string {
  const ts = parseTimeLabel(raw);
  if (ts > 0) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(new Date(ts));
  }
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.includes("T")) {
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(new Date(parsed));
    }
    return s.slice(0, 10);
  }
  return s.split(/\s+/u)[0] ?? s;
}

/** 气泡悬停时间：HH:mm */
export function formatBubbleTimeLabel(raw: string | undefined): string {
  const ts = parseTimeLabel(raw);
  if (ts > 0) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  }
  const s = (raw ?? "").trim();
  const zh = /\b(\d{1,2}):(\d{2})\b/u.exec(s);
  if (zh) return `${zh[1].padStart(2, "0")}:${zh[2]}`;
  if (s.includes("T")) {
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(parsed));
    }
  }
  return "";
}

export function latestMessageTimeLabel(msgs: LiveChatMessage[] | undefined): string {
  if (!msgs?.length) return "";
  let best = msgs[0]!;
  let bestKey = messageSortKey(best);
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]!;
    const k = messageSortKey(m);
    if (k >= bestKey) {
      bestKey = k;
      best = m;
    }
  }
  return (best.time ?? "").trim();
}
