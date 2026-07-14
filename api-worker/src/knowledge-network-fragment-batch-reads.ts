import { KN_SLOT_BATCH_PLAN } from "./knowledge-network-slot-batch-types";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { isCanonicalKbSlot } from "./knowledge-network-fragment-validation";
import { resolveDeepRefsForBatchSlots } from "./knowledge-network-deep-refs";
import {
  KN_PUBLIC_SEARCH_POLICY_LINES,
  KN_MATURITY_POLICY_LINES,
  KN_DEEP_REF_POLICY_LINES,
} from "./knowledge-network-kn-policy";

/** 按本批 slot 挂载的 fragment JSON 样例（与 Codex sample-output 对齐） */
export function resolveFragmentBatchExampleFiles(
  slots: readonly CanonicalKbSlot[],
): readonly string[] {
  const out: string[] = [];
  const has = (s: CanonicalKbSlot) => slots.includes(s);

  if (has("business-operations") || has("legal-ownership") || has("regulatory-compliance")) {
    out.push("examples-kb-fragment-batch-business-ops.json");
  }
  if (has("resource-network") || has("comps-benchmark")) {
    out.push("examples-kb-fragment-batch-resource-comps.json");
  }
  if (has("valuation-returns")) {
    out.push("examples-kb-fragment-batch-valuation.json");
  }
  if (has("diligence-gaps") || has("risks-mitigation")) {
    out.push("examples-kb-fragment-batch-risks-diligence.json");
  }
  if (has("timeline-milestones") || has("decision-framework")) {
    out.push("examples-kb-fragment-batch-timeline-decision.json");
  }
  return [...new Set(out)];
}

const EXAMPLE_LABELS: Record<string, string> = {
  "examples-kb-fragment-batch-business-ops.json":
    "业务模式 journey-wrap + 法律/监管表或 gap",
  "examples-kb-fragment-batch-resource-comps.json": "资源网络 + 市场对标表",
  "examples-kb-fragment-batch-valuation.json": "valuation-grid + scenario-cards",
  "examples-kb-fragment-batch-risks-diligence.json": "details.oq-group + 风险矩阵",
  "examples-kb-fragment-batch-timeline-decision.json":
    "时间轴 8.1–8.3 + 决策框架（B/C 由同 Job 收尾 Run 写）",
};

export function buildFragmentBatchRequiredReads(params: {
  mode: "initial" | "full";
  batchIndex: number;
  batchSlots: readonly string[];
  compact?: boolean;
}): string {
  const slots = params.batchSlots as CanonicalKbSlot[];
  const deepRefs = resolveDeepRefsForBatchSlots(slots);
  const extraExamples = resolveFragmentBatchExampleFiles(slots);
  const compactLabel = params.compact ? "Compact " : "";

  const lines: string[] = [
    "",
    `【知识网络 · ${compactLabel}Fragment-Batch 必读（${params.mode} · 批次 ${params.batchIndex + 1}/${KN_SLOT_BATCH_PLAN.length} · ${params.batchSlots.join(", ")}）】`,
    "本批 read_file 下列文件 + 动态 Workflow（若指令中另有列出）；禁止拉全量 structured-kb-data / PUT 脚本。",
    KN_DEEP_REF_POLICY_LINES,
    KN_MATURITY_POLICY_LINES,
    "1. read_file `references/kb-fragment-batch-schema.md`",
    "2. read_file `references/kb-schema.md`（slot 边界与 Primary writers）",
    "3. read_file `references/content-rules.md`（事实路由到 canonical slot）",
    "4. read_file `references/slot-rendering-rules.md`",
    "5. read_file `references/slot-specific-rules.md`",
    "6. read_file `examples-kb-fragment-batch.json`",
    "7. read_file `assets/components.html`（对照 class；食谱内已含本批 HTML 骨架）",
  ];

  let n = 8;

  if (params.batchIndex === 0) {
    lines.push(`${n++}. read_file \`references/kb-config.md\`（projectType / display-order）`);
  }

  for (const file of extraExamples) {
    const label = EXAMPLE_LABELS[file] ?? file;
    lines.push(`${n++}. read_file \`${file}\`（${label}）`);
  }

  if (slots.includes("timeline-milestones")) {
    lines.push(`${n++}. read_file \`references/timeline-rules.md\``);
  }

  for (const ref of deepRefs) {
    lines.push(`${n++}. read_file \`${ref}\``);
  }

  lines.push("", KN_PUBLIC_SEARCH_POLICY_LINES);
  lines.push(
    "资料事实以 Worker **Evidence Inventory / Source Registry** 为准；按本批渲染食谱写 HTML，缺资料写 gap，勿 empty-shell。",
  );

  return lines.join("\n");
}

export function buildFragmentIncrementalRequiredReads(slot: string): string {
  const canonicalSlot = isCanonicalKbSlot(slot) ? slot : null;
  const deepRefs = canonicalSlot ? resolveDeepRefsForBatchSlots([canonicalSlot]) : [];
  const extraExamples = canonicalSlot ? resolveFragmentBatchExampleFiles([canonicalSlot]) : [];
  const lines: string[] = [
    "",
    `【知识网络 · Fragment 增量必读 · slot=${slot}】`,
    KN_PUBLIC_SEARCH_POLICY_LINES,
    KN_MATURITY_POLICY_LINES,
    "1. read_file `references/kb-fragment-batch-schema.md`",
    "2. read_file `references/slot-rendering-rules.md`",
    "3. read_file `references/slot-specific-rules.md`",
  ];
  let n = 4;
  for (const file of extraExamples) {
    lines.push(`${n++}. read_file \`${file}\``);
  }
  for (const ref of deepRefs) {
    lines.push(`${n++}. read_file \`${ref}\``);
  }
  return lines.join("\n");
}

/** 实际将注入的 short deep ref 条数（与 buildFragmentBatchRequiredReads 一致） */
export function countFragmentBatchDeepRefs(batchSlots: readonly string[]): number {
  return resolveDeepRefsForBatchSlots(batchSlots as CanonicalKbSlot[]).length;
}
