import { loadChunks } from "./chat-data";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  buildMaterialHintsForTargetSlots,
  buildMaterialHintsFromDocuments,
  loadDocumentsForMaterialHints,
  type BuildMaterialHintsParams,
  type MaterialHintDocument,
  type MaterialHintEntry,
  type MaterialHintsPayload,
} from "./knowledge-network-material-hints";
import type { ChunkRow } from "./search";

export type ReadingPlanReadMode = "full" | "excerpt" | "manifest";

export type ReadingPlanFileRef = {
  fileId: string;
  filename: string;
  readMode: ReadingPlanReadMode;
  reason: string;
};

export type GlobalReadOrderEntry = {
  fileId: string;
  filename: string;
  readMode: ReadingPlanReadMode;
  reason: string;
  suggestedSlots: CanonicalKbSlot[];
};

export type SlotReadingPlan = {
  objective: string;
  mustRead: ReadingPlanFileRef[];
  shouldRead: ReadingPlanFileRef[];
  stopRule: string;
};

export type ReadingPlanPayload = {
  mode: KnowledgeNetworkUpdateMode;
  touchedSlots: CanonicalKbSlot[];
  globalReadOrder?: GlobalReadOrderEntry[];
  slots?: Partial<Record<CanonicalKbSlot, SlotReadingPlan>>;
};

export const READING_PLAN_JSON_MAX_CHARS = 9000;
export const READING_PLAN_GLOBAL_MAX = 5;
export const READING_PLAN_MUST_READ_PER_SLOT = 2;
export const READING_PLAN_SHOULD_READ_PER_SLOT = 1;

const INDUSTRY_PUBLIC_FILE_RE =
  /market\s*report|industry\s*report|research\s*report|行业新闻|市场新闻|研报|公开资料|newsletter/iu;

const TIMELINE_ALLOWED_RE =
  /timeline|milestone|schedule|meeting|minutes|memo|closing|signing|approval|节点|时间轴|会议|纪要|签约|审批/iu;

/** single-slot incremental：可附带少量交叉 slot 资料 */
const INCREMENTAL_CROSS_SLOTS: Partial<Record<CanonicalKbSlot, readonly CanonicalKbSlot[]>> = {
  "risks-mitigation": ["legal-ownership", "regulatory-compliance", "valuation-returns"],
  "regulatory-compliance": ["legal-ownership"],
  "valuation-returns": ["business-operations"],
  "legal-ownership": ["regulatory-compliance"],
  "business-operations": ["valuation-returns"],
};

const SLOT_READING_CONFIG: Record<
  CanonicalKbSlot,
  { objective: string; stopRule: string }
> = {
  snapshot: {
    objective: "提炼项目一句话定位、阶段、核心看点与待验证假设",
    stopRule: "无 deck/简介时写 gap，勿用行业报告替代项目快照",
  },
  "target-overview": {
    objective: "确认标的资产构成、平台/产品边界与关键能力",
    stopRule: "缺项目专属资料时不得用竞品/行业概况硬填标的构成",
  },
  "industry-market": {
    objective: "归纳赛道规模、趋势、政策与竞争格局（可含公开行业资料）",
    stopRule: "公开行业资料须标注来源；不得写成项目已发生事实",
  },
  "business-operations": {
    objective: "梳理业务流程、客户、收入路径、供应链、交付与运营瓶颈",
    stopRule: "无运营数据时写 gap；不得用行业平均替代本项目 KPI",
  },
  "legal-ownership": {
    objective: "确认主体、股权、合同、授权、SPV、受益人与资产权属",
    stopRule: "未读合同/章程/权属文件不得写强结论股权或控制权",
  },
  "regulatory-compliance": {
    objective: "确认监管路径、许可、合规限制、隐私/跨境与待确认事项",
    stopRule: "若项目资料无直接监管事实，不得用行业政策填充为项目事实，应写 gap",
  },
  "resource-network": {
    objective: "识别关键合作方、渠道、政府关系与资源依赖",
    stopRule: "无合作/渠道证据时写 gap，勿臆造关系网络",
  },
  "comps-benchmark": {
    objective: "收集市场数据、可比公司、交易案例与行业规模参照",
    stopRule: "对标须标注公开或资料来源；不得替代项目自身财务事实",
  },
  "valuation-returns": {
    objective: "核对投资额、价格、收入、成本、现金流、估值与敏感变量",
    stopRule: "未读财务模型/term sheet 不得写 IRR/MOIC 等强数字结论",
  },
  "diligence-gaps": {
    objective: "汇总资料缺口、待确认问题与尽调清单",
    stopRule: "缺口须可追溯到未读/未提供资料，勿用公开信息填补",
  },
  "risks-mitigation": {
    objective: "识别风险、处罚、诉讼、合规、交易对手、供应链与政策突变及缓释",
    stopRule: "风险须有项目资料依据；行业风险仅可作背景，须标注不确定性",
  },
  "timeline-milestones": {
    objective: "只整理项目动态、交易节点、审批节点与会议纪要时间线",
    stopRule:
      "只读项目动态/交易节点/审批节点/会议纪要；不得读行业新闻填时间轴；无节点资料写 gap",
  },
  "decision-framework": {
    objective: "归纳投资逻辑、决策要点、下一步与价值创造路径",
    stopRule: "决策建议须基于已读项目资料；缺事实时写待 IC 确认",
  },
};

function isIncrementalWithoutTouched(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: CanonicalKbSlot[],
): boolean {
  return mode === "incremental" && touchedSlots.length === 0;
}

function isSingleSlotIncremental(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: CanonicalKbSlot[],
): boolean {
  return mode === "incremental" && touchedSlots.length === 1;
}

function targetSlotsForPlan(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: CanonicalKbSlot[],
  slotBatchScoped?: boolean,
): CanonicalKbSlot[] {
  if (mode === "reorder") return [];
  if (slotBatchScoped && touchedSlots.length > 0) return [...touchedSlots];
  if (isIncrementalWithoutTouched(mode, touchedSlots)) return [];
  if (isSingleSlotIncremental(mode, touchedSlots)) {
    const primary = touchedSlots[0]!;
    const cross = INCREMENTAL_CROSS_SLOTS[primary] ?? [];
    return [primary, ...cross.filter((s) => s !== primary)];
  }
  if (mode === "initial" || mode === "full") return [...CANONICAL_KB_SLOTS];
  if (mode === "incremental" && touchedSlots.length > 0) return [...touchedSlots];
  return [];
}

function hintToPlanReadMode(entry: MaterialHintEntry): ReadingPlanReadMode {
  if (entry.readMode === "full") return "full";
  if (entry.readMode === "excerpt") return "excerpt";
  if (!entry.parsed) return "manifest";
  return "manifest";
}

function entryToFileRef(entry: MaterialHintEntry, reason?: string): ReadingPlanFileRef {
  return {
    fileId: entry.fileId,
    filename: entry.filename,
    readMode: hintToPlanReadMode(entry),
    reason: reason ?? entry.reason,
  };
}

function excludeFromTimelineSlot(entry: MaterialHintEntry): boolean {
  if (INDUSTRY_PUBLIC_FILE_RE.test(entry.filename)) return true;
  if (INDUSTRY_PUBLIC_FILE_RE.test(entry.evidenceType)) return true;
  if (/market-report|comps-benchmark|industry/i.test(entry.evidenceType)) return true;
  if (!TIMELINE_ALLOWED_RE.test(entry.filename) && !/timeline-doc/i.test(entry.evidenceType)) {
    return INDUSTRY_PUBLIC_FILE_RE.test(entry.reason);
  }
  return false;
}

function filterEntriesForSlot(
  slot: CanonicalKbSlot,
  entries: MaterialHintEntry[],
): MaterialHintEntry[] {
  if (slot !== "timeline-milestones") return entries;
  return entries.filter((e) => !excludeFromTimelineSlot(e));
}

function splitMustShould(
  entries: MaterialHintEntry[],
  primaryTouched: CanonicalKbSlot[],
  slot: CanonicalKbSlot,
): { mustRead: ReadingPlanFileRef[]; shouldRead: ReadingPlanFileRef[] } {
  const filtered = filterEntriesForSlot(slot, entries);
  const sorted = [...filtered].sort((a, b) => b.priority - a.priority);
  const must: ReadingPlanFileRef[] = [];
  const should: ReadingPlanFileRef[] = [];

  for (const e of sorted) {
    const ref = entryToFileRef(e);
    const isMust =
      e.readMode === "full" ||
      (primaryTouched.includes(slot) && e.priority >= 55) ||
      e.priority >= 75;
    if (isMust && must.length < READING_PLAN_MUST_READ_PER_SLOT) {
      must.push(ref);
    } else if (should.length < READING_PLAN_SHOULD_READ_PER_SLOT) {
      should.push(ref);
    }
  }
  return { mustRead: must, shouldRead: should };
}

function buildGlobalReadOrder(
  hints: MaterialHintsPayload,
  maxEntries: number,
): GlobalReadOrderEntry[] {
  const byFile = new Map<
    string,
    GlobalReadOrderEntry & { priority: number }
  >();

  const ingest = (entry: MaterialHintEntry, slots: CanonicalKbSlot[]) => {
    const existing = byFile.get(entry.fileId);
    const readMode = hintToPlanReadMode(entry);
    if (!existing || entry.priority > existing.priority) {
      byFile.set(entry.fileId, {
        fileId: entry.fileId,
        filename: entry.filename,
        readMode,
        reason: entry.reason,
        suggestedSlots: [...new Set(slots)],
        priority: entry.priority,
      });
    } else {
      existing.suggestedSlots = [...new Set([...existing.suggestedSlots, ...slots])];
      if (entry.priority > existing.priority) {
        existing.priority = entry.priority;
        existing.reason = entry.reason;
        existing.readMode = readMode;
      }
    }
  };

  if (hints.globalFiles) {
    for (const e of hints.globalFiles) {
      const slots = (e.reason.match(/suggested slots: ([^;]+)/i)?.[1] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as CanonicalKbSlot[];
      ingest(e, slots.length > 0 ? slots : []);
    }
  }

  for (const [slot, entries] of Object.entries(hints.slots ?? {})) {
    for (const e of entries ?? []) {
      ingest(e, [slot as CanonicalKbSlot]);
    }
  }

  return [...byFile.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxEntries)
    .map(({ priority: _p, ...rest }) => ({
      ...rest,
      suggestedSlots: rest.suggestedSlots.sort(),
    }));
}

function buildSlotPlans(
  hints: MaterialHintsPayload,
  targetSlots: CanonicalKbSlot[],
  primaryTouched: CanonicalKbSlot[],
): Partial<Record<CanonicalKbSlot, SlotReadingPlan>> {
  const slots: Partial<Record<CanonicalKbSlot, SlotReadingPlan>> = {};
  for (const slot of targetSlots) {
    const config = SLOT_READING_CONFIG[slot];
    const entries = hints.slots?.[slot] ?? [];
    const { mustRead, shouldRead } = splitMustShould(entries, primaryTouched, slot);
    slots[slot] = {
      objective: config.objective,
      mustRead,
      shouldRead,
      stopRule: config.stopRule,
    };
  }
  return slots;
}

function serializePlanJsonBody(payload: ReadingPlanPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    mode: payload.mode,
    touchedSlots: payload.touchedSlots,
  };
  if (payload.globalReadOrder?.length) body.globalReadOrder = payload.globalReadOrder;
  if (payload.slots && Object.keys(payload.slots).length > 0) body.slots = payload.slots;
  return body;
}

function planJsonCharCount(payload: ReadingPlanPayload): number {
  return JSON.stringify(serializePlanJsonBody(payload), null, 2).length;
}

function isPlanEmpty(payload: ReadingPlanPayload): boolean {
  const slotCount = Object.keys(payload.slots ?? {}).length;
  const globalCount = payload.globalReadOrder?.length ?? 0;
  return slotCount === 0 && globalCount === 0;
}

/** 按 priority 从 slot mustRead/shouldRead 与 globalReadOrder 截断 JSON 体积 */
export function truncateReadingPlanPayload(
  payload: ReadingPlanPayload,
  hints: MaterialHintsPayload | null,
  maxJsonChars: number = READING_PLAN_JSON_MAX_CHARS,
): ReadingPlanPayload {
  let current = payload;
  let guard = 0;
  while (planJsonCharCount(current) > maxJsonChars && guard < 400) {
    guard += 1;
    let removed = false;

    if (current.globalReadOrder && current.globalReadOrder.length > 0) {
      current = {
        ...current,
        globalReadOrder: current.globalReadOrder.slice(0, -1),
      };
      removed = true;
    }

    if (!removed && current.slots) {
      const nextSlots = { ...current.slots };
      for (const slot of Object.keys(nextSlots) as CanonicalKbSlot[]) {
        const plan = nextSlots[slot];
        if (!plan) continue;
        if (plan.shouldRead.length > 0) {
          nextSlots[slot] = { ...plan, shouldRead: plan.shouldRead.slice(0, -1) };
          removed = true;
          break;
        }
        if (plan.mustRead.length > 0) {
          nextSlots[slot] = { ...plan, mustRead: plan.mustRead.slice(0, -1) };
          removed = true;
          break;
        }
      }
      current = { ...current, slots: nextSlots };
    }

    if (!removed) break;
    if (isPlanEmpty(current)) break;
    void hints;
  }
  return current;
}

/** 纯函数：由 material hints payload 生成 reading plan */
export function buildReadingPlanFromHints(
  hints: MaterialHintsPayload | null,
  options?: {
    maxGlobalOrder?: number;
    forceSlots?: CanonicalKbSlot[];
  },
): ReadingPlanPayload | null {
  if (!hints) return null;

  const { mode, touchedSlots } = hints;
  if (mode === "reorder") return null;

  const primaryTouched = [...touchedSlots];
  let targetSlots = targetSlotsForPlan(mode, touchedSlots, hints.slotBatchScoped);
  if (options?.forceSlots?.length) {
    targetSlots = options.forceSlots;
  }

  if (isIncrementalWithoutTouched(mode, touchedSlots)) {
    const globalReadOrder = buildGlobalReadOrder(hints, options?.maxGlobalOrder ?? READING_PLAN_GLOBAL_MAX);
    if (globalReadOrder.length === 0) return null;
    return truncateReadingPlanPayload(
      { mode, touchedSlots, globalReadOrder },
      hints,
    );
  }

  const slots = buildSlotPlans(hints, targetSlots, primaryTouched);
  const globalReadOrder = hints.slotBatchScoped
    ? []
    : buildGlobalReadOrder(
        hints,
        mode === "initial" || mode === "full" ? 8 : READING_PLAN_GLOBAL_MAX,
      );

  const payload: ReadingPlanPayload = {
    mode,
    touchedSlots,
    ...(globalReadOrder.length > 0 ? { globalReadOrder } : {}),
    slots,
  };

  if (isPlanEmpty(payload) && Object.values(slots).every((s) => !s?.mustRead.length && !s?.shouldRead.length)) {
    return payload;
  }

  return truncateReadingPlanPayload(payload, hints);
}

export function countReadingPlanFiles(payload: ReadingPlanPayload | null): {
  mustRead: number;
  shouldRead: number;
  total: number;
} {
  if (!payload) return { mustRead: 0, shouldRead: 0, total: 0 };
  let mustRead = payload.globalReadOrder?.length ?? 0;
  let shouldRead = 0;
  for (const plan of Object.values(payload.slots ?? {})) {
    mustRead += plan?.mustRead?.length ?? 0;
    shouldRead += plan?.shouldRead?.length ?? 0;
  }
  return { mustRead, shouldRead, total: mustRead + shouldRead };
}

export function formatReadingPlanBlock(
  payload: ReadingPlanPayload | null,
  options?: { missingMaterials?: boolean },
): string {
  if (options?.missingMaterials || !payload) {
    return [
      "",
      "【Slot Reading Plan · deterministic route】",
      "无可用项目资料 reading plan；项目专属结论应降级为 gap。",
      "未实际读取的文件不得支撑强结论；关键事实缺失时按 manifest 补读或写 gap。",
    ].join("\n");
  }

  const jsonBody = JSON.stringify(serializePlanJsonBody(payload), null, 2);

  return [
    "",
    "【Slot Reading Plan · deterministic route】",
    "说明：",
    "- 这是 Worker 生成的阅读路线（非事实结论），规定读哪些文件、读到什么程度、何时停止补读。",
    "- readMode=full：优先 GET textUrl 全文；excerpt：先看 digest/摘录，不足再全文；manifest：仅 manifest 确认，按需再读。",
    "- 未实际读取的文件不得支撑强结论；关键事实缺失应写 gap，勿用公开行业资料硬填项目事实。",
    "- 若本 plan 与用户本次点名 slot 冲突，以用户点名 slot 为准。",
    "- 上方【Slot Material Hints】为软导航；本 plan 规定 mustRead/shouldRead 顺序与 stopRule。",
    jsonBody,
  ].join("\n");
}

export function shouldInjectReadingPlan(mode: KnowledgeNetworkUpdateMode): boolean {
  return mode !== "reorder";
}

function resolveHintsForReadingPlan(
  params: BuildMaterialHintsParams,
): MaterialHintsPayload | null {
  const maxFilesPerSlot =
    params.maxFilesPerSlot ??
    (params.mode === "incremental" && params.touchedSlots.length === 1 ? 5 : 3);
  const withMax = { ...params, maxFilesPerSlot };

  if (isIncrementalWithoutTouched(params.mode, params.touchedSlots)) {
    return buildMaterialHintsFromDocuments(withMax);
  }

  const targetSlots = targetSlotsForPlan(params.mode, params.touchedSlots);
  if (targetSlots.length === 0) return null;

  if (isSingleSlotIncremental(params.mode, params.touchedSlots)) {
    return buildMaterialHintsForTargetSlots(withMax, targetSlots);
  }

  if (params.mode === "initial" || params.mode === "full") {
    return buildMaterialHintsForTargetSlots(withMax, [...CANONICAL_KB_SLOTS]);
  }

  return buildMaterialHintsFromDocuments(withMax);
}

export function buildReadingPlanFromDocuments(
  params: BuildMaterialHintsParams,
): ReadingPlanPayload | null {
  const hints = resolveHintsForReadingPlan(params);
  return buildReadingPlanFromHints(hints);
}

type PlanEnv = { DB: D1Database };

export async function buildKnowledgeNetworkReadingPlan(
  env: PlanEnv,
  params: {
    projectId: string;
    userId: string;
    conversationId?: string;
    userMessage: string;
    mode: KnowledgeNetworkUpdateMode;
    touchedSlots: CanonicalKbSlot[];
    maxFilesPerSlot?: number;
    slotBatchScoped?: boolean;
  },
): Promise<string> {
  if (!shouldInjectReadingPlan(params.mode)) return "";

  let documents: MaterialHintDocument[] = [];
  let chunks: ChunkRow[] = [];
  try {
    documents = await loadDocumentsForMaterialHints(
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
    return formatReadingPlanBlock(null, { missingMaterials: true });
  }

  if (documents.length === 0) {
    return formatReadingPlanBlock(null, { missingMaterials: true });
  }

  const plan = buildReadingPlanFromDocuments({
    mode: params.mode,
    userMessage: params.userMessage,
    touchedSlots: params.touchedSlots,
    documents,
    chunks,
    maxFilesPerSlot: params.maxFilesPerSlot,
    slotBatchScoped: params.slotBatchScoped,
  });

  if (!plan) {
    return formatReadingPlanBlock(null, { missingMaterials: true });
  }

  return formatReadingPlanBlock(plan);
}
