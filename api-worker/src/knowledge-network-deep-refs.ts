import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";

/** Short deep ref filenames under references/deep/ */
export const DEFAULT_KB_DEEP_REF_FILES = [
  "knowledge-base-generation.md",
  "project-intake.md",
  "public-info-search.md",
  "dd-claim-audit.md",
  "compliance-check.md",
  "risk-matrix.md",
  "returns-analysis.md",
] as const;

export type KbDeepRefFile = (typeof DEFAULT_KB_DEEP_REF_FILES)[number];

/** Full paths for required-reads injection (stable order) */
export const DEFAULT_KB_DEEP_REFS = DEFAULT_KB_DEEP_REF_FILES.map(
  (f) => `references/deep/${f}`,
) as readonly string[];

/**
 * Slot → deep refs (aligned with opportunistic-investments-hermes SKILL.md).
 * timeline-milestones: timeline-rules.md only (no deep refs by default).
 * risks-mitigation: includes compliance + returns for legal/economic risk coverage.
 */
export const DEEP_REFS_BY_SLOT: Readonly<Record<CanonicalKbSlot, readonly KbDeepRefFile[]>> = {
  snapshot: ["project-intake.md", "knowledge-base-generation.md"],
  "target-overview": ["public-info-search.md", "dd-claim-audit.md"],
  "resource-network": ["public-info-search.md", "dd-claim-audit.md"],
  "industry-market": ["public-info-search.md", "dd-claim-audit.md"],
  "business-operations": ["dd-claim-audit.md", "returns-analysis.md"],
  "legal-ownership": ["compliance-check.md", "dd-claim-audit.md"],
  "regulatory-compliance": ["compliance-check.md", "dd-claim-audit.md"],
  "comps-benchmark": ["public-info-search.md", "dd-claim-audit.md"],
  "valuation-returns": ["returns-analysis.md", "dd-claim-audit.md"],
  "diligence-gaps": ["dd-claim-audit.md", "project-intake.md"],
  "risks-mitigation": ["risk-matrix.md", "compliance-check.md", "returns-analysis.md"],
  "timeline-milestones": [],
  "decision-framework": ["knowledge-base-generation.md", "risk-matrix.md", "returns-analysis.md"],
};

function deepRefPath(file: KbDeepRefFile): string {
  return `references/deep/${file}`;
}

/** initial/full → all 7; incremental → union by touched slots; reorder → none */
export function resolveKnowledgeNetworkDeepRefs(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: readonly CanonicalKbSlot[] = [],
): string[] {
  if (mode === "reorder") return [];

  if (mode === "initial" || mode === "full") {
    return [...DEFAULT_KB_DEEP_REFS];
  }

  if (touchedSlots.length === 0) return [];

  const found = new Set<KbDeepRefFile>();
  for (const slot of touchedSlots) {
    for (const file of DEEP_REFS_BY_SLOT[slot] ?? []) {
      found.add(file);
    }
  }

  return DEFAULT_KB_DEEP_REF_FILES.filter((f) => found.has(f)).map(deepRefPath);
}

export function buildKnowledgeNetworkDeepRefResolutionLines(
  mode: KnowledgeNetworkUpdateMode,
  touchedSlots: readonly CanonicalKbSlot[],
): string {
  const refs = resolveKnowledgeNetworkDeepRefs(mode, touchedSlots);
  if (refs.length === 0) return "";
  const label =
    mode === "initial" || mode === "full"
      ? "默认 7 个 short deep refs（initial/full）"
      : `增量点名 slot 映射 deep refs：${touchedSlots.join(", ")}`;
  return ["", `【Deep refs · ${label}】`, refs.map((r) => `- ${r}`).join("\n")].join("\n");
}

/** Coverage report for tests */
export function deepRefSlotCoverage(): Record<CanonicalKbSlot, string[]> {
  const out = {} as Record<CanonicalKbSlot, string[]>;
  for (const slot of CANONICAL_KB_SLOTS) {
    out[slot] = (DEEP_REFS_BY_SLOT[slot] ?? []).map(deepRefPath);
  }
  return out;
}
