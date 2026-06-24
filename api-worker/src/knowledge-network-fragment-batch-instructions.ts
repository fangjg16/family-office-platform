import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";

const FRAGMENT_EXAMPLE = `{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "batchIndex": 0,
  "mode": "full",
  "summary": "本批 1 句摘要",
  "sourceProposals": [{ "sourceKey": "prop-new-doc", "type": "用户上传", "title": "新资料名" }],
  "fragments": {
    "snapshot": "<section class=\\"block kb-panel\\" id=\\"snapshot\\">…完整 section…</section>"
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
    ? `\n【Hard repair only】${params.repairHints}\n只修本批 fragment HTML（L1/L2/L3）；资料不足写 gap callout，勿 empty-shell。`
    : "";
  const appendixNote =
    params.batchIndex === KN_SLOT_BATCH_PLAN.length - 1
      ? "\n- 本批须同时交付 **appendixFragments.glossary** 与 **appendixFragments.data-dictionary** 完整 section。"
      : "\n- appendixFragments 本批可 null。";

  return `

【Fragment-Batch · Compact（${params.mode} · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length}）】
**本批 slot**：${slotList}

**交付**：2–3 行摘要 + **一个** \`\`\`json 代码块（type=**kb-fragment-batch**）。
- 每个本批 slot **必须**有 \`fragments.{slot}\` = 完整 \`<section id="{slot}">…</section>\`。
- 资料足 → 写事实与分析，**不必强行加 gap**；资料不足 → gap-first callout / 表，**禁止** empty-shell。
- citation 仅用已登记 \`#source-{id}\` 或批内 \`sourceProposals.sourceKey\`（Worker 会 rewrite）。
- **禁止**整页 HTML / KB-CONFIG / nav / PUT / structured-slot-batch JSON。${appendixNote}

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
      ? "\n- **本批必须**同时交付 `appendixFragments.glossary` 与 `appendixFragments.data-dictionary` 完整 `<section>`。"
      : "\n- `appendixFragments` 本批可 null。";

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
- 资料足 → 写事实与分析，**不必强行加 gap**；资料不足 → gap-first callout / 表，**禁止** empty-shell。
- citation 仅用已登记 \`#source-{id}\` 或批内 \`sourceProposals.sourceKey\`。
- batch 0 可写 \`summary\`；**禁止** KB-CONFIG / nav / maturity / Appendix A/D。${appendixNote}
- maturity / Factor A **由 Worker 入库后计算**；Hermes 勿自评最终分数。`;
}

export function buildCompactFragmentBatchRequiredReads(batchSlots: readonly string[]): string {
  const deepRefs = batchSlots.includes("timeline-milestones") || batchSlots.includes("decision-framework")
    ? ["references/deep/knowledge-base-generation.md"]
    : [];
  const lines = [
    "",
    `【知识网络 · Compact Fragment-Batch（${batchSlots.join(", ")}）】`,
    "本批 **只** read_file 下列文件；禁止拉全量 structured examples / PUT 脚本。",
    "1. read_file `references/kb-fragment-batch-schema.md`",
    "2. read_file `references/slot-rendering-rules.md`",
    "3. read_file `examples-kb-fragment-batch.json`",
  ];
  deepRefs.forEach((ref, i) => lines.push(`${i + 4}. read_file \`${ref}\``));
  lines.push(
    "",
    "资料事实以 Worker 预处理 **Evidence Inventory / Source Registry** 为准；缺资料写 gap callout，勿 empty-shell。",
  );
  return lines.join("\n");
}

export function buildFragmentBatchRequiredReadsOverride(
  mode: "initial" | "full",
  batchIndex: number,
  batchSlots: readonly string[],
): string {
  return [
    "",
    `【知识网络 · Fragment-Batch 必读（${mode} · 批次 ${batchIndex + 1} · ${batchSlots.join(", ")}）】`,
    "1. read_file `references/kb-fragment-batch-schema.md`",
    "2. read_file `references/slot-specific-rules.md`",
    "3. read_file `references/slot-rendering-rules.md`",
    "4. read_file `examples-kb-fragment-batch.json`",
    batchIndex === KN_SLOT_BATCH_PLAN.length - 1
      ? "5. read_file `references/kb-schema.md`（附录 B/C section 结构）"
      : "",
    "",
    "交付 **kb-fragment-batch** JSON only；禁止 structured-slot-batch / 整页 HTML。",
  ]
    .filter(Boolean)
    .join("\n");
}
