import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { SLOT_DEFAULT_TITLES } from "./knowledge-network-slot-render";

const FRAGMENT_EXAMPLE = `{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "batchIndex": 0,
  "mode": "full",
  "summary": "本批 1 句摘要",
  "maturity": {
    "factorA": "18%",
    "factorB": "12%",
    "combined": "16%",
    "tier": "Early",
    "factorANote": "13-slot 保守均值",
    "factorBNote": "单一 BP 来源"
  },
  "sourceProposals": [{ "sourceKey": "prop-new-doc", "type": "用户上传", "title": "新资料名" }],
  "fragments": {
    "snapshot": "<section class=\\"block kb-panel\\" id=\\"snapshot\\"><h2 class=\\"section-title\\"><span class=\\"section-num\\">一</span>项目快照</h2>…</section>"
  },
  "appendixFragments": { "glossary": null, "data-dictionary": null }
}`;

const FRAGMENT_HTML_RULES = `
**HTML 版式（硬约束 · L1 校验）**
- 每个 slot 的 \`<h2 class="section-title"><span class="section-num">中文序号</span>标题</h2>\` **必须**与 slot-rendering-rules 一致（一…十三，**禁止**阿拉伯数字 1/2/3）。
- **禁止**在 \`<h2>\` 或正文首段写 \`A · 38%\` / \`C · 22%\` 等成熟度字母分；成熟度 **只**写在 JSON \`maturity\` 字段（batch 0 必填）。
- **禁止**用 emoji（⚠️🔍🔴🟡）充当标题或严重度；警示用 \`<aside class="callout warning">\`，严重度用 \`<span class="risk-level risk-level-high">高</span>\`。
- 风险 / 时间轴 / 决策 / 尽调 slot 必须复用 \`assets/components.html\` 约定结构（见本批 Slot 组件提示）。`;

export function buildFragmentSlotComponentHints(slots: readonly CanonicalKbSlot[]): string {
  const lines: string[] = [
    "",
    "【本批 Slot HTML 组件提示 · 必读 components.html + slot-rendering-rules】",
  ];
  for (const slot of slots) {
    const d = SLOT_DEFAULT_TITLES[slot];
    lines.push(`- **${slot}**：标题 \`<span class="section-num">${d.num}</span>${d.title}\``);
    if (slot === "risks-mitigation") {
      lines.push(
        "  · 风险表严重度列：`<span class=\"risk-level risk-level-high\">高</span>`（禁止 🔴 emoji）",
      );
    }
    if (slot === "timeline-milestones") {
      lines.push(
        "  · 三段式：h3「8.1/8.2/8.3」+ `<div class=\"timeline project-timeline\">` + `tl-item`",
      );
    }
    if (slot === "decision-framework") {
      lines.push("  · `<aside class=\"callout info\">` 建议 + Go/No-Go 表或 scenario-cards");
    }
    if (slot === "diligence-gaps") {
      lines.push("  · `<div class=\"oq-group\">` + 问题表（禁止纯 emoji 段落）");
    }
  }
  return lines.join("\n");
}

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
${FRAGMENT_HTML_RULES}
${buildFragmentSlotComponentHints(params.slots as CanonicalKbSlot[])}

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
- batch 0 **必须**含 \`maturity\`（factorA/factorB/combined 为百分比或 —，按 \`references/maturity-scoring.md\` 自评）；Worker **不会**重算或 repair 成熟度。
- **禁止** KB-CONFIG / nav / Appendix A/D。${appendixNote}
${FRAGMENT_HTML_RULES}
${buildFragmentSlotComponentHints(params.slots as CanonicalKbSlot[])}`;
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
    "3. read_file `references/slot-specific-rules.md`",
    "4. read_file `examples-kb-fragment-batch.json`",
    "5. read_file `assets/components.html`",
  ];
  deepRefs.forEach((ref, i) => lines.push(`${i + 6}. read_file \`${ref}\``));
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
