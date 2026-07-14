import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { buildFragmentBatchRequiredReads } from "./knowledge-network-fragment-batch-reads";
import {
  BATCH0_OVERVIEW_META_INSTRUCTION,
  buildFragmentBatchRenderingRecipes,
} from "./knowledge-network-fragment-slot-recipes";

/** Hermes 交付 kb-fragment-batch 时 JSON 字符串内 HTML 的转义约定（防 JSON.parse 失败） */
export const FRAGMENT_BATCH_JSON_ESCAPE_RULES = `
**JSON 内嵌 HTML 转义（必须，否则 Worker 无法解析）**
- \`fragments\` / \`appendixFragments\` 的值是 **JSON 字符串**；HTML 属性里的双引号须写作 \`\\"\`（示例见下方 envelope）
- 禁止在 JSON 字符串值里写未转义的物理换行；需要换行用 \`\\n\` 或压成一行
- 反斜杠须写成 \`\\\\\`；交付前确认整段 \`\`\`json 可被 \`JSON.parse\` 解析
- 若上一轮报「JSON 解析失败」，本轮务必先自检转义再输出，勿重复相同语法错误`;

const FRAGMENT_EXAMPLE = `{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "batchIndex": 0,
  "mode": "full",
  "summary": "本批 1 句摘要",
  "overviewMeta": {
    "lead": "酶法 rPET 再生项目，处于技术验证与产业化前期；资料以简版 BP 为主。",
    "autoSummary": "标的为酶法废弃 PET 再生技术路线，聚焦 PCR 级 rPET 与酶制剂商业化。当前仅有一份简版 BP，客户结构、单位经济与许可路径均未披露，下文以 gap-first 标注待验证项。"
  },
  "sourceProposals": [{ "sourceKey": "prop-new-doc", "type": "用户上传", "title": "新资料名" }],
  "fragments": {
    "snapshot": "<section class=\\"block kb-panel\\" id=\\"snapshot\\"><h2 class=\\"section-title\\"><span class=\\"section-num\\">一</span>项目快照</h2>…</section>"
  },
  "appendixFragments": { "glossary": null, "data-dictionary": null }
}`;

export function buildCompactFragmentBatchWorkflow(params: {
  mode: "initial" | "full";
  batchIndex: number;
  slots: readonly string[];
  repairHints?: string;
}): string {
  const slotList = params.slots.join(", ");
  const repair = params.repairHints?.trim()
    ? `\n【Hard repair only】${params.repairHints}\n只修本批 fragment HTML；资料不足写 gap callout，勿 empty-shell。`
    : "";
  const appendixNote =
    params.batchIndex === KN_SLOT_BATCH_PLAN.length - 1
      ? "\n- Appendix B/C：**优先由同 Job 收尾 Run 全文合成**；本批可 null。若已能写 glossary/data-dictionary 亦可提交。"
      : "\n- appendixFragments 本批可 null。";
  const overviewNote =
    params.batchIndex === 0 ? BATCH0_OVERVIEW_META_INSTRUCTION : "";

  return `

【Fragment-Batch · Compact（${params.mode} · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length}）】
**本批 slot**：${slotList}

**交付**：2–3 行摘要 + **一个** \`\`\`json 代码块（type=**kb-fragment-batch**）。
- 每个本批 slot **必须**有 \`fragments.{slot}\` = 完整 \`<section id="{slot}">…</section>\`。
${FRAGMENT_BATCH_JSON_ESCAPE_RULES}
- 资料足 → 写事实与分析，**不必强行加 gap**；资料不足 → gap-first callout / 表，**禁止** empty-shell。
- citation 仅用已登记 \`#source-{id}\` 或批内 \`sourceProposals.sourceKey\`（Worker 会 rewrite）。
- **禁止**整页 HTML / KB-CONFIG / nav / PUT / structured-slot-batch JSON。${appendixNote}
${buildFragmentBatchRenderingRecipes(params.slots as CanonicalKbSlot[])}${overviewNote}

**示例 envelope**：
\`\`\`json
${FRAGMENT_EXAMPLE}
\`\`\`${repair}`;
}

export function buildMinimalFragmentBatchRepairPrompt(params: {
  repairMessage: string;
  failedSlots: readonly string[];
  batchIndex: number;
  mode: "initial" | "full";
}): string {
  return `【fragment-batch hard repair · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length} · 仅一次】
问题：
${params.repairMessage}
${FRAGMENT_BATCH_JSON_ESCAPE_RULES}

只修 slot：${params.failedSlots.join(", ")}。
仍交付 **kb-fragment-batch** JSON；每 slot 须完整 section HTML；资料不足用 gap callout，禁止 empty-shell。`;
}

/** 非 compact 串行批次的完整 fragment 工作流（D3） */
export function buildHermesFragmentBatchWorkflow(params: {
  mode: "initial" | "full";
  projectTitle: string;
  batchIndex: number;
  totalBatches: number;
  slots: readonly string[];
  repairHints?: string;
  priorSlots?: readonly string[];
}): string {
  const slotList = params.slots.join(", ");
  const prior =
    params.priorSlots?.length ?
      `\n已完成 fragment slot：${params.priorSlots.join(", ")}。本批勿重复输出。`
    : "";
  const repair = params.repairHints?.trim()
    ? `\n\n【Repair】上一轮本批 hard 问题：\n${params.repairHints}\n只修列出的 slot fragment HTML。`
    : "";
  const appendixNote =
    params.batchIndex === KN_SLOT_BATCH_PLAN.length - 1
      ? "\n- Appendix B/C：**优先由同 Job 收尾 Run 全文合成**；本批可 null。若已能写亦可提交。"
      : "\n- `appendixFragments` 本批可 null。";
  const overviewNote =
    params.batchIndex === 0 ? BATCH0_OVERVIEW_META_INSTRUCTION : "";

  return `

【知识网络 · Fragment-Batch（${params.mode} · 批次 ${params.batchIndex + 1}/${params.totalBatches}）】
Worker 已启用 **HTML fragment 分批生成**；**禁止** structured-slot-batch / structured-kb-data / 整页 HTML / PUT。

**本批须交付 slot**：${slotList}${prior}${repair}

**交付格式（必须）**
1. 2–4 行简体中文摘要（本批覆盖内容与证据/缺口）。
2. **一个** \`\`\`json 代码块，type 必须为 \`kb-fragment-batch\`（详见 \`references/kb-fragment-batch-schema.md\` 与 \`examples-kb-fragment-batch.json\`）：
\`\`\`json
${FRAGMENT_EXAMPLE}
\`\`\`

**Fragment 规则**
- 每个本批 slot **必须**有 \`fragments.{slot}\` = 完整 \`<section id="{slot}" class="block kb-panel">…</section>\`。
${FRAGMENT_BATCH_JSON_ESCAPE_RULES}
- 资料足 → 写事实与分析，**不必强行加 gap**；资料不足 → gap-first callout / 表，**禁止** empty-shell。
- citation 仅用已登记 \`#source-{id}\` 或批内 \`sourceProposals.sourceKey\`。
- batch 0 **必须**含 \`overviewMeta\`（lead + autoSummary）；**不要**自报 \`maturity\`（Worker 入库前按公式计算）。
- **禁止** KB-CONFIG / nav / Appendix A/D。${appendixNote}
${buildFragmentBatchRenderingRecipes(params.slots as CanonicalKbSlot[])}${overviewNote}`;
}

export function buildCompactFragmentBatchRequiredReads(
  batchSlots: readonly string[],
  batchIndex?: number,
  mode: "initial" | "full" = "full",
): string {
  const resolvedIndex =
    batchIndex ??
    KN_SLOT_BATCH_PLAN.findIndex(
      (plan) =>
        plan.length === batchSlots.length &&
        plan.every((s) => batchSlots.includes(s)),
    );
  return buildFragmentBatchRequiredReads({
    mode,
    batchIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    batchSlots,
    compact: true,
  });
}

export function buildFragmentBatchRequiredReadsOverride(
  mode: "initial" | "full",
  batchIndex: number,
  batchSlots: readonly string[],
): string {
  return buildFragmentBatchRequiredReads({
    mode,
    batchIndex,
    batchSlots,
    compact: false,
  });
}
