/**
 * 知识网络生成 · 统一政策（公开检索 / maturity / deep-ref 口径）
 * Fragment 与 structured 主路径须引用此处文案，避免 Prompt 对冲。
 */

/** 公开检索统一口径（Fragment + structured initial/full） */
export const KN_PUBLIC_SEARCH_POLICY_LINES = [
  "【公开检索政策 · 统一】",
  "- **允许**：资料不足以支撑行业/市场/对标/监管背景时，可按 `public-info-search` 补**公开背景**；新公开来源必须进 `sourceProposals`（type 含「公开」），由 Worker 分配 A-N。",
  "- **允许**：用户消息明确要求「查外部资料」/ 联网核实。",
  "- **禁止**：用公开检索编造项目专有事实（交易条款、内部财务、未披露权属、口头承诺等）；项目专有缺口写 gap，勿假充实。",
  "- **禁止**：把公开新闻当作已核实交易证据抬高 Factor；公开源仅作背景 / 待核实线索。",
].join("\n");

/** maturity 统一口径 */
export const KN_MATURITY_POLICY_LINES = [
  "【成熟度政策 · 统一】",
  "- Factor A / B / Combined **由 Worker 在入库前按固定公式计算**；Hermes **不要**在 JSON 里自报 `maturity` 分数，也勿用自评约束正文。",
  "- Hermes 只负责：写清事实 / gap / 引用；Worker 从 fragment HTML + Source Registry 提取证据信号后打分。",
  "- `overviewMeta.lead` / `autoSummary`（batch 0）仍由 Hermes 合成 masthead 文案；与分数无关。",
].join("\n");

/** deep-ref 注入口径说明（给人/测试对齐，非截断逻辑本身） */
export const KN_DEEP_REF_POLICY_LINES = [
  "【Deep ref 注入口径 · 统一】",
  "- Fragment 每批注入：本批 slot → `DEEP_REFS_BY_SLOT` 的**并集**（短卡片）；**不**默认截断为 2。",
  "- `injectionMeta.deepRefCount` 必须等于实际注入条数。",
  "- 短 deep ref ≠ 完整 Skill；完整方法仅在动态路由触发时额外 read（见 workflow-routing）。",
].join("\n");

export function knPublicSearchMaterialsLine(mode: "initial" | "full" | "incremental" | "reorder"): string {
  if (mode === "reorder") {
    return "资料：**禁止**拉取项目资料包与 deep refs；只读当前 KB + kb-config.md。";
  }
  if (mode === "incremental") {
    return (
      "资料：当前 KB + 点名 slot 相关资料片段 + session 附件（按需 textUrl）。" +
      "\n" +
      KN_PUBLIC_SEARCH_POLICY_LINES
    );
  }
  return (
    "资料：jfo-r2-materials manifest 后按需读取主要项目资料与本对话 session 附件。" +
    "\n" +
    KN_PUBLIC_SEARCH_POLICY_LINES
  );
}
