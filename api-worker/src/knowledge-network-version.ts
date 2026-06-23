/** 从上传文件名解析 v5 / v5.5 / v5.55（取最后一个匹配） */
export function parseKnVersionFromFilename(filename: string): string | null {
  const base = filename.replace(/\.html?$/i, "").trim();
  if (!base) return null;
  // \b 匹配空格/连字符前；_v 覆盖 draft_v1_final_v2.1 类文件名
  const re = /(?:\b|_)v(\d+(?:\.\d{1,2})?)\b/gi;
  let last: string | null = null;
  for (const m of base.matchAll(re)) {
    if (m[1]) last = m[1];
  }
  return last;
}

export type KnVersionPrev = {
  version: number;
  versionLabel: string | null;
};

/** 当前展示版的小数点前整数部分（无 label 时用内部 version） */
export function knVersionDisplayMajor(prev: KnVersionPrev): number {
  if (prev.versionLabel?.trim()) {
    const m = /^(\d+)/.exec(prev.versionLabel.trim());
    if (m) return parseInt(m[1], 10);
    const f = parseFloat(prev.versionLabel);
    if (!Number.isNaN(f)) return Math.floor(f);
  }
  return prev.version;
}

/**
 * 本地上传：有文件名版本 → 用该 label；否则展示版 major+1。
 * 内部 version 始终 prev+1，供归档路径与主键。
 */
export function resolveKnVersionOnUpload(
  prev: KnVersionPrev | null,
  uploadFileName?: string | null,
): { version: number; versionLabel: string } {
  const nextSeq = (prev?.version ?? 0) + 1;
  const fromFile = uploadFileName?.trim()
    ? parseKnVersionFromFilename(uploadFileName)
    : null;
  if (fromFile) {
    return { version: nextSeq, versionLabel: fromFile };
  }
  const major = prev ? knVersionDisplayMajor(prev) : 0;
  return { version: nextSeq, versionLabel: String(major + 1) };
}

export function formatKnVersionDisplay(version: number, versionLabel: string | null): string {
  const label = versionLabel?.trim();
  if (label && label.length > 0) {
    // 整数展示版落后于内部 version 时（Worker 自动递增），以 version 为准
    if (!label.includes(".")) {
      const labelInt = parseInt(label, 10);
      if (!Number.isNaN(labelInt) && version > labelInt) {
        return String(version);
      }
    }
    return label;
  }
  return String(version);
}

/** 将 HTML masthead 中的 Version / AI badge 替换为 D1 展示版本（非 schema meta.version） */
export function applyKbVersionDisplay(
  html: string,
  versionDisplay: string,
  schemaVersion = "2.91",
): string {
  const label = versionDisplay.startsWith("v") ? versionDisplay : `v${versionDisplay}`;
  const badge = `${label} · schema ${schemaVersion}`;
  let out = html.replace(
    /(<dt>\s*Version\s*<\/dt>\s*<dd>)[^<]+(<\/dd>)/i,
    `$1${label}$2`,
  );
  out = out.replace(/(AI-Generated · )[^<]+(<\/span>)/i, `$1${badge}$2`);
  return out;
}
