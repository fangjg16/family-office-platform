import { isKnowledgeNetworkReorderIntent } from "./knowledge-network-slot-aliases";

/** 知识网络更新模式：Hermes v2.92 / schema v2.91 */

export type KnowledgeNetworkUpdateMode = "initial" | "incremental" | "full" | "reorder";

const FULL_REGENERATE_RE =
  /全量重做|完整重做|从零生成|重新生成|全部重做|整页重做|重做知识网络|regenerate\s+from\s+scratch|full\s+rebuild|rebuild\s+from\s+scratch|scratch\s+build/u;

export function detectKnowledgeNetworkUpdateMode(
  message: string,
  hasExisting = false,
): KnowledgeNetworkUpdateMode {
  const m = message.trim();
  if (FULL_REGENERATE_RE.test(m)) return "full";
  if (isKnowledgeNetworkReorderIntent(m)) return "reorder";
  if (!hasExisting) return "initial";
  if (!m) return "incremental";
  return "incremental";
}

/** 仅补充模式说明（文件路径见 buildHermesKnowledgeNetworkFileProtocol） */
export function buildKnowledgeNetworkModeInstructions(
  mode: KnowledgeNetworkUpdateMode,
  hasExisting: boolean,
): string {
  if (mode === "full") {
    return "\n【模式】全量重做 — 见上方 structured-kb-data 主路径；按需读取主要项目资料后交付 JSON，由 Worker 渲染入库。PUT/整页 HTML 仅为 fallback。";
  }
  if (mode === "reorder") {
    return hasExisting
      ? "\n【模式】展示顺序重排 — 必须先 GET 当前版；仅更新 <!-- KB-CONFIG -->（display-order、config-version、display-order-history）、nav 按钮顺序与各 section <h2> 编号；禁止重写内容面板；禁止拉取项目资料全文。"
      : "\n【模式】展示顺序重排 — 尚无已发布版，请先完成首次生成并写入 KB-CONFIG，再执行重排。";
  }
  if (mode === "initial" || !hasExisting) {
    return "\n【模式】首次生成 — 无已发布版；先确认 manifest 与主要资料，交付 structured-kb-data JSON，Worker 渲染入库。PUT 仅为 fallback。";
  }
  return "\n【模式】增量更新 — 必须先 GET 当前版到工作文件，读取 KB-CONFIG 后只改用户点名的 slot；仅按需拉取相关资料片段与本对话新附件。";
}
