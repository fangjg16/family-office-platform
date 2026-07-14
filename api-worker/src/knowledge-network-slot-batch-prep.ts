import { loadChunks } from "./chat-data";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  loadDocumentsForMaterialHints,
  type MaterialHintDocument,
} from "./knowledge-network-material-hints";
import type {
  EvidenceInventoryItem,
  KnSlotBatchPrep,
  KnSlotBatchSession,
} from "./knowledge-network-slot-batch-types";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";
import { normalizeStructuredKbSources } from "./knowledge-network-structured-kb-data";

import type { EmbedEnv } from "./embeddings";
import { sanitizeDocumentExcerpt } from "./knowledge-network-fragment-normalize";
import { buildMaterialSnapshotFromDocuments } from "./knowledge-network-material-snapshot";
import {
  selectChunksForChatWithVectors,
  type ChunkRow,
} from "./search";
import { KN_MATURITY_POLICY_LINES } from "./knowledge-network-kn-policy";

export type SlotBatchPrepEnv = { DB: D1Database } & EmbedEnv;

/** 全局 inventory 条数上限（多 chunk，非「每文件 1 条」） */
const MAX_INVENTORY_ITEMS = 36;
/** 单条摘录上限：够用但非整文件 */
const EXCERPT_MAX = 600;
/** 每个 slot 检索 top chunks */
const CHUNKS_PER_SLOT = 3;
const MAX_CHARS_PER_SLOT_QUERY = 4200;

const SLOT_EVIDENCE_QUERIES: Record<CanonicalKbSlot, string> = {
  snapshot: "项目概况 标的 交易结构 估值 阶段 对手方",
  "target-overview": "资产 标的 产品 技术 平台 产能 区位 许可",
  "resource-network": "渠道 供应商 顾问 关键人 政府关系 合作",
  "industry-market": "市场 行业 政策 需求 价格 竞争 规模",
  "business-operations": "收入 客户 定价 单位经济 运营 KPI 供应链",
  "legal-ownership": "股权 权属 法律实体 UBO 合同权利 质押",
  "regulatory-compliance": "监管 许可 批复 合规 审批 跨境",
  "comps-benchmark": "可比交易 对标 倍数 同行 案例",
  "valuation-returns": "估值 IRR MOIC 回报 现金流 退出 敏感性",
  "diligence-gaps": "尽调 缺口 待确认 证据 矛盾 资料清单",
  "risks-mitigation": "风险 缓释 红线 概率 影响",
  "timeline-milestones": "时间轴 里程碑 节点 截止 审批进度",
  "decision-framework": "投资论点 决策 下一步 增值 IC",
};

function trimExcerpt(text: string, max = EXCERPT_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
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
    const excerpt = doc.sampleText ? trimExcerpt(sanitizeDocumentExcerpt(doc.sampleText), 280) : undefined;
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

function sourceIdForFilename(
  registry: StructuredKbSource[],
  filename: string | undefined,
): string {
  if (!filename) return "U-1";
  return registry.find((s) => s.title === filename)?.id ?? "U-1";
}

/**
 * 按 Slot 多 chunk 检索证据（向量优先，关键词回退）。
 * 形态：Slot → 相关 chunk 多段 → 保留来源；非整文件灌入。
 */
async function buildSlotAwareEvidenceInventory(
  env: SlotBatchPrepEnv,
  chunks: ChunkRow[],
  registry: StructuredKbSource[],
  userMessage: string,
): Promise<EvidenceInventoryItem[]> {
  if (chunks.length === 0) return [];

  const inventory: EvidenceInventoryItem[] = [];
  const seenChunkIds = new Set<string>();

  for (const slot of CANONICAL_KB_SLOTS) {
    const query = `${SLOT_EVIDENCE_QUERIES[slot]} ${userMessage}`.trim();
    const hits = await selectChunksForChatWithVectors(env, chunks, query, {
      deep: false,
      maxChars: MAX_CHARS_PER_SLOT_QUERY,
      topK: CHUNKS_PER_SLOT,
    });

    for (const hit of hits) {
      if (seenChunkIds.has(hit.id)) {
        const existing = inventory.find((i) => i.id === `chunk-${hit.id}`);
        if (existing && !existing.relevantSlots.includes(slot)) {
          existing.relevantSlots = [...existing.relevantSlots, slot];
        }
        continue;
      }
      seenChunkIds.add(hit.id);
      const sourceId = sourceIdForFilename(registry, hit.filename);
      inventory.push({
        id: `chunk-${hit.id}`,
        sourceId,
        title: `${hit.filename ?? "文档"} · chunk ${hit.chunk_index + 1}`,
        type: registry.find((s) => s.id === sourceId)?.type ?? "用户上传",
        excerpt: trimExcerpt(sanitizeDocumentExcerpt(hit.text, EXCERPT_MAX)),
        relevantSlots: [slot],
      });
      if (inventory.length >= MAX_INVENTORY_ITEMS) return inventory;
    }
  }

  return inventory;
}

/** Worker 确定性预处理：按 Slot 多 chunk Evidence Inventory + Source Registry + Project Shell */
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

  let inventory = await buildSlotAwareEvidenceInventory(
    env,
    chunks as ChunkRow[],
    registry,
    session.userMessage,
  );

  // 回退：无 chunk 时仍用文档级摘录（兼容未嵌入环境）
  if (inventory.length === 0) {
    for (const doc of documents.slice(0, 12)) {
      const source = registry.find((s) => s.title === doc.filename);
      const sourceId = source?.id ?? "U-1";
      const chunkText =
        (chunks as ChunkRow[]).find((c) => c.document_id === doc.id)?.text ??
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
  }

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
        autoSummary: "",
        lead: "",
      },
      summary: `基于 ${registry.length} 项已登记来源与 ${inventory.length} 条按 Slot 检索摘录，按 v2.91 十三 slot 并行生成知识网络。`,
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
    "【Worker · 预处理 Shared Context（按 Slot 多 chunk Evidence Inventory / Source Registry / Project Shell）】",
    "",
    "**Project Shell**",
    `- title: ${prep.projectShell.meta.title}`,
    "- masthead lead / autoSummary：**由 Hermes batch 0 的 `overviewMeta` 合成写入**（≤200 字项目概览 + 一句话定位；勿贴 PDF 摘录）",
    `- displayOrder: ${(prep.projectShell.config.displayOrder ?? []).join(", ")}`,
    "",
    KN_MATURITY_POLICY_LINES,
    "",
    "**Source Registry（Appendix A · 引用须用 source-{id}）**",
  ];
  for (const s of prep.sourceRegistry) {
    lines.push(`- source-${s.id.replace(/^source-/, "")} · ${s.type} · ${s.title}`);
  }
  lines.push("", "**Evidence Inventory（按 Slot 检索的多段正文摘录；需要更多细节时可再 read 对应原文）**");
  for (const item of prep.evidenceInventory.slice(0, 24)) {
    lines.push(
      `- [${item.sourceId}] ${item.title} → ${item.relevantSlots.join(", ")}：${item.excerpt}`,
    );
  }
  lines.push(
    "",
    "各 batch **禁止**重复提交 config/meta/sources；可提交 **sourceProposals** 供 Worker 去重分配新 id。",
    "资料不足写 gap rows；**禁止**为 coverage / Factor A / 行数编造事实。",
    "若摘录不够：用 jfo-r2-materials 对相关 `source-*` 原文按需续读，勿一次灌入全部文件。",
  );
  return lines.join("\n");
}

/** 本批 slot 相关的 evidence hints（多 chunk，按相关度优先） */
export function buildBatchEvidenceHintsBlock(
  session: KnSlotBatchSession,
  batchSlots: CanonicalKbSlot[],
): string {
  const prep = session.prep;
  if (!prep?.evidenceInventory.length) return "";

  const slotSet = new Set(batchSlots);
  const matched = prep.evidenceInventory.filter((item) =>
    item.relevantSlots.some((s) => slotSet.has(s)),
  );
  const fallback = prep.evidenceInventory.filter((item) => !matched.includes(item));
  const picked = [...matched, ...fallback].slice(0, 10);

  if (picked.length === 0) return "";

  const lines = [
    "",
    `【本批 Evidence Hints · slots ${batchSlots.join(", ")}】`,
    "优先使用下列与本批相关的正文摘录；不足再续读原文。",
  ];
  for (const item of picked) {
    lines.push(`- [${item.sourceId}] ${item.title}：${item.excerpt}`);
  }
  return lines.join("\n");
}
