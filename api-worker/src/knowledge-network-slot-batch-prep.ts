import { loadChunks } from "./chat-data";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  loadDocumentsForMaterialHints,
  type MaterialHintDocument,
} from "./knowledge-network-material-hints";
import type {
  KnSlotBatchPrep,
  KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";
import { normalizeStructuredKbSources } from "./knowledge-network-structured-kb-data";

import type { EmbedEnv } from "./embeddings";
import {
  buildProjectAutoSummary,
  sanitizeDocumentExcerpt,
} from "./knowledge-network-fragment-normalize";
import { buildMaterialSnapshotFromDocuments } from "./knowledge-network-material-snapshot";

export type SlotBatchPrepEnv = { DB: D1Database } & EmbedEnv;

const MAX_INVENTORY_ITEMS = 12;
const EXCERPT_MAX = 280;

function trimExcerpt(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= EXCERPT_MAX) return t;
  return `${t.slice(0, EXCERPT_MAX)}…`;
}

function inferRelevantSlots(filename: string, userMessage: string): CanonicalKbSlot[] {
  const blob = `${filename} ${userMessage}`.toLowerCase();
  const hits: CanonicalKbSlot[] = [];
  const rules: [RegExp, CanonicalKbSlot][] = [
    [/bp|商业计划|pitch|deck/i, "target-overview"],
    [/财务|报表|audit|审计/i, "valuation-returns"],
    [/法律|合同|章程|股权|license|许可/i, "legal-ownership"],
    [/监管|合规|批复|regulatory/i, "regulatory-compliance"],
    [/市场|行业|竞品|market/i, "industry-market"],
    [/运营|业务|收入|bmc/i, "business-operations"],
    [/尽调|dd|diligence/i, "diligence-gaps"],
    [/风险|risk/i, "risks-mitigation"],
    [/时间线|里程碑|timeline/i, "timeline-milestones"],
  ];
  for (const [re, slot] of rules) {
    if (re.test(blob)) hits.push(slot);
  }
  return hits.length ? [...new Set(hits)] : ["snapshot", "target-overview"];
}

function buildSourcesFromDocuments(docs: MaterialHintDocument[]): StructuredKbSource[] {
  let u = 0;
  let a = 0;
  const sources: StructuredKbSource[] = [];
  for (const doc of docs.slice(0, 24)) {
    const isPackage = doc.scope === "package";
    const id = isPackage ? `A-${++a}` : `U-${++u}`;
    const excerpt = doc.sampleText ? trimExcerpt(sanitizeDocumentExcerpt(doc.sampleText)) : undefined;
    sources.push({
      id,
      type: isPackage ? "公开/第三方" : "用户上传",
      title: doc.filename,
      excerpt,
      usedIn: inferRelevantSlots(doc.filename, ""),
    });
  }
  if (sources.length === 0) {
    sources.push({
      id: "U-1",
      type: "用户上传",
      title: "项目资料（待索引）",
      excerpt: "预处理阶段未索引到已解析文档；各 batch 须写 gap rows，禁止编造事实。",
      usedIn: ["snapshot"],
    });
  }
  return sources;
}

/** Worker 确定性预处理：Evidence Inventory + Source Registry + Project Shell */
export async function runKnSlotBatchPreprocess(
  env: SlotBatchPrepEnv,
  session: KnSlotBatchSession,
): Promise<KnSlotBatchPrep> {
  const documents = await loadDocumentsForMaterialHints(
    env,
    session.projectId,
    session.userId,
    session.conversationId,
  );
  const chunks =
    documents.length > 0
      ? await loadChunks(env, session.projectId, session.userId, session.conversationId)
      : [];

  const sources = buildSourcesFromDocuments(documents);
  const normalized = normalizeStructuredKbSources(sources);
  const registry = normalized.error ? sources : normalized.normalized;

  const inventory: KnSlotBatchPrep["evidenceInventory"] = [];
  for (const doc of documents.slice(0, MAX_INVENTORY_ITEMS)) {
    const source = registry.find((s) => s.title === doc.filename);
    const sourceId = source?.id ?? "U-1";
    const chunkText =
      chunks.find((c) => c.document_id === doc.id)?.text ??
      doc.sampleText ??
      "";
    const rawExcerpt = chunkText || doc.sampleText || "（未解析正文）";
    inventory.push({
      id: `inv-${inventory.length + 1}`,
      sourceId,
      title: doc.filename,
      type: source?.type ?? "用户上传",
      excerpt: trimExcerpt(sanitizeDocumentExcerpt(rawExcerpt, EXCERPT_MAX)),
      relevantSlots: inferRelevantSlots(doc.filename, session.userMessage),
    });
  }

  const leadExcerpt =
    inventory[0]?.excerpt ??
    (session.userMessage.trim().slice(0, 200) || "待各 slot batch 基于资料补全。");

  const autoSummary = buildProjectAutoSummary(
    documents.length,
    documents.map((d) => d.filename),
  );

  const prep: KnSlotBatchPrep = {
    completedAt: new Date().toISOString(),
    evidenceInventory: inventory,
    projectShell: {
      config: {
        displayOrder: [...CANONICAL_KB_SLOTS],
        projectType: "general",
        renderingMode: "chinese-only",
      },
      meta: {
        title: session.projectTitle,
        autoSummary,
        lead: leadExcerpt,
      },
      summary: `基于 ${registry.length} 项已登记来源与 ${inventory.length} 条证据摘录，按 v2.91 十三 slot 并行生成知识网络。`,
    },
    sourceRegistry: registry,
  };

  session.prep = prep;
  session.shell = {
    config: prep.projectShell.config,
    meta: prep.projectShell.meta,
    summary: prep.projectShell.summary,
    sources: registry,
  };
  session.sourceRegistry = registry;
  session.materialSnapshot = buildMaterialSnapshotFromDocuments(documents, env);
  session.updatedAt = new Date().toISOString();
  return prep;
}

export function buildPrepSharedContextBlock(session: KnSlotBatchSession): string {
  const prep = session.prep;
  if (!prep) return "";
  const lines: string[] = [
    "",
    "【Worker · 预处理 Shared Context（Evidence Inventory / Source Registry / Project Shell）】",
    "",
    "**Project Shell**",
    `- title: ${prep.projectShell.meta.title}`,
    `- autoSummary: ${prep.projectShell.meta.autoSummary}`,
    `- displayOrder: ${(prep.projectShell.config.displayOrder ?? []).join(", ")}`,
    "",
    "**Source Registry（Appendix A · 引用须用 source-{id}）**",
  ];
  for (const s of prep.sourceRegistry) {
    lines.push(`- source-${s.id.replace(/^source-/, "")} · ${s.type} · ${s.title}`);
  }
  lines.push("", "**Evidence Inventory（摘录，勿与矛盾）**");
  for (const item of prep.evidenceInventory.slice(0, 10)) {
    lines.push(
      `- [${item.sourceId}] ${item.title} → ${item.relevantSlots.join(", ")}：${item.excerpt}`,
    );
  }
  lines.push(
    "",
    "各 batch **禁止**重复提交 config/meta/sources；可提交 **sourceProposals** 供 Worker 去重分配新 id。",
    "资料不足写 gap rows；**禁止**为 coverage / Factor A / 行数编造事实。",
  );
  return lines.join("\n");
}

/** 本批 slot 相关的 compact evidence hints（补充全局 inventory，避免过薄） */
export function buildBatchEvidenceHintsBlock(
  session: KnSlotBatchSession,
  batchSlots: CanonicalKbSlot[],
): string {
  const prep = session.prep;
  if (!prep?.evidenceInventory.length) return "";

  const slotSet = new Set(batchSlots);
  const matched = prep.evidenceInventory.filter(
    (item) => item.relevantSlots.some((s) => slotSet.has(s)),
  );
  const fallback = prep.evidenceInventory.filter((item) => !matched.includes(item));
  const picked = [...matched, ...fallback].slice(0, 6);

  const lines: string[] = [
    "",
    `【本批 Evidence Hints · ${batchSlots.join(", ")}】`,
    "以下摘录仅作本批 slot 事实依据；引用请用 **已登记** source-{id} 或 sourceProposals.sourceKey。",
  ];
  for (const item of picked) {
    lines.push(
      `- source-${item.sourceId.replace(/^source-/, "")} · ${item.title}：${item.excerpt}`,
    );
  }
  return lines.join("\n");
}
