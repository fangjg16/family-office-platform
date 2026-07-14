import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import { KN_MATURITY_POLICY_LINES } from "./knowledge-network-kn-policy";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";

const THIN_APPENDIX_CHARS = 400;
const STUB_RE = /worker-gap-stub|data-worker-stub|缺乏资料|待补充术语|待补充数据字典/i;

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
    `13 个 core slot fragment 已齐。请扫描全部已交付 section，合成完整 glossary + data-dictionary。\n` +
    `只交付一个 kb-fragment-batch JSON：fragments 可空对象；必须含 appendixFragments.glossary 与 data-dictionary 完整 section。`
  );
}

export function buildAppendixWrapupInstructions(session: KnSlotBatchSession): string {
  const delivered = CANONICAL_KB_SLOTS.filter((s) => session.fragments?.[s]?.trim());
  const preview = delivered
    .slice(0, 4)
    .map((s) => {
      const html = session.fragments?.[s] ?? "";
      return `### ${s}\n${html.slice(0, 1200)}${html.length > 1200 ? "…" : ""}`;
    })
    .join("\n\n");

  return `
【知识网络 · Appendix B/C 全文收尾（同 Full KB Job · fragment）】
${KN_MATURITY_POLICY_LINES}

**任务**：在已完成的 13 slot HTML 基础上，做一次术语表 + 数据字典全文合成。
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

**已交付 fragment 摘录（便于扫术语；非完整证据）**
已交付 slots：${delivered.join(", ")}

${preview || "（无预览；请依据 session 上下文与 Evidence Inventory）"}
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
  return { ok: true };
}
