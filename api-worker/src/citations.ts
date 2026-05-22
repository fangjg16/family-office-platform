/** 各项目引用槽位：回答中的 [ID:n] 对应展示名与前端颜色 */
export type CitationSlot = {
  id: string;
  title: string;
  color: "purple" | "green" | "blue" | "yellow" | "gray";
};

const PROJECT_CITATIONS: Record<string, CitationSlot[]> = {
  "nn-fresh-port": [
    { id: "1", title: "《南宁生鲜食品智慧港项目介绍.pdf》", color: "purple" },
    { id: "2", title: "《尽调报告二 南宁东盟生鲜食品智慧港.pdf》", color: "green" },
    { id: "3", title: "《尽调报告一 嘉兴中润海盐冷链产业园区.pdf》", color: "blue" },
    { id: "4", title: "《嘉兴中润项目推介.pdf》", color: "yellow" },
  ],
};

export function getCitationSlots(projectId: string): CitationSlot[] {
  return PROJECT_CITATIONS[projectId] ?? [];
}

export function citationMapFromSlots(slots: CitationSlot[]): Record<string, string> {
  return Object.fromEntries(slots.map((s) => [s.id, s.title]));
}

export function buildCitationSystemLines(slots: CitationSlot[]): string {
  if (slots.length === 0) {
    return "本项目暂无预置引用编号；若资料摘录中有 [ID:n]，请与摘录标题一致。";
  }
  return slots.map((s) => `[ID:${s.id}] ${s.title}`).join("\n");
}

/** 按上传文件名对齐预置引用（勿用检索结果下标硬套 [ID:1][ID:2]） */
export function matchCitationSlot(
  slots: CitationSlot[],
  filename: string,
): CitationSlot | undefined {
  if (!filename || slots.length === 0) return undefined;
  const f = filename.toLowerCase().replace(/\s+/gu, "");

  for (const slot of slots) {
    const core = slot.title
      .replace(/[《》]/gu, "")
      .replace(/\.pdf$/iu, "")
      .toLowerCase()
      .replace(/\s+/gu, "");
    if (core.length >= 4 && (f.includes(core) || core.includes(f.replace(/\.pdf$/iu, "")))) {
      return slot;
    }
  }

  if (/尽调报告二|东盟生鲜.*智慧港/u.test(filename)) {
    return slots.find((s) => s.id === "2");
  }
  if (/项目介绍/u.test(filename)) {
    return slots.find((s) => s.id === "1");
  }
  if (/尽调报告一|嘉兴中润海盐/u.test(filename)) {
    return slots.find((s) => s.id === "3");
  }
  if (/嘉兴中润项目推介/u.test(filename)) {
    return slots.find((s) => s.id === "4");
  }

  return undefined;
}
