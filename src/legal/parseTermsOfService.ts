export type BilingualPair = { en: string; zh: string };

export type LegalBlock =
  | { type: "paragraph"; content: string }
  | { type: "bilingual"; en: string; zh: string }
  | { type: "list"; items: string[] }
  | { type: "bilingual-list"; items: BilingualPair[] }
  | { type: "subheading"; title: string; titleZh?: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

/**
 * 从 `terms-of-service-source.txt`（与《JFO.AI Terms of Service（服务条款）》正文一致）解析出的文档结构。
 * 源文件为**自然双语稿**（不修改正文）：前几行为标题与日期，其后为
 * `N. 英文标题 | N. 中文标题` 章节行，正文为英文段与中文段交替、或 `•` 列表、或 `1.` 编号条款等。
 */
export type ParsedTermsDocument = {
  /** 第 1 行，如 JFO.AI Terms of Service（服务条款） */
  docLine1: string;
  /** 第 2 行，如 Terms of Service | 服务条款 */
  docLine2: string;
  lastUpdatedEn: string;
  lastUpdatedZh: string;
  /**
   * 引言段前的双语标题行（与 Word 中 outlineLvl 1 的「Agreement to Our Legal Terms | …」一致），
   * 从第 5 行若含 `|` 且非章节编号则单独抽出。
   */
  introHeading: string | null;
  introBlocks: LegalBlock[];
  sections: LegalSection[];
};

const SECTION_LINE_RE = /^(\d+)\.\s+(.+?)\s*[|｜]\s*\1\.\s+(.+)$/;

export function parseTermsOfServiceSource(raw: string): ParsedTermsDocument {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");

  const docLine1 = (lines[0] ?? "").trim();
  const docLine2 = (lines[1] ?? "").trim();
  const lastUpdatedEn = (lines[2] ?? "").trim();
  const lastUpdatedZh = (lines[3] ?? "").trim();

  const sectionIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_LINE_RE.test(lines[i].trim())) sectionIndices.push(i);
  }

  const firstSection = sectionIndices[0] ?? lines.length;
  const introSlice = lines.slice(4, firstSection);
  let introHeading: string | null = null;
  let introRest = introSlice;
  const firstIntro = introSlice[0]?.trim() ?? "";
  if (
    firstIntro &&
    /\s[|｜]\s/.test(firstIntro) &&
    !/^\d+\.\s/.test(firstIntro)
  ) {
    introHeading = firstIntro;
    introRest = introSlice.slice(1);
  }
  const introBlocks = refineBlocks(parseBodyLines(introRest));

  const sections: LegalSection[] = [];
  for (let s = 0; s < sectionIndices.length; s++) {
    const start = sectionIndices[s];
    const end = sectionIndices[s + 1] ?? lines.length;
    const title = lines[start].trim();
    const bodyLines = lines.slice(start + 1, end);
    const id = sectionIdFromTitle(lines[start]);
    sections.push({ id, title, blocks: refineBlocks(parseBodyLines(bodyLines)) });
  }

  return {
    docLine1,
    docLine2,
    lastUpdatedEn,
    lastUpdatedZh,
    introHeading,
    introBlocks,
    sections,
  };
}

/**
 * 将短双语对提升为 subheading，以贴近 Word 中 outlineLvl 3 + 加粗的小节标题。
 */
function refineBlocks(blocks: LegalBlock[]): LegalBlock[] {
  return blocks.map((b) => {
    if (b.type !== "bilingual") return b;
    if (looksLikeWordSubheading(b.en, b.zh)) {
      return { type: "subheading", title: b.en.trim(), titleZh: b.zh.trim() };
    }
    return b;
  });
}

/** 对应 Word 中较短、加粗、非列表/非编号的小节标题行 */
function looksLikeWordSubheading(en: string, zh: string): boolean {
  const t = en.trim();
  const z = zh.trim();
  if (!t || !z) return false;
  if (t.includes("\n") || z.includes("\n")) return false;
  if (t.length > 72 || z.length > 60) return false;
  if (/^\d+\.\s/.test(t)) return false;
  if (/^[\s•·\u2022]/.test(t)) return false;
  if (t.includes(";")) return false;
  if (t.endsWith(":")) return false;
  if (t.endsWith(".") && t.split(/\s+/).length > 4) return false;
  if (t.split(/\s+/).length > 14) return false;
  if (/^[A-Z0-9\s,.;:'"()\-]{55,}$/.test(t) && t === t.toUpperCase()) return false;
  return true;
}

function sectionIdFromTitle(line: string): string {
  const m = line.trim().match(/^(\d+)\./);
  return `section-${m ? m[1] : "0"}`;
}

function isZhLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const cjk = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const latin = (t.match(/[a-zA-Z]/g) ?? []).length;
  if (cjk >= 4) return true;
  if (latin === 0 && cjk >= 1) return true;
  if (cjk > latin) return true;
  return false;
}

function isBulletLine(s: string): boolean {
  return /^\s*[•·\u2022]/.test(s);
}

function trimBullet(s: string): string {
  return s.trim().replace(/^[•·\u2022]\s*/, "").trim();
}

/** 去掉行首 `1.` / `14.` 等编号（原文中英各编一号时，展示上合并为一条） */
function stripLeadingNumber(s: string): string {
  return s.trim().replace(/^\d+\.\s+/, "").trim();
}

function isNumberedBilingualPair(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const x = a.trim();
  const y = b.trim();
  return /^\d+\.\s/.test(x) && /^\d+\.\s/.test(y) && isZhLine(x) !== isZhLine(y);
}

function parseBodyLines(rawLines: string[]): LegalBlock[] {
  const arr = rawLines.map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim().length > 0);
  const blocks: LegalBlock[] = [];
  let i = 0;

  while (i < arr.length) {
    const a = arr[i];

    if (SECTION_LINE_RE.test(a.trim())) {
      i += 1;
      continue;
    }

    /** 单行内「英文 | 中文」或「英文｜中文」（非章节编号行） */
    if (/\s[|｜]\s/.test(a) && !/^\d+\.\s/.test(a.trim())) {
      const parts = a.split(/\s*[|｜]\s*/);
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        blocks.push({ type: "bilingual", en: parts[0].trim(), zh: parts[1].trim() });
        i += 1;
        continue;
      }
    }

    if (isBulletLine(a)) {
      const items: BilingualPair[] = [];
      let k = i;
      while (k < arr.length) {
        const line = arr[k];
        if (!isBulletLine(line)) break;
        const next = arr[k + 1];
        if (!next) break;
        items.push({ en: trimBullet(line), zh: trimBullet(next) });
        k += 2;
      }
      if (items.length > 0) {
        blocks.push({ type: "bilingual-list", items });
        i = k;
        continue;
      }
    }

    /** 连续「数字编号 + 中英交替」合并为一条 bilingual-list，行首编号去掉（每对仅占一项） */
    if (isNumberedBilingualPair(a, arr[i + 1])) {
      const items: BilingualPair[] = [];
      let k = i;
      while (k < arr.length - 1) {
        const x = arr[k];
        const y = arr[k + 1];
        if (!isNumberedBilingualPair(x, y)) break;
        items.push({ en: stripLeadingNumber(x), zh: stripLeadingNumber(y) });
        k += 2;
      }
      if (items.length > 0) {
        blocks.push({ type: "bilingual-list", items });
        i = k;
        continue;
      }
    }

    const b = arr[i + 1];

    const enRun: string[] = [];
    let j = i;
    while (j < arr.length) {
      const L = arr[j];
      if (SECTION_LINE_RE.test(L.trim())) break;
      if (isBulletLine(L)) break;
      if (
        /^\d+\.\s/.test(L.trim()) &&
        arr[j + 1] &&
        /^\d+\.\s/.test(arr[j + 1].trim()) &&
        isZhLine(L) !== isZhLine(arr[j + 1])
      ) {
        break;
      }
      if (isZhLine(L)) break;
      enRun.push(L);
      j += 1;
    }

    const zhRun: string[] = [];
    while (j < arr.length) {
      const L = arr[j];
      if (SECTION_LINE_RE.test(L.trim())) break;
      if (isBulletLine(L)) break;
      if (/^\d+\.\s/.test(L.trim()) && !isZhLine(L)) break;
      if (!isZhLine(L)) break;
      zhRun.push(L);
      j += 1;
    }

    if (enRun.length && zhRun.length) {
      if (enRun.length === zhRun.length) {
        for (let k = 0; k < enRun.length; k += 1) {
          blocks.push({ type: "bilingual", en: enRun[k], zh: zhRun[k] });
        }
      } else {
        blocks.push({
          type: "bilingual",
          en: enRun.join("\n\n"),
          zh: zhRun.join("\n\n"),
        });
      }
      i = j;
      continue;
    }

    if (enRun.length && !zhRun.length) {
      blocks.push({ type: "paragraph", content: enRun.join("\n\n") });
      i = j;
      continue;
    }

    if (a && b && isZhLine(a) !== isZhLine(b)) {
      blocks.push({
        type: "bilingual",
        en: isZhLine(a) ? b : a,
        zh: isZhLine(a) ? a : b,
      });
      i += 2;
      continue;
    }

    blocks.push({ type: "paragraph", content: a });
    i += 1;
  }

  return blocks;
}
