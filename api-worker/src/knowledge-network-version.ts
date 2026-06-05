/** 从上传文件名解析 v5 / v5.5 / v5.55（取最后一个匹配） */
export function parseKnVersionFromFilename(filename: string): string | null {
  const base = filename.replace(/\.html?$/i, "").trim();
  if (!base) return null;
  const re = /\bv(\d+(?:\.\d{1,2})?)\b/gi;
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
  return label && label.length > 0 ? label : String(version);
}
