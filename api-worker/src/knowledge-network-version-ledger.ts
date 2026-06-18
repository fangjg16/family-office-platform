import { formatKnVersionDisplay } from "./knowledge-network-version";
import { workspaceUserDisplayName } from "./workspace-display-names";

export type KnVersionLedgerRow = {
  version: string;
  time: string;
  parent: string;
  source: string;
  change: string;
};

export type KnVersionLedgerEntry = {
  version: number;
  versionLabel: string | null;
  updatedAt: string;
  updatedBy: string;
  changelog: string | null;
};

const VERSION_LEDGER_TBODY_RE =
  /(<section[^>]*\bid=["']version-ledger["'][^>]*>[\s\S]*?<table[^>]*>[\s\S]*?<tbody>)([\s\S]*?)(<\/tbody>)/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatKnVersionTag(version: number, versionLabel: string | null): string {
  const display = formatKnVersionDisplay(version, versionLabel);
  return /^v/i.test(display) ? display : `v${display}`;
}

export function formatKnLedgerTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 16).replace("T", " ");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function inferKnVersionLedgerSource(
  updatedBy: string,
  changelog: string | null,
): string {
  const note = (changelog ?? "").trim();
  const lower = note.toLowerCase();
  if (lower.includes("hermes")) return "Hermes";
  if (note.includes("本地上传")) return "本地上传";
  if (note.includes("回填")) return "平台回填";
  const name = workspaceUserDisplayName(updatedBy);
  return name || updatedBy || "平台";
}

/** 按时间顺序（旧→新）合并归档版与当前版，生成附录 D 行 */
export function buildKnVersionLedgerRows(
  archivedAsc: KnVersionLedgerEntry[],
  current: KnVersionLedgerEntry | null,
): KnVersionLedgerRow[] {
  const all: KnVersionLedgerEntry[] = [...archivedAsc];
  if (current) {
    const last = all[all.length - 1];
    if (
      !last ||
      last.version !== current.version ||
      last.updatedAt !== current.updatedAt
    ) {
      all.push(current);
    }
  }

  const rows: KnVersionLedgerRow[] = [];
  let parentTag: string | null = null;
  for (const entry of all) {
    const versionTag = formatKnVersionTag(entry.version, entry.versionLabel);
    const change = (entry.changelog ?? "").trim() || `版本 ${versionTag} 更新`;
    rows.push({
      version: versionTag,
      time: formatKnLedgerTime(entry.updatedAt),
      parent: parentTag ?? "none",
      source: inferKnVersionLedgerSource(entry.updatedBy, entry.changelog),
      change,
    });
    parentTag = versionTag;
  }
  return rows;
}

function renderVersionLedgerTbody(rows: KnVersionLedgerRow[]): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.version)}</td><td>${escapeHtml(row.time)}</td><td>${escapeHtml(row.parent)}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.change)}</td></tr>`,
    )
    .join("");
}

function renderVersionLedgerTable(rows: KnVersionLedgerRow[]): string {
  return `<table><thead><tr><th>版本</th><th>时间</th><th>父版本</th><th>来源</th><th>变更摘要</th></tr></thead><tbody>${renderVersionLedgerTbody(rows)}</tbody></table>`;
}

function renderVersionLedgerSectionBody(rows: KnVersionLedgerRow[]): string {
  return `<h2 class="section-title"><span class="section-num">D</span>附录 D · 版本记录</h2>${renderVersionLedgerTable(rows)}`;
}

const VERSION_LEDGER_SECTION_RE =
  /(<section[^>]*\bid=["']version-ledger["'][^>]*>)([\s\S]*?)(<\/section>)/i;

export function injectKnVersionLedger(
  html: string,
  rows: KnVersionLedgerRow[],
): { html: string; applied: boolean } {
  if (rows.length === 0) {
    return { html, applied: false };
  }

  if (VERSION_LEDGER_TBODY_RE.test(html)) {
    const tbody = renderVersionLedgerTbody(rows);
    return {
      html: html.replace(VERSION_LEDGER_TBODY_RE, `$1${tbody}$3`),
      applied: true,
    };
  }

  if (!VERSION_LEDGER_SECTION_RE.test(html)) {
    return { html, applied: false };
  }

  return {
    html: html.replace(
      VERSION_LEDGER_SECTION_RE,
      `$1${renderVersionLedgerSectionBody(rows)}$3`,
    ),
    applied: true,
  };
}

export function mergeKnVersionLedgerHtml(
  html: string,
  archivedAsc: KnVersionLedgerEntry[],
  current: KnVersionLedgerEntry | null,
): { html: string; applied: boolean; rowCount: number } {
  const rows = buildKnVersionLedgerRows(archivedAsc, current);
  const injected = injectKnVersionLedger(html, rows);
  return { ...injected, rowCount: rows.length };
}
