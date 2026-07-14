import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import { KN_MATURITY_POLICY_LINES } from "./knowledge-network-kn-policy";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

const THIN_APPENDIX_CHARS = 400;
const STUB_RE = /worker-gap-stub|data-worker-stub|缺乏资料|待补充术语|待补充数据字典/i;

/** 13 slot 压缩全文总预算（字符）；超出则按 slot 均分后再截断 */
const APPENDIX_WRAPUP_TOTAL_BUDGET = 52_000;
const APPENDIX_WRAPUP_MIN_PER_SLOT = 1_800;

export function needsAppendixWrapup(session: KnSlotBatchSession): boolean {
  const g = session.appendixFragments?.glossary?.trim() ?? "";
  const d = session.appendixFragments?.["data-dictionary"]?.trim() ?? "";
  if (!g || !d) return true;
  if (STUB_RE.test(g) || STUB_RE.test(d)) return true;
  if (g.length < THIN_APPENDIX_CHARS || d.length < THIN_APPENDIX_CHARS) return true;
  return false;
}

export function buildAppendixWrapupUserMessage(session: KnSlotBatchSession): string {
  return (
    `${session.userMessage}\n\n` +
    `【Worker · Appendix B/C 全文收尾 · 同 Job】\n` +
    `下方指令已附 **全部已交付 core slot 的压缩全文**（共 ${CANONICAL_KB_SLOTS.length} 个）。请据此扫描术语与数据口径，合成完整 glossary + data-dictionary。\n` +
    `只交付一个 kb-fragment-batch JSON：fragments 可空对象；必须含 appendixFragments.glossary 与 data-dictionary 完整 section。`
  );
}

/** 去掉标签噪音、压缩空白，保留可读正文供术语/数据扫描 */
export function compressFragmentHtmlForAppendixScan(html: string, maxChars: number): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

/**
 * 全部 13 个 canonical slot 的压缩正文（非前 4 个截断预览）。
 * 按总预算均分；未交付 slot 显式标注缺失。
 */
export function buildAllSlotsCompressedCorpus(
  fragments: Partial<Record<CanonicalKbSlot, string>> | undefined,
  options?: { totalBudget?: number; minPerSlot?: number },
): { corpus: string; deliveredCount: number; totalChars: number } {
  const totalBudget = options?.totalBudget ?? APPENDIX_WRAPUP_TOTAL_BUDGET;
  const minPerSlot = options?.minPerSlot ?? APPENDIX_WRAPUP_MIN_PER_SLOT;
  const perSlot = Math.max(
    minPerSlot,
    Math.floor(totalBudget / CANONICAL_KB_SLOTS.length),
  );

  const parts: string[] = [];
  let deliveredCount = 0;
  let totalChars = 0;

  for (const slot of CANONICAL_KB_SLOTS) {
    const raw = fragments?.[slot]?.trim() ?? "";
    if (!raw) {
      parts.push(`### ${slot}\n（本 slot 未交付 fragment）`);
      continue;
    }
    deliveredCount += 1;
    const body = compressFragmentHtmlForAppendixScan(raw, perSlot);
    totalChars += body.length;
    parts.push(`### ${slot}\n${body}`);
  }

  return {
    corpus: parts.join("\n\n"),
    deliveredCount,
    totalChars,
  };
}

export function buildAppendixWrapupInstructions(session: KnSlotBatchSession): string {
  const { corpus, deliveredCount, totalChars } = buildAllSlotsCompressedCorpus(
    session.fragments,
  );

  return `
【知识网络 · Appendix B/C 全文收尾（同 Full KB Job · fragment）】
${KN_MATURITY_POLICY_LINES}

**任务**：在已完成的 **全部** core slot 压缩正文基础上，做一次术语表 + 数据字典全文合成。
**禁止**改写 core slot；**禁止**整页 HTML / PUT / structured-kb-data。

**必读**
1. read_file \`references/kb-fragment-batch-schema.md\`
2. read_file \`assets/components.html\`（glossary / data-dictionary section 形态）
3. 若容器有 \`/opt/data/skills/term-annotator/SKILL.md\` 则 read_file（术语扫描方法）

**交付**
1. 2–4 行摘要
2. 一个 \`\`\`json\`\`\`：type=kb-fragment-batch；\`fragments\` 可为 \`{}\`；
   **必须** \`appendixFragments.glossary\` 与 \`appendixFragments.data-dictionary\` 为完整 \`<section id="glossary|data-dictionary">…</section>\`

**质量**
- glossary：覆盖正文出现的专有名词 / 监管缩写 / 行业术语；每条含简短定义
- data-dictionary：字段、公式、模型假设、样本范围、dashboard/workpaper 链接与 caveats；无模型则写 gap callout
- citation 仅用已登记 source id

**已交付 fragment 压缩全文（${deliveredCount}/${CANONICAL_KB_SLOTS.length} slots · ~${totalChars} 字 · 全量扫描，非抽样）**

${corpus || "（无 fragment；请依据 Evidence Inventory 写 gap-first B/C）"}
`;
}

export function mergeAppendixWrapupFromAnswer(
  session: KnSlotBatchSession,
  answer: string,
): { ok: true } | { ok: false; error: string } {
  const extracted = extractKbFragmentBatchFromAnswer(answer);
  if (!extracted.ok || !extracted.batch) {
    return { ok: false, error: extracted.reason ?? "Appendix wrap-up JSON 解析失败" };
  }
  const g = extracted.batch.appendixFragments?.glossary?.trim();
  const d = extracted.batch.appendixFragments?.["data-dictionary"]?.trim();
  if (!g || !d) {
    return { ok: false, error: "Appendix wrap-up 缺少 glossary 或 data-dictionary" };
  }
  if (!session.appendixFragments) session.appendixFragments = {};
  session.appendixFragments.glossary = g;
  session.appendixFragments["data-dictionary"] = d;
  if (!session.fragmentDelivery) session.fragmentDelivery = {};
  session.fragmentDelivery.glossary = { delivery: "delivered" };
  session.fragmentDelivery["data-dictionary"] = { delivery: "delivered" };
  session.appendixWrapupCompleted = true;
  session.appendixWrapupFellBackToStub = false;
  return { ok: true };
}
