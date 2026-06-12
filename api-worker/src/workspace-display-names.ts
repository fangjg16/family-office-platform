const DISPLAY_NAMES: Record<string, string> = {
  "candice-guo": "CandiceGuo",
  "jimmy-huang": "JimmyHuang",
  "jessica-hu": "JessicaHu",
  "jensen-fang": "JensenFang",
  "janice-hi": "JaniceHi",
  "binghe-su": "BingheSu",
};

export function workspaceUserDisplayName(userId: string): string {
  const id = userId.trim();
  return DISPLAY_NAMES[id] ?? id;
}
