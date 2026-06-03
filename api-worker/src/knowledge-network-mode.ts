/** 知识网络更新模式：由用户话术判定 */

export type KnowledgeNetworkUpdateMode = "incremental" | "full";

const FULL_REGENERATE_RE =
  /全量重做|完整重做|从零生成|重新生成|全部重做|整页重做|重做知识网络|regenerate\s+from\s+scratch|full\s+rebuild|rebuild\s+from\s+scratch|scratch\s+build/u;

export function detectKnowledgeNetworkUpdateMode(
  message: string,
): KnowledgeNetworkUpdateMode {
  const m = message.trim();
  if (!m) return "incremental";
  return FULL_REGENERATE_RE.test(m) ? "full" : "incremental";
}

/** 仅补充模式说明（文件路径见 buildHermesKnowledgeNetworkFileProtocol） */
export function buildKnowledgeNetworkModeInstructions(
  mode: KnowledgeNetworkUpdateMode,
  hasExisting: boolean,
): string {
  if (mode === "full") {
    return "\n【模式】全量重做 — 见上方文件回路，可跳过 GET 旧版。";
  }
  if (!hasExisting) {
    return "\n【模式】首次生成 — 无已发布版，直接写入工作文件后 PUT。";
  }
  return "\n【模式】增量更新 — 必须先 GET 当前版到工作文件，局部修改后 PUT。";
}
