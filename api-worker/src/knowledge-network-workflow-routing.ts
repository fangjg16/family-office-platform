import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { EvidenceInventoryItem } from "./knowledge-network-slot-batch-types";
import workflowMapJson from "../../hermes-railway/codex-hermes-workflow-map.v293.json";

const SKILLS_ROOT = "/opt/data/skills";
const HERMES_KB_SKILL_ROOT = `${SKILLS_ROOT}/opportunistic-investments-hermes`;

export type WorkflowRoute = {
  /** Hermes 容器内完整 Skill 或 deep-ref 路径 */
  skillPath: string;
  reason: string;
  /** 完整 Skill（已安装）| deep-ref 回退（未安装但有短卡片） */
  kind: "skill" | "deep-ref";
  skillId: string;
};

type RouteRule = {
  slots: readonly CanonicalKbSlot[];
  skill: string;
  thinEvidence?: boolean;
  needsNumbers?: boolean;
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

export type CodexHermesWorkflowMap = {
  kbSchemaVersion: string;
  workflows: Array<{
    id: string;
    hermes: {
      skillInstalled: boolean;
      deepRef: string | null;
      fullKbDefault?: string;
      dynamicRoute?: boolean;
      missingCapability?: boolean;
    };
  }>;
  platformOnly?: string[];
};

/** 打包进 Worker 的映射表（禁止运行时 readFileSync） */
const BUNDLED_MAP = workflowMapJson as CodexHermesWorkflowMap;

/**
 * 加载 Codex→Hermes 映射。
 * Worker 运行时始终用打包 JSON；测试可传入覆盖对象。
 */
export function loadCodexHermesWorkflowMap(
  override?: CodexHermesWorkflowMap,
): CodexHermesWorkflowMap {
  return override ?? BUNDLED_MAP;
}

/** @deprecated 兼容旧测试名；无状态可清 */
export function clearWorkflowMapCache(): void {
  /* bundled map — no cache */
}

export function listInstalledHermesSkillIds(map?: CodexHermesWorkflowMap): Set<string> {
  const m = map ?? loadCodexHermesWorkflowMap();
  return new Set(
    m.workflows.filter((w) => w.hermes.skillInstalled).map((w) => w.id),
  );
}

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

function resolveRouteTarget(
  skillId: string,
  map: CodexHermesWorkflowMap,
): { kind: "skill" | "deep-ref"; path: string } | null {
  const entry = map.workflows.find((w) => w.id === skillId);
  if (!entry) return null;

  if (entry.hermes.skillInstalled) {
    return { kind: "skill", path: `${SKILLS_ROOT}/${skillId}/SKILL.md` };
  }

  // 未安装：仅允许 deep-ref 回退，禁止指向不存在的 /opt/data/skills/{id}/SKILL.md
  if (entry.hermes.deepRef) {
    return {
      kind: "deep-ref",
      path: `${HERMES_KB_SKILL_ROOT}/references/deep/${entry.hermes.deepRef}`,
    };
  }

  return null;
}

/**
 * 按本批 Slot + 证据厚薄决定额外加载哪些方法。
 * **只**输出映射表认可的路径：已安装 Skill，或未安装但有 deep-ref 回退。
 */
export function resolveWorkflowDepthRoutes(params: {
  batchSlots: readonly CanonicalKbSlot[];
  evidenceInventory: readonly EvidenceInventoryItem[];
  map?: CodexHermesWorkflowMap;
}): WorkflowRoute[] {
  const map = params.map ?? loadCodexHermesWorkflowMap();
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
      reason = `本批含 ${hitSlots.join("+")}`;
    } else if (rule.needsNumbers && hasNumbers(items)) {
      fire = true;
      reason = `${hitSlots.join("+")} 摘录含量化信号`;
    } else if (rule.thinEvidence && isThin(items)) {
      fire = true;
      reason = `${hitSlots.join("+")} 证据偏薄`;
    }

    if (!fire || seen.has(rule.skill)) continue;

    const target = resolveRouteTarget(rule.skill, map);
    if (!target) {
      // 映射表标记 missing 且无 deep-ref：跳过，勿要求读未安装文件
      continue;
    }

    seen.add(rule.skill);
    const kindLabel =
      target.kind === "skill"
        ? `加载完整 Skill ${rule.skill}`
        : `Skill ${rule.skill} 未安装，回退 deep-ref`;
    routes.push({
      skillPath: target.path,
      skillId: rule.skill,
      kind: target.kind,
      reason: `${reason} → ${kindLabel}`,
    });
  }

  return routes;
}

export function buildWorkflowDepthRequiredReadsBlock(
  routes: readonly WorkflowRoute[],
): string {
  if (routes.length === 0) return "";
  const lines = [
    "",
    "【动态 Workflow 深挖 · 本批触发】",
    "在短 deep ref 之外，**额外** read_file 下列路径（已按 Codex→Hermes 映射过滤：仅已安装 Skill 或 deep-ref 回退）：",
  ];
  let n = 1;
  for (const r of routes) {
    lines.push(`${n++}. read_file \`${r.skillPath}\` — ${r.reason}`);
  }
  return lines.join("\n");
}

/** 本批是否因路由请求了 public-info-search（Skill 或 deep-ref） */
export function routesRequestPublicInfoSearch(
  routes: readonly WorkflowRoute[],
): boolean {
  return routes.some((r) => r.skillId === "public-info-search");
}
