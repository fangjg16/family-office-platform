import {
  CANONICAL_KB_SLOTS,
  KB_APPENDIX_SLOTS,
} from "./knowledge-network-canonical-slots";

export type ExtensionKbSlot = string;

export type KnSlotRegistry = {
  displayOrder: string[];
  extensions: ExtensionKbSlot[];
  canonical: readonly (typeof CANONICAL_KB_SLOTS)[number][];
  projectType: string | null;
  /** 含 extension 的自定义 KB（browser upload / 精加工） */
  hasExtensions: boolean;
};

const CANONICAL_SET = new Set<string>(CANONICAL_KB_SLOTS);
const RESERVED_SLOT_IDS = new Set<string>([
  "overview",
  ...CANONICAL_KB_SLOTS,
  ...KB_APPENDIX_SLOTS,
]);

const EXTENSION_ID_RE = /^[a-z][a-z0-9-]*$/;

/** Body inside <!-- KB-CONFIG ... --> (canonical v2.91 line-oriented format). */
export function extractKbConfigCommentBody(html: string): string | null {
  const configMatch = html.match(/<!--\s*KB-CONFIG([\s\S]*?)-->/i);
  return configMatch?.[1] ?? null;
}

export function parseKbConfigDisplayOrder(html: string): string[] {
  const configBody = extractKbConfigCommentBody(html);
  if (!configBody) return [];
  const line = configBody.match(/display-order:\s*(.+)$/im);
  if (!line) return [];
  return line[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidExtensionSlotId(id: string): boolean {
  const t = id.trim();
  if (!t || !EXTENSION_ID_RE.test(t)) return false;
  if (RESERVED_SLOT_IDS.has(t)) return false;
  return true;
}

export function parseKbConfigExtensionSlots(html: string): ExtensionKbSlot[] {
  const configBody = extractKbConfigCommentBody(html);
  if (!configBody) return [];
  const line = configBody.match(/extension-slots:\s*(.+)$/im);
  if (!line) return [];
  return line[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isValidExtensionSlotId(s));
}

export function parseKbConfigProjectType(html: string): string | null {
  const configBody = extractKbConfigCommentBody(html);
  if (!configBody) return null;
  const line = configBody.match(/project-type:\s*(\S+)/im);
  return line?.[1]?.trim() ?? null;
}

/** display-order 中不属于 canonical 的 id（implicit extension 推导） */
export function deriveExtensionSlotsFromDisplayOrder(displayOrder: string[]): ExtensionKbSlot[] {
  return displayOrder.filter((id) => !CANONICAL_SET.has(id) && isValidExtensionSlotId(id));
}

export function buildSlotRegistryFromKnowledgeNetworkHtml(html: string): KnSlotRegistry {
  const displayOrder = parseKbConfigDisplayOrder(html);
  const explicit = parseKbConfigExtensionSlots(html);
  const derived = deriveExtensionSlotsFromDisplayOrder(displayOrder);
  const extensions = explicit.length > 0 ? explicit : derived;

  return {
    displayOrder,
    extensions,
    canonical: CANONICAL_KB_SLOTS,
    projectType: parseKbConfigProjectType(html),
    hasExtensions: extensions.length > 0,
  };
}

export function isExtensionKbSlot(
  registry: KnSlotRegistry,
  slot: string,
): slot is ExtensionKbSlot {
  return registry.extensions.includes(slot);
}

export function isKnTouchedSlot(registry: KnSlotRegistry, slot: string): boolean {
  return CANONICAL_SET.has(slot) || registry.extensions.includes(slot);
}

export function listAllowedNavTargets(registry: KnSlotRegistry | null): Set<string> {
  const base = new Set<string>(["overview", ...CANONICAL_KB_SLOTS, ...KB_APPENDIX_SLOTS]);
  if (registry) {
    for (const ext of registry.extensions) base.add(ext);
  }
  return base;
}

export function validateSlotRegistryShape(registry: KnSlotRegistry): string | null {
  const missingCanonical = CANONICAL_KB_SLOTS.filter((s) => !registry.displayOrder.includes(s));
  if (missingCanonical.length > 0) {
    return `display-order 缺少 canonical slot：${missingCanonical.join(", ")}`;
  }

  for (const ext of registry.extensions) {
    if (!isValidExtensionSlotId(ext)) {
      return `无效 extension slot id：${ext}`;
    }
    if (!registry.displayOrder.includes(ext)) {
      return `extension-slots 中的 ${ext} 不在 display-order 中`;
    }
  }

  const unknownInOrder = registry.displayOrder.filter(
    (id) => !CANONICAL_SET.has(id) && !registry.extensions.includes(id),
  );
  if (unknownInOrder.length > 0) {
    return `display-order 含未声明 slot：${unknownInOrder.join(", ")}（须列入 extension-slots 或改为 canonical id）`;
  }

  return null;
}
