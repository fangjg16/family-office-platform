import type { KnSlotRegistry } from "./knowledge-network-kb-config";

/** 已知 extension slot 中文别名（精加工 KB 常见自定义模块） */
export const EXTENSION_SLOT_ALIAS_PATTERNS: ReadonlyArray<{
  slot: string;
  label: string;
  patterns: RegExp[];
}> = [
  {
    slot: "short-drama-heat-analysis",
    label: "短剧热度分析",
    patterns: [/短剧热度/u, /热度分析/u, /3A/u, /#short-drama-heat-analysis\b/i],
  },
  {
    slot: "actor-asset-screen",
    label: "演员资产筛选",
    patterns: [/演员资产/u, /资产筛选/u, /3B/u, /#actor-asset-screen\b/i],
  },
  {
    slot: "producer-analysis",
    label: "制片方分析",
    patterns: [/制片方/u, /制片分析/u, /3C/u, /#producer-analysis\b/i],
  },
  {
    slot: "brand-analysis",
    label: "品牌方分析",
    patterns: [/品牌方/u, /品牌分析/u, /3D/u, /#brand-analysis\b/i],
  },
];

export function getExtensionAliasPatterns(
  registry: KnSlotRegistry,
): ReadonlyArray<{ slot: string; label: string; patterns: RegExp[] }> {
  const known = new Map(EXTENSION_SLOT_ALIAS_PATTERNS.map((e) => [e.slot, e]));
  return registry.extensions.map((slot) => {
    const hit = known.get(slot);
    if (hit) return hit;
    return {
      slot,
      label: slot,
      patterns: [new RegExp(`#${slot}\\b`, "i"), new RegExp(`\\b${slot}\\b`, "i")],
    };
  });
}

export function resolveExtensionSlotsFromMessage(
  message: string,
  registry: KnSlotRegistry,
): string[] {
  const m = message.trim();
  if (!m || !registry.hasExtensions) return [];
  const found = new Set<string>();
  for (const { slot, patterns } of getExtensionAliasPatterns(registry)) {
    if (patterns.some((re) => re.test(m))) found.add(slot);
  }
  return registry.extensions.filter((s) => found.has(s));
}

export function extensionSlotLabel(slot: string, registry?: KnSlotRegistry | null): string {
  const known = EXTENSION_SLOT_ALIAS_PATTERNS.find((e) => e.slot === slot);
  if (known) return known.label;
  if (registry?.extensions.includes(slot)) return slot;
  return slot;
}
