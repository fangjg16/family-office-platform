/** 与 api-worker/src/knowledge-network-slot-aliases.ts 保持同步（前端 deep-skill 路由） */

export const CANONICAL_KB_SLOTS = [
  "snapshot",
  "target-overview",
  "industry-market",
  "business-operations",
  "legal-ownership",
  "regulatory-compliance",
  "resource-network",
  "comps-benchmark",
  "valuation-returns",
  "diligence-gaps",
  "risks-mitigation",
  "timeline-milestones",
  "decision-framework",
] as const;

export type CanonicalKbSlot = (typeof CANONICAL_KB_SLOTS)[number];

const SLOT_ALIAS_PATTERNS: ReadonlyArray<{ slot: CanonicalKbSlot; patterns: RegExp[] }> = [
  { slot: "snapshot", patterns: [/项目快照/u, /项目总览/u, /#snapshot\b/i] },
  { slot: "target-overview", patterns: [/标的概况/u, /资产构成/u, /产品平台/u, /#target-overview\b/i] },
  { slot: "resource-network", patterns: [/资源网络/u, /资源关系/u, /协作网络/u, /#resource-network\b/i] },
  { slot: "industry-market", patterns: [/行业背景/u, /市场格局/u, /政策背景/u, /#industry-market\b/i] },
  { slot: "business-operations", patterns: [/业务模式/u, /运营假设/u, /收入路径/u, /#business-operations\b/i] },
  { slot: "legal-ownership", patterns: [/法律结构/u, /权属/u, /\bUBO\b/i, /控制权/u, /#legal-ownership\b/i] },
  { slot: "regulatory-compliance", patterns: [/监管合规/u, /合规/u, /许可/u, /审批/u, /#regulatory-compliance\b/i] },
  { slot: "comps-benchmark", patterns: [/市场对标/u, /可比案例/u, /#comps-benchmark\b/i] },
  { slot: "valuation-returns", patterns: [/投资回报/u, /估值/u, /敏感性/u, /#valuation-returns\b/i] },
  { slot: "diligence-gaps", patterns: [/待确认问题/u, /尽调缺口/u, /#diligence-gaps\b/i] },
  { slot: "risks-mitigation", patterns: [/关键风险/u, /风险缓释/u, /#risks-mitigation\b/i] },
  { slot: "timeline-milestones", patterns: [/项目时间轴/u, /时间轴/u, /里程碑/u, /#timeline-milestones\b/i] },
  { slot: "decision-framework", patterns: [/决策框架/u, /投资论点/u, /#decision-framework\b/i] },
];

const SLOT_UPDATE_VERB_RE =
  /(?:只|仅)?(?:更新|修改|补(?:一下|充)?|刷新|调整|重写|改为|改成|填充|完善|修订|删(?:除|掉)?|去掉|清理)/u;

const SLOT_REORDER_VERB_RE =
  /(?:调整|修改|重排).{0,16}(?:展示顺序|章节顺序|章节排列|板块顺序|知识网络.{0,8}顺序)|重排(?:章节|板块|顺序)|(?:把|将).{0,48}(?:移到|放到|提(?:前|到)|挪到|换到|后移|前移).{0,48}(?:前面|之后|后面|前|后|第二|第三|第[一二三四五六七八九十\d]+)|display[\s-]*order/u;

export function resolveKnowledgeNetworkSlotsFromMessage(message: string): CanonicalKbSlot[] {
  const m = message.trim();
  if (!m) return [];
  const found = new Set<CanonicalKbSlot>();
  for (const { slot, patterns } of SLOT_ALIAS_PATTERNS) {
    if (patterns.some((re) => re.test(m))) found.add(slot);
  }
  return CANONICAL_KB_SLOTS.filter((s) => found.has(s));
}

export function isKnowledgeNetworkReorderIntent(message: string): boolean {
  return SLOT_REORDER_VERB_RE.test(message.trim());
}

export function isKnowledgeNetworkSlotDeliveryIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (isKnowledgeNetworkReorderIntent(m)) return true;
  const slots = resolveKnowledgeNetworkSlotsFromMessage(m);
  if (slots.length === 0) return false;
  return SLOT_UPDATE_VERB_RE.test(m);
}
