import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { EvidenceInventoryItem } from "./knowledge-network-slot-batch-types";

const SKILLS_ROOT = "/opt/data/skills";

export type WorkflowRoute = {
  /** Hermes 容器内完整 Skill 路径 */
  skillPath: string;
  reason: string;
};

type RouteRule = {
  slots: readonly CanonicalKbSlot[];
  skill: string;
  /** 证据偏薄时触发 */
  thinEvidence?: boolean;
  /** 摘录含数字时触发（估值/敏感性） */
  needsNumbers?: boolean;
  /** 本批总是建议（法律类缺失完整 skill 时用 deep 已有；若 skill 存在则加） */
  alwaysIfSlotPresent?: boolean;
};

const RULES: readonly RouteRule[] = [
  {
    slots: ["industry-market", "comps-benchmark", "resource-network"],
    skill: "public-info-search",
    thinEvidence: true,
  },
  {
    slots: ["comps-benchmark"],
    skill: "comp-analysis",
    thinEvidence: true,
  },
  {
    slots: ["regulatory-compliance", "legal-ownership"],
    skill: "compliance-check",
    thinEvidence: true,
  },
  {
    slots: ["valuation-returns"],
    skill: "returns-analysis",
    needsNumbers: true,
  },
  {
    slots: ["valuation-returns"],
    skill: "sensitivity-analysis",
    needsNumbers: true,
  },
  {
    slots: ["diligence-gaps"],
    skill: "dd-checklist",
    thinEvidence: true,
  },
  {
    slots: ["diligence-gaps"],
    skill: "gap-tracking",
    alwaysIfSlotPresent: true,
  },
  {
    slots: ["risks-mitigation"],
    skill: "risk-matrix",
    thinEvidence: true,
  },
  {
    slots: ["timeline-milestones"],
    skill: "node-monitoring",
    alwaysIfSlotPresent: true,
  },
  {
    slots: ["decision-framework"],
    skill: "value-creation-plan",
    alwaysIfSlotPresent: true,
  },
  {
    slots: ["resource-network", "legal-ownership"],
    skill: "background-check",
    thinEvidence: true,
  },
];

const QUANT_RE = /\d+(?:\.\d+)?\s*(?:%|万|亿)|IRR|MOIC|\$|¥/i;

function evidenceForSlots(
  inventory: readonly EvidenceInventoryItem[],
  slots: readonly CanonicalKbSlot[],
): EvidenceInventoryItem[] {
  const set = new Set(slots);
  return inventory.filter((i) => i.relevantSlots.some((s) => set.has(s)));
}

function isThin(items: readonly EvidenceInventoryItem[]): boolean {
  if (items.length === 0) return true;
  const joined = items.map((i) => i.excerpt).join(" ");
  return joined.length < 400 || items.length < 2;
}

function hasNumbers(items: readonly EvidenceInventoryItem[]): boolean {
  return items.some((i) => QUANT_RE.test(i.excerpt));
}

/**
 * 按本批 Slot + 证据厚薄，决定额外加载哪些完整 Skill（动态深挖）。
 * 不会一次加载全部 27；只返回触发的子集。
 */
export function resolveWorkflowDepthRoutes(params: {
  batchSlots: readonly CanonicalKbSlot[];
  evidenceInventory: readonly EvidenceInventoryItem[];
}): WorkflowRoute[] {
  const routes: WorkflowRoute[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const hitSlots = rule.slots.filter((s) => params.batchSlots.includes(s));
    if (hitSlots.length === 0) continue;

    const items = evidenceForSlots(params.evidenceInventory, hitSlots);
    let fire = false;
    let reason = "";

    if (rule.alwaysIfSlotPresent) {
      fire = true;
      reason = `本批含 ${hitSlots.join("+")}，加载完整 ${rule.skill} 方法`;
    } else if (rule.needsNumbers && hasNumbers(items)) {
      fire = true;
      reason = `${hitSlots.join("+")} 摘录含量化信号，加载 ${rule.skill}`;
    } else if (rule.thinEvidence && isThin(items)) {
      fire = true;
      reason = `${hitSlots.join("+")} 证据偏薄，加载完整 ${rule.skill} 深挖`;
    }

    if (!fire || seen.has(rule.skill)) continue;
    seen.add(rule.skill);
    routes.push({
      skillPath: `${SKILLS_ROOT}/${rule.skill}/SKILL.md`,
      reason,
    });
  }

  return routes;
}

export function buildWorkflowDepthRequiredReadsBlock(routes: readonly WorkflowRoute[]): string {
  if (routes.length === 0) return "";
  const lines = [
    "",
    "【动态 Workflow 深挖 · 本批触发】",
    "在短 deep ref 之外，**额外** read_file 下列完整 Skill（按方法执行分析，勿只抄标题）：",
  ];
  let n = 1;
  for (const r of routes) {
    lines.push(`${n++}. read_file \`${r.skillPath}\` — ${r.reason}`);
  }
  return lines.join("\n");
}
