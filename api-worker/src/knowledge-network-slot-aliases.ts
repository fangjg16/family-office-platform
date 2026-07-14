import {
  CANONICAL_KB_SLOTS,
} from "./knowledge-network-html-validation";
import type { KnSlotRegistry } from "./knowledge-network-kb-config";
import {
  extensionSlotLabel,
  resolveExtensionSlotsFromMessage,
} from "./knowledge-network-extension-slots";

export type CanonicalKbSlot = (typeof CANONICAL_KB_SLOTS)[number];

export type KnTouchedSlot = CanonicalKbSlot | string;

const SLOT_ALIAS_PATTERNS: ReadonlyArray<{ slot: CanonicalKbSlot; patterns: RegExp[] }> = [
  {
    slot: "snapshot",
    patterns: [/项目快照/u, /项目总览/u, /#snapshot\b/i, /\bsnapshot\b/i],
  },
  {
    slot: "target-overview",
    patterns: [
      /标的概况/u,
      /资产构成/u,
      /产品平台/u,
      /平台能力/u,
      /#target-overview\b/i,
      /\btarget-overview\b/i,
    ],
  },
  {
    slot: "resource-network",
    patterns: [
      /资源网络/u,
      /资源关系/u,
      /协作网络/u,
      /关键协作/u,
      /#resource-network\b/i,
      /\bresource-network\b/i,
    ],
  },
  {
    slot: "industry-market",
    patterns: [
      /行业背景/u,
      /市场格局/u,
      /政策背景/u,
      /行业市场/u,
      /#industry-market\b/i,
      /\bindustry-market\b/i,
    ],
  },
  {
    slot: "business-operations",
    patterns: [
      /业务模式/u,
      /运营假设/u,
      /收入路径/u,
      /收入假设/u,
      /#business-operations\b/i,
      /\bbusiness-operations\b/i,
    ],
  },
  {
    slot: "legal-ownership",
    patterns: [
      /法律结构/u,
      /权属/u,
      /\bUBO\b/i,
      /控制权/u,
      /关键关系网/u,
      /#legal-ownership\b/i,
      /\blegal-ownership\b/i,
    ],
  },
  {
    slot: "regulatory-compliance",
    patterns: [
      /监管合规/u,
      /合规/u,
      /许可/u,
      /审批/u,
      /隐私数据/u,
      /#regulatory-compliance\b/i,
      /\bregulatory-compliance\b/i,
    ],
  },
  {
    slot: "comps-benchmark",
    patterns: [
      /市场对标/u,
      /可比案例/u,
      /可比交易/u,
      /#comps-benchmark\b/i,
      /\bcomps-benchmark\b/i,
      /\bcomps\b/i,
    ],
  },
  {
    slot: "valuation-returns",
    patterns: [
      /投资回报/u,
      /估值/u,
      /敏感性/u,
      /回报假设/u,
      /#valuation-returns\b/i,
      /\bvaluation-returns\b/i,
    ],
  },
  {
    slot: "diligence-gaps",
    patterns: [
      /待确认问题/u,
      /尽调缺口/u,
      /待补充信息/u,
      /claim\s*gap/i,
      /#diligence-gaps\b/i,
      /\bdiligence-gaps\b/i,
    ],
  },
  {
    slot: "risks-mitigation",
    patterns: [
      /关键风险/u,
      /风险缓释/u,
      /风险矩阵/u,
      /#risks-mitigation\b/i,
      /\brisks-mitigation\b/i,
      /\brisks\b/i,
    ],
  },
  {
    slot: "timeline-milestones",
    patterns: [
      /项目时间轴/u,
      /时间轴/u,
      /里程碑/u,
      /关键节点/u,
      /#timeline-milestones\b/i,
      /\btimeline-milestones\b/i,
    ],
  },
  {
    slot: "decision-framework",
    patterns: [
      /决策框架/u,
      /投资论点/u,
      /下一步/u,
      /#decision-framework\b/i,
      /\bdecision-framework\b/i,
    ],
  },
];

const SLOT_UPDATE_VERB_RE =
  /(?:只|仅)?(?:更新|修改|补(?:一下|充)?|刷新|调整|重写|改为|改成|填充|完善|修订|删(?:除|掉)?|去掉|清理)/u;

const SLOT_REORDER_VERB_RE =
  /(?:调整|修改|重排).{0,16}(?:展示顺序|章节顺序|章节排列|板块顺序|知识网络.{0,8}顺序)|重排(?:章节|板块|顺序)|(?:把|将).{0,48}(?:移到|放到|提(?:前|到)|挪到|换到|后移|前移).{0,48}(?:前面|之后|后面|前|后|第二|第三|第[一二三四五六七八九十\d]+)|display[\s-]*order|reset\s+display\s+order/u;

export function resolveKnowledgeNetworkSlotsFromMessage(
  message: string,
): CanonicalKbSlot[] {
  const m = message.trim();
  if (!m) return [];
  const found = new Set<CanonicalKbSlot>();
  for (const { slot, patterns } of SLOT_ALIAS_PATTERNS) {
    if (patterns.some((re) => re.test(m))) {
      found.add(slot);
    }
  }
  return CANONICAL_KB_SLOTS.filter((s) => found.has(s));
}

/** canonical + extension（按 display-order 排序） */
export function resolveKnTouchedSlotsFromMessage(
  message: string,
  registry?: KnSlotRegistry | null,
): KnTouchedSlot[] {
  const m = message.trim();
  if (!m) return [];

  const found = new Set<KnTouchedSlot>();
  for (const s of resolveKnowledgeNetworkSlotsFromMessage(m)) found.add(s);
  if (registry?.hasExtensions) {
    for (const ext of resolveExtensionSlotsFromMessage(m, registry)) found.add(ext);
  }

  if (registry?.hasExtensions) {
    const ordered = registry.displayOrder.filter((id) => found.has(id));
    return ordered.length > 0 ? ordered : [...found];
  }
  return CANONICAL_KB_SLOTS.filter((s) => found.has(s));
}

export function messageMentionsKbSlot(
  message: string,
  slot: CanonicalKbSlot,
): boolean {
  return resolveKnowledgeNetworkSlotsFromMessage(message).includes(slot);
}

export function messageTouchesTimeline(message: string): boolean {
  if (messageMentionsKbSlot(message, "timeline-milestones")) return true;
  return /节点监控|未来关键节点|时间轴/u.test(message);
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

const SLOT_ZH_LABEL: Record<CanonicalKbSlot, string> = {
  snapshot: "项目快照",
  "target-overview": "标的概况",
  "resource-network": "资源网络",
  "industry-market": "行业市场",
  "business-operations": "业务模式",
  "legal-ownership": "法律结构",
  "regulatory-compliance": "监管合规",
  "comps-benchmark": "市场对标",
  "valuation-returns": "投资回报",
  "diligence-gaps": "待确认问题",
  "risks-mitigation": "关键风险",
  "timeline-milestones": "项目时间轴",
  "decision-framework": "决策框架",
};

export function buildKnowledgeNetworkSlotResolutionLines(
  message: string,
  registry?: KnSlotRegistry | null,
): string {
  const slots = resolveKnTouchedSlotsFromMessage(message, registry);
  if (slots.length === 0) return "";
  const parts = slots.map((s) => {
    if (CANONICAL_KB_SLOTS.includes(s as CanonicalKbSlot)) {
      return `${SLOT_ZH_LABEL[s as CanonicalKbSlot]} → #${s}`;
    }
    return `${extensionSlotLabel(s, registry)} → #${s}`;
  });
  const extNote = registry?.hasExtensions
    ? "；含 extension slot（自定义模块，仅 fragment incremental / 上传维护）"
    : "";
  return [
    "",
    "【用户点名 slot（v2.91 · 中文与 #anchor 等价）】",
    parts.join("；"),
    `增量模式：仅修改上述 slot 内容面板；reorder 模式：仅改 KB-CONFIG/nav/编号，不改内容面板${extNote}。`,
  ].join("\n");
}

export function slotAliasCoverageReport(): Record<CanonicalKbSlot, string[]> {
  const out = {} as Record<CanonicalKbSlot, string[]>;
  for (const { slot, patterns } of SLOT_ALIAS_PATTERNS) {
    out[slot] = patterns.map((re) => re.source);
  }
  return out;
}
