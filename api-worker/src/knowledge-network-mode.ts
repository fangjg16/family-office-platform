/** 知识网络更新模式：由用户话术判定（对齐 v2.7 knowledge-base-generation） */

export type KnowledgeNetworkUpdateMode = "incremental" | "full" | "reorder";

const FULL_REGENERATE_RE =
  /全量重做|完整重做|从零生成|重新生成|全部重做|整页重做|重做知识网络|regenerate\s+from\s+scratch|full\s+rebuild|rebuild\s+from\s+scratch|scratch\s+build/u;

/** 轻量重排：只改 KB-CONFIG display-order + nav + 章节编号，不重写内容面板 */
const REORDER_DISPLAY_ORDER_RE =
  /调整展示顺序|重排(?:章节|板块|顺序)|(?:章节|板块).{0,8}重排|展示顺序|章节顺序|章节排列|display[\s-]*order|reset\s+display\s+order|把.{0,32}移到.{0,32}(?:前面|之后|后面|前)|把.{0,32}放到.{0,32}(?:前面|之后|后面|前)|将.{0,32}移到|将.{0,32}提前/u;

export function detectKnowledgeNetworkUpdateMode(
  message: string,
): KnowledgeNetworkUpdateMode {
  const m = message.trim();
  if (!m) return "incremental";
  if (FULL_REGENERATE_RE.test(m)) return "full";
  if (REORDER_DISPLAY_ORDER_RE.test(m)) return "reorder";
  return "incremental";
}

/** 仅补充模式说明（文件路径见 buildHermesKnowledgeNetworkFileProtocol） */
export function buildKnowledgeNetworkModeInstructions(
  mode: KnowledgeNetworkUpdateMode,
  hasExisting: boolean,
): string {
  if (mode === "full") {
    return "\n【模式】全量重做 — 见上方文件回路，可跳过 GET 旧版。";
  }
  if (mode === "reorder") {
    return hasExisting
      ? "\n【模式】展示顺序重排 — 必须先 GET 当前版；仅更新 <!-- KB-CONFIG -->（display-order、config-version、display-order-history）、nav 按钮顺序与各 section <h2> 编号；禁止重写内容面板。"
      : "\n【模式】展示顺序重排 — 尚无已发布版，请先完成首次生成并写入 KB-CONFIG，再执行重排。";
  }
  if (!hasExisting) {
    return "\n【模式】首次生成 — 无已发布版；按 project-intake 写入 KB-CONFIG 后渲染，再 PUT。";
  }
  return "\n【模式】增量更新 — 必须先 GET 当前版到工作文件，读取 KB-CONFIG 后局部修改 slot 内容，未改部分保持字节级不变。";
}
