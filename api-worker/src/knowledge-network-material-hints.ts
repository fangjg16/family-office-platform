import { matchCitationSlot, getCitationSlots } from "./citations";
import { loadChunks } from "./chat-data";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { isPlaceholderChunkText, scoreChunks } from "./search";
import type { ChunkRow } from "./search";

export type MaterialReadMode = "full" | "excerpt" | "optional";

export type MaterialHintEntry = {
  fileId: string;
  filename: string;
  scope: "package" | "session";
  readMode: MaterialReadMode;
  evidenceType: string;
  reason: string;
  priority: number;
  parsed: boolean;
};

export type MaterialHintsPayload = {
  mode: KnowledgeNetworkUpdateMode;
  touchedSlots: CanonicalKbSlot[];
  /** initial / full / incremental+touched：按 slot 分组 */
  slots?: Partial<Record<CanonicalKbSlot, MaterialHintEntry[]>>;
  /** incremental 未点名 slot：全局 top-N 文件，不按 13 slot 展开 */
  globalFiles?: MaterialHintEntry[];
};

/** material hints JSON 体（不含说明文案）字符上限；超出时按 priority 截断 */
export const MATERIAL_HINTS_JSON_MAX_CHARS = 7000;

export const MATERIAL_HINTS_GLOBAL_MAX_FILES = 5;

export type MaterialHintDocument = {
  id: string;
  filename: string;
  scope: "package" | "session";
  mime: string | null;
  parsed: boolean;
  chunkCount: number;
  sampleText: string;
  citationSlotId?: string;
};

export type BuildMaterialHintsParams = {
  mode: KnowledgeNetworkUpdateMode;
  userMessage: string;
  touchedSlots: CanonicalKbSlot[];
  documents: MaterialHintDocument[];
  chunks: ChunkRow[];
  maxFilesPerSlot?: number;
};

type SlotRule = {
  slot: CanonicalKbSlot;
  keywords: RegExp;
  filenameBoost: RegExp;
  evidenceType: string;
  publicExcerpt?: boolean;
};

const CORE_FULL_FILE_RE =
  /term\s*sheet|share\s*purchase|investment\s*agreement|\bspa\b|contract|agreement|financial\s*model|cap\s*table|shareholder|license|permit|approval|signed|project\s*deck|pitch\s*deck|teaser|business\s*plan|data\s*room|term\s*sheet|合同|协议|财务模型|股权|cap\s*table|牌照|许可|审批|签署|推介|路演|商业计划|数据包/iu;

const EXCERPT_FILE_RE =
  /market\s*report|industry\s*report|research\s*report|benchmark|comparable|public\s*info|年报|研究报告|市场报告|行业报告|公开资料/iu;

const PUBLIC_FILE_RE =
  /public|公开|研报|industry\s*report|market\s*report|research\s*report/iu;

export const SLOT_MATERIAL_RULES: readonly SlotRule[] = [
  {
    slot: "snapshot",
    keywords:
      /deck|teaser|intro|overview|pitch|memo|business\s*plan|proposal|项目介绍|推介|简介|路演|bp|商业计划|建议书|executive\s*summary/iu,
    filenameBoost: /deck|teaser|intro|overview|pitch|bp|推介|简介|路演|商业计划/iu,
    evidenceType: "project-deck",
  },
  {
    slot: "target-overview",
    keywords:
      /deck|teaser|overview|pitch|assets?|platform|product|capability|标的|资产|平台|产品|概况|构成/iu,
    filenameBoost: /overview|deck|标的|资产|平台|产品/iu,
    evidenceType: "asset-overview",
  },
  {
    slot: "resource-network",
    keywords:
      /partner|channel|supplier|advisor|government|relationship|cooperation|resource|network|渠道|供应商|顾问|合作方|资源|关系|政府|客户|经销/iu,
    filenameBoost: /partner|channel|supplier|合作|渠道|顾问|资源/iu,
    evidenceType: "partner-network",
  },
  {
    slot: "industry-market",
    keywords:
      /market|industry|report|sector|trend|macro|市场规模|行业|市场|趋势|赛道/iu,
    filenameBoost: /market|industry|行业|市场|研报|报告/iu,
    evidenceType: "market-report",
    publicExcerpt: true,
  },
  {
    slot: "comps-benchmark",
    keywords:
      /benchmark|comp|comparable|transaction|peer|precedent|对标|可比|交易案例|同业/iu,
    filenameBoost: /comp|benchmark|对标|可比|交易/iu,
    evidenceType: "comps-benchmark",
    publicExcerpt: true,
  },
  {
    slot: "business-operations",
    keywords:
      /business\s*model|revenue|pricing|customer|user|supply\s*chain|operations|unit\s*economics|kpi|业务模式|收入|定价|客户|用户|供应链|运营|毛利|成本/iu,
    filenameBoost: /business|revenue|运营|收入|定价|kpi|供应链/iu,
    evidenceType: "operations",
  },
  {
    slot: "legal-ownership",
    keywords:
      /shareholder|ownership|ubo|title|registry|articles|cap\s*table|ip\s*assignment|license\s*agreement|term\s*sheet|investment\s*agreement|股权|权属|实控人|工商|章程|授权|许可协议|知识产权|股东|条款清单/iu,
    filenameBoost: /shareholder|ownership|cap\s*table|股权|章程|权属|股东/iu,
    evidenceType: "legal-ownership",
  },
  {
    slot: "regulatory-compliance",
    keywords:
      /license|permit|approval|filing|regulator|compliance|privacy|data|cross[\s-]*border|policy|牌照|许可|审批|备案|监管|合规|隐私|数据|跨境|平台规则/iu,
    filenameBoost: /license|permit|compliance|牌照|许可|审批|备案|监管|合规/iu,
    evidenceType: "regulatory-license",
  },
  {
    slot: "valuation-returns",
    keywords:
      /financial\s*model|irr|moic|cash\s*flow|valuation|sources\s*and\s*uses|capex|repayment|return|waterfall|term\s*sheet|估值|回报|现金流|财务模型|投资额|退出|还款|分配|敏感性/iu,
    filenameBoost: /financial|model|valuation|irr|moic|估值|回报|现金流|财务模型/iu,
    evidenceType: "financial-model",
  },
  {
    slot: "diligence-gaps",
    keywords:
      /question|request\s*list|missing|gap|diligence|checklist|q\s*&\s*a|待确认|问题清单|尽调|缺口|待补|资料清单/iu,
    filenameBoost: /question|checklist|gap|diligence|问题|清单|尽调/iu,
    evidenceType: "diligence-gap",
  },
  {
    slot: "risks-mitigation",
    keywords:
      /risk|litigation|dispute|default|breach|termination|penalty|red\s*flag|term\s*sheet|contract|agreement|风险|诉讼|争议|违约|终止|处罚|红旗|缓释|合同/iu,
    filenameBoost: /risk|litigation|dispute|contract|term\s*sheet|风险|诉讼|争议|合同/iu,
    evidenceType: "contract-risk",
  },
  {
    slot: "timeline-milestones",
    keywords:
      /timeline|milestone|deadline|closing|signing|approval\s*date|meeting|时间轴|节点|截止|签约|交割|审批日期|会议/iu,
    filenameBoost: /timeline|milestone|schedule|时间轴|节点|会议|签约/iu,
    evidenceType: "timeline-doc",
  },
  {
    slot: "decision-framework",
    keywords:
      /\bic\b|investment\s*memo|recommendation|decision|next\s*step|value\s*creation|投委会|投资建议|决策|下一步|价值创造|memo/iu,
    filenameBoost: /memo|ic|investment|决策|投委会|建议/iu,
    evidenceType: "decision-memo",
  },
] as const;

const TERM_SHEET_RE =
  /term\s*sheet|share\s*purchase|investment\s*agreement|\bspa\b|投资协议|term\s*sheet|条款清单/iu;

function normalizeScope(scope: string): "package" | "session" {
  return scope === "session" ? "session" : "package";
}

function clampPriority(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extensionHint(filename: string, mime: string | null): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return `${filename} ${mime ?? ""} .${ext}`;
}

function buildSearchText(doc: MaterialHintDocument): string {
  return `${doc.filename} ${extensionHint(doc.filename, doc.mime)} ${doc.sampleText}`.trim();
}

function filenameStrongHit(rule: SlotRule, filename: string): boolean {
  return rule.filenameBoost.test(filename) || rule.keywords.test(filename);
}

function inferReadMode(
  doc: MaterialHintDocument,
  slot: CanonicalKbSlot,
  rule: SlotRule,
  priority: number,
  touched: boolean,
): MaterialReadMode {
  const fn = doc.filename;
  if (CORE_FULL_FILE_RE.test(fn)) return "full";
  if (TERM_SHEET_RE.test(fn) && (slot === "legal-ownership" || slot === "risks-mitigation" || slot === "valuation-returns")) {
    return "full";
  }
  if (doc.scope === "session" && touched) return "full";
  if (EXCERPT_FILE_RE.test(fn) || rule.publicExcerpt) return "excerpt";
  if (priority >= 70) return "full";
  if (priority >= 45) return "excerpt";
  return "optional";
}

function chunkHitForDocument(
  docId: string,
  chunks: ChunkRow[],
  query: string,
): boolean {
  const docChunks = chunks.filter((c) => c.document_id === docId);
  if (docChunks.length === 0) return false;
  const hits = scoreChunks(docChunks, query, 2);
  return hits.length > 0;
}

function slotsForMode(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: CanonicalKbSlot[],
): CanonicalKbSlot[] {
  if (mode === "reorder") return [];
  if (mode === "incremental") {
    return touchedSlots.length > 0 ? [...touchedSlots] : [];
  }
  if (mode === "initial" || mode === "full") return [...CANONICAL_KB_SLOTS];
  return [];
}

function isIncrementalWithoutTouchedSlots(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: CanonicalKbSlot[],
): boolean {
  return mode === "incremental" && touchedSlots.length === 0;
}

type ScoredHint = MaterialHintEntry & { slot: CanonicalKbSlot };

function scoreDocumentForSlot(
  doc: MaterialHintDocument,
  rule: SlotRule,
  slot: CanonicalKbSlot,
  query: string,
  chunks: ChunkRow[],
  touchedSlots: CanonicalKbSlot[],
): ScoredHint | null {
  const searchText = buildSearchText(doc);
  const filenameHit = filenameStrongHit(rule, doc.filename);
  const textHit = rule.keywords.test(searchText);
  const chunkHit = chunkHitForDocument(doc.id, chunks, `${query} ${rule.keywords.source}`);
  if (!filenameHit && !textHit && !chunkHit) return null;

  let priority = 40;
  if (doc.scope === "session") priority += 20;
  if (touchedSlots.includes(slot)) priority += 30;
  if (filenameHit) priority += 20;
  if (chunkHit) priority += 20;
  if (CORE_FULL_FILE_RE.test(doc.filename)) priority += 20;
  if (!doc.parsed) priority -= 15;

  if (
    PUBLIC_FILE_RE.test(doc.filename) &&
    slot !== "industry-market" &&
    slot !== "comps-benchmark"
  ) {
    priority -= 15;
  }

  if (doc.citationSlotId) priority += 5;

  priority = clampPriority(priority);
  if (priority < 30) return null;

  const touched = touchedSlots.includes(slot);
  const readMode = inferReadMode(doc, slot, rule, priority, touched);

  const reasons: string[] = [];
  if (filenameHit) reasons.push("filename match");
  if (chunkHit) reasons.push("chunk hit");
  if (doc.scope === "session") reasons.push("session attachment");
  if (touched) reasons.push("touched slot");
  if (!doc.parsed) reasons.push("not parsed yet");

  return {
    fileId: doc.id,
    filename: doc.filename,
    scope: normalizeScope(doc.scope),
    readMode,
    evidenceType: rule.evidenceType,
    reason: reasons.join("; ") || rule.evidenceType,
    priority,
    parsed: doc.parsed,
    slot,
  };
}

function serializeHintsJsonBody(payload: MaterialHintsPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mode: payload.mode,
    touchedSlots: payload.touchedSlots,
  };
  if (payload.globalFiles && payload.globalFiles.length > 0) {
    body.globalFiles = payload.globalFiles;
  }
  if (payload.slots && Object.keys(payload.slots).length > 0) {
    body.slots = payload.slots;
  }
  return body;
}

function hintsJsonCharCount(payload: MaterialHintsPayload): number {
  return JSON.stringify(serializeHintsJsonBody(payload), null, 2).length;
}

function isPayloadEmpty(payload: MaterialHintsPayload): boolean {
  const slotCount = Object.keys(payload.slots ?? {}).length;
  const globalCount = payload.globalFiles?.length ?? 0;
  return slotCount === 0 && globalCount === 0;
}

/** 超出字符上限时，从全 payload 中移除最低 priority 条目（仅文件级元数据，无 chunk 正文） */
export function truncateMaterialHintsPayload(
  payload: MaterialHintsPayload,
  maxJsonChars: number = MATERIAL_HINTS_JSON_MAX_CHARS,
): MaterialHintsPayload {
  let current = payload;
  let guard = 0;
  while (hintsJsonCharCount(current) > maxJsonChars && guard < 500) {
    guard += 1;
    type Loc = { kind: "slot"; slot: CanonicalKbSlot; index: number } | { kind: "global"; index: number };
    let lowest: { loc: Loc; priority: number } | null = null;

    for (const [slot, entries] of Object.entries(current.slots ?? {})) {
      for (let i = 0; i < (entries?.length ?? 0); i += 1) {
        const e = entries![i]!;
        if (!lowest || e.priority < lowest.priority) {
          lowest = { loc: { kind: "slot", slot: slot as CanonicalKbSlot, index: i }, priority: e.priority };
        }
      }
    }
    for (let i = 0; i < (current.globalFiles?.length ?? 0); i += 1) {
      const e = current.globalFiles![i]!;
      if (!lowest || e.priority < lowest.priority) {
        lowest = { loc: { kind: "global", index: i }, priority: e.priority };
      }
    }

    if (!lowest) break;

    if (lowest.loc.kind === "global") {
      const nextGlobal = [...(current.globalFiles ?? [])];
      nextGlobal.splice(lowest.loc.index, 1);
      current = { ...current, globalFiles: nextGlobal.length > 0 ? nextGlobal : undefined };
    } else {
      const nextSlots = { ...(current.slots ?? {}) };
      const arr = [...(nextSlots[lowest.loc.slot] ?? [])];
      arr.splice(lowest.loc.index, 1);
      if (arr.length > 0) nextSlots[lowest.loc.slot] = arr;
      else delete nextSlots[lowest.loc.slot];
      current = { ...current, slots: Object.keys(nextSlots).length > 0 ? nextSlots : undefined };
    }

    if (isPayloadEmpty(current)) break;
  }
  return current;
}

function buildGlobalCompactHints(
  params: BuildMaterialHintsParams,
  maxGlobalFiles: number = MATERIAL_HINTS_GLOBAL_MAX_FILES,
): MaterialHintsPayload | null {
  const { mode, userMessage, documents, chunks, touchedSlots } = params;
  const query = userMessage.trim() || "项目尽调 资料";
  const byFile = new Map<
    string,
    MaterialHintEntry & { suggestedSlots: Set<CanonicalKbSlot> }
  >();

  for (const rule of SLOT_MATERIAL_RULES) {
    for (const doc of documents) {
      const scored = scoreDocumentForSlot(doc, rule, rule.slot, query, chunks, touchedSlots);
      if (!scored) continue;
      const { slot, ...entry } = scored;
      const existing = byFile.get(doc.id);
      if (!existing || entry.priority > existing.priority) {
        byFile.set(doc.id, {
          ...entry,
          suggestedSlots: new Set(existing ? [...existing.suggestedSlots, slot] : [slot]),
        });
      } else {
        existing.suggestedSlots.add(slot);
        if (entry.priority > existing.priority) {
          byFile.set(doc.id, {
            ...entry,
            suggestedSlots: existing.suggestedSlots,
          });
        }
      }
    }
  }

  const globalFiles = [...byFile.values()]
    .map(({ suggestedSlots, reason, ...entry }) => ({
      ...entry,
      reason: `${reason}; suggested slots: ${[...suggestedSlots].sort().join(", ")}`,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxGlobalFiles);

  if (globalFiles.length === 0) return null;

  return {
    mode,
    touchedSlots: [],
    globalFiles,
  };
}

function buildSlotGroupedHints(
  params: BuildMaterialHintsParams,
  targetSlots: CanonicalKbSlot[],
): MaterialHintsPayload | null {
  const {
    mode,
    userMessage,
    touchedSlots,
    documents,
    chunks,
    maxFilesPerSlot = 3,
  } = params;

  const slots: Partial<Record<CanonicalKbSlot, MaterialHintEntry[]>> = {};
  const query = userMessage.trim() || "项目尽调 资料";

  for (const slot of targetSlots) {
    const rule = SLOT_MATERIAL_RULES.find((r) => r.slot === slot);
    if (!rule) continue;

    const entries: MaterialHintEntry[] = [];

    for (const doc of documents) {
      const scored = scoreDocumentForSlot(doc, rule, slot, query, chunks, touchedSlots);
      if (!scored) continue;
      const { slot: _s, ...entry } = scored;
      entries.push(entry);
    }

    entries.sort((a, b) => b.priority - a.priority);
    const deduped = entries.slice(0, maxFilesPerSlot);
    if (deduped.length > 0) slots[slot] = deduped;
  }

  if (Object.keys(slots).length === 0) return null;

  return {
    mode,
    touchedSlots: [...touchedSlots],
    slots,
  };
}

/** 纯函数：由资料列表生成 hints payload（供测试与主流程复用） */
export function buildMaterialHintsFromDocuments(
  params: BuildMaterialHintsParams,
): MaterialHintsPayload | null {
  const { mode, touchedSlots } = params;

  if (mode === "reorder") return null;

  let payload: MaterialHintsPayload | null;

  if (isIncrementalWithoutTouchedSlots(mode, touchedSlots)) {
    payload = buildGlobalCompactHints(params);
  } else {
    const targetSlots = slotsForMode(mode, touchedSlots);
    if (targetSlots.length === 0) return null;
    payload = buildSlotGroupedHints(params, targetSlots);
  }

  if (!payload) return null;
  return truncateMaterialHintsPayload(payload);
}

export function formatMaterialHintsBlock(
  payload: MaterialHintsPayload | null,
  options?: { missingMaterials?: boolean },
): string {
  if (options?.missingMaterials || !payload) {
    return [
      "",
      "【Slot Material Hints · soft guidance】",
      "无可用项目资料 hints；按 manifest 确认资料清单，项目专属结论需降级为 gap。",
      "未实际读取全文的资料不得支撑强结论；关键事实缺失时可按 manifest 补读 textUrl。",
    ].join("\n");
  }

  if (isPayloadEmpty(payload)) {
    return formatMaterialHintsBlock(null, { missingMaterials: true });
  }

  const jsonBody = JSON.stringify(serializeHintsJsonBody(payload), null, 2);

  return [
    "",
    "【Slot Material Hints · soft guidance】",
    "说明：",
    "- 这是 Worker 根据文件名、chunk 命中和用户消息生成的资料阅读建议，不是结论。",
    "- 优先读取 readMode=full 的文件；readMode=excerpt 可先看摘录，不足再 GET textUrl。",
    "- 未列入 hints 的资料并非禁止读取；若关键事实缺失，可按 manifest 补读。",
    "- 未实际读取全文的资料不得支撑强结论，应写为 gap 或低确定性。",
  jsonBody,
  ].join("\n");
}

type HintEnv = { DB: D1Database };

async function loadDocumentsForHints(
  env: HintEnv,
  projectId: string,
  userId: string,
  conversationId?: string,
): Promise<MaterialHintDocument[]> {
  const convKey = (conversationId ?? "").trim();
  let sql = `
    SELECT d.id, d.filename, d.scope, d.mime,
           (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count,
           (SELECT c.text FROM chunks c WHERE c.document_id = d.id AND c.chunk_index = 0 LIMIT 1) AS sample_text
    FROM documents d
    WHERE d.project_id = ?
      AND (
        d.scope = 'package'
        OR (d.scope = 'session' AND d.uploaded_by = ? AND d.conversation_id = ?)
      )
    ORDER BY d.created_at DESC
    LIMIT 120
  `;
  const binds: string[] = [projectId, userId, convKey];
  if (!convKey) {
    sql = `
      SELECT d.id, d.filename, d.scope, d.mime,
             (SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) AS chunk_count,
             (SELECT c.text FROM chunks c WHERE c.document_id = d.id AND c.chunk_index = 0 LIMIT 1) AS sample_text
      FROM documents d
      WHERE d.project_id = ?
        AND (d.scope = 'package' OR (d.scope = 'session' AND d.uploaded_by = ?))
      ORDER BY d.created_at DESC
      LIMIT 120
    `;
    binds.pop();
  }

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all<{
      id: string;
      filename: string;
      scope: string;
      mime: string | null;
      chunk_count: number;
      sample_text: string | null;
    }>();

  const citationSlots = getCitationSlots(projectId);

  return (results ?? []).map((r) => {
    const chunkCount = Number(r.chunk_count) || 0;
    const sample = (r.sample_text ?? "").trim();
    const parsed =
      chunkCount > 0 && sample.length > 0 && !isPlaceholderChunkText(sample);
    const citation = matchCitationSlot(citationSlots, r.filename);
    return {
      id: r.id,
      filename: r.filename,
      scope: normalizeScope(r.scope),
      mime: r.mime,
      parsed,
      chunkCount,
      sampleText: sample,
      citationSlotId: citation?.id,
    };
  });
}

export function shouldInjectMaterialHints(
  mode: KnowledgeNetworkUpdateMode,
): boolean {
  return mode !== "reorder";
}

export async function buildKnowledgeNetworkMaterialHints(
  env: HintEnv,
  params: {
    projectId: string;
    userId: string;
    conversationId?: string;
    userMessage: string;
    mode: KnowledgeNetworkUpdateMode;
    touchedSlots: CanonicalKbSlot[];
    maxFilesPerSlot?: number;
  },
): Promise<string> {
  if (!shouldInjectMaterialHints(params.mode)) return "";

  let documents: MaterialHintDocument[] = [];
  let chunks: ChunkRow[] = [];
  try {
    documents = await loadDocumentsForHints(
      env,
      params.projectId,
      params.userId,
      params.conversationId,
    );
    if (documents.length > 0) {
      chunks = await loadChunks(
        env,
        params.projectId,
        params.userId,
        params.conversationId,
      );
    }
  } catch {
    return formatMaterialHintsBlock(null, { missingMaterials: true });
  }

  if (documents.length === 0) {
    return formatMaterialHintsBlock(null, { missingMaterials: true });
  }

  const maxFilesPerSlot =
    params.maxFilesPerSlot ??
    (params.mode === "incremental" && params.touchedSlots.length === 1 ? 5 : 3);

  const payload = buildMaterialHintsFromDocuments({
    mode: params.mode,
    userMessage: params.userMessage,
    touchedSlots: params.touchedSlots,
    documents,
    chunks,
    maxFilesPerSlot,
  });

  return formatMaterialHintsBlock(payload);
}
