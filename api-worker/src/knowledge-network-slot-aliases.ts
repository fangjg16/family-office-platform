import {
  CANONICAL_KB_SLOTS,
} from "./knowledge-network-html-validation";

export type CanonicalKbSlot = (typeof CANONICAL_KB_SLOTS)[number];

/** 中文板块名 / 简称 / #anchor → canonical slot（长模式优先匹配） */
const SLOT_ALIAS_PATTERNS: ReadonlyArray<{ slot: CanonicalKbSlot; patterns: RegExp[] }> = [
  {
    slot: "snapshot",
    patterns: [/项目快照/u, /#snapshot\b/i, /\bsnapshot\b/i],
  },
  {
    slot: "assets",
    patterns: [
      /平台能力与资源/u,
      /资产构成/u,
      /#assets\b/i,
      /\bassets\b/i,
    ],
  },
  {
    slot: "legal-relationships",
    patterns: [
      /法律结构/u,
      /关键关系网/u,
      /法律关系/u,
      /#legal-relationships\b/i,
      /\blegal-relationships\b/i,
    ],
  },
  {
    slot: "business-model",
    patterns: [
      /业务模式/u,
      /收入假设/u,
      /#business-model\b/i,
      /\bbusiness-model\b/i,
    ],
  },
  {
    slot: "capital-structure",
    patterns: [
      /融资结构/u,
      /资本结构/u,
      /#capital-structure\b/i,
      /\bcapital-structure\b/i,
    ],
  },
  {
    slot: "comps",
    patterns: [
      /市场对标/u,
      /可比交易/u,
      /#comps\b/i,
      /\bcomps\b/i,
    ],
  },
  {
    slot: "returns",
    patterns: [
      /投资回报/u,
      /敏感性分析/u,
      /回报假设/u,
      /#returns\b/i,
      /\breturns\b/i,
    ],
  },
  {
    slot: "timeline",
    patterns: [/项目时间轴/u, /时间轴/u, /#timeline\b/i, /\btimeline\b/i],
  },
  {
    slot: "risks",
    patterns: [/关键风险/u, /风险缓释/u, /风险矩阵/u, /#risks\b/i, /\brisks\b/i],
  },
  {
    slot: "open-questions",
    patterns: [
      /待确认问题/u,
      /待补充信息/u,
      /开放问题/u,
      /#open-questions\b/i,
      /\bopen-questions\b/i,
    ],
  },
  {
    slot: "decision-framework",
    patterns: [/决策框架/u, /#decision-framework\b/i, /\bdecision-framework\b/i],
  },
];

const SLOT_UPDATE_VERB_RE =
  /(?:只|仅)?(?:更新|修改|补(?:一下|充)?|刷新|调整|重写|改为|改成|填充|完善|修订|删(?:除|掉)?|去掉|清理)/u;

const SLOT_REORDER_VERB_RE =
  /(?:调整|修改|重排).{0,16}(?:展示顺序|章节顺序|章节排列|板块顺序|知识网络.{0,8}顺序)|重排(?:章节|板块|顺序)|(?:把|将).{0,48}(?:移到|放到|提(?:前|到)|挪到|换到|后移|前移).{0,48}(?:前面|之后|后面|前|后|第二|第三|第[一二三四五六七八九十\d]+)|display[\s-]*order|reset\s+display\s+order/u;

/** 从用户消息解析点名的 canonical slot（去重，保持 canonical 顺序） */
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

export function messageMentionsKbSlot(
  message: string,
  slot: CanonicalKbSlot,
): boolean {
  return resolveKnowledgeNetworkSlotsFromMessage(message).includes(slot);
}

export function messageTouchesTimeline(message: string): boolean {
  if (messageMentionsKbSlot(message, "timeline")) return true;
  return /节点监控|未来关键节点/u.test(message);
}

export function isKnowledgeNetworkReorderIntent(message: string): boolean {
  return SLOT_REORDER_VERB_RE.test(message.trim());
}

/** 中文板块更新 / 重排（无「知识网络」四字）也视为 KB 交付意图 */
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
  assets: "资产构成",
  "legal-relationships": "法律结构",
  "business-model": "业务模式",
  "capital-structure": "融资结构",
  comps: "市场对标",
  returns: "投资回报",
  timeline: "项目时间轴",
  risks: "关键风险",
  "open-questions": "待确认问题",
  "decision-framework": "决策框架",
};

/** 注入 Hermes：把用户中文板块名解析为 canonical #slot */
export function buildKnowledgeNetworkSlotResolutionLines(message: string): string {
  const slots = resolveKnowledgeNetworkSlotsFromMessage(message);
  if (slots.length === 0) return "";
  const parts = slots.map((s) => `${SLOT_ZH_LABEL[s]} → #${s}`);
  return [
    "",
    "【用户点名 slot（中文与 #anchor 等价，已解析为 canonical）】",
    parts.join("；"),
    "增量模式：仅修改上述 slot 内容面板；reorder 模式：仅改 KB-CONFIG/nav/编号，不改内容面板。",
  ].join("\n");
}

export function slotAliasCoverageReport(): Record<CanonicalKbSlot, string[]> {
  const out = {} as Record<CanonicalKbSlot, string[]>;
  for (const { slot, patterns } of SLOT_ALIAS_PATTERNS) {
    out[slot] = patterns.map((re) => re.source);
  }
  return out;
}
