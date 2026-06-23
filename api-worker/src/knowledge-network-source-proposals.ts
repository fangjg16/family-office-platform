import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { StructuredKbSource } from "./knowledge-network-structured-kb-data-types";
import { normalizeStructuredKbSources } from "./knowledge-network-structured-kb-data";

export type SourceProposalInput = {
  /** 临时 key（batch 引用 source-{sourceKey}）；非最终 U-N/A-N */
  sourceKey?: string;
  proposalKey?: string;
  type: string;
  title: string;
  author?: string;
  excerpt?: string;
  usedIn?: CanonicalKbSlot[];
};

function normalizeKey(title: string, type: string): string {
  return `${type.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
}

function proposalKeys(p: SourceProposalInput): string[] {
  const keys: string[] = [];
  if (p.sourceKey?.trim()) keys.push(p.sourceKey.trim());
  if (p.proposalKey?.trim()) keys.push(p.proposalKey.trim());
  return keys;
}

function nextId(registry: StructuredKbSource[], prefix: "U" | "A"): string {
  let max = 0;
  for (const s of registry) {
    const m = s.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${max + 1}`;
}

/** Worker 去重 sourceProposals 并分配 Appendix A id */
export function mergeSourceProposalsIntoRegistry(
  baseRegistry: StructuredKbSource[],
  batches: { batchIndex: number; proposals: SourceProposalInput[] }[],
): {
  registry: StructuredKbSource[];
  added: number;
  proposalKeyToId: Map<string, string>;
} {
  const byTitle = new Map<string, StructuredKbSource>();
  const proposalKeyToId = new Map<string, string>();
  for (const s of baseRegistry) {
    byTitle.set(normalizeKey(s.title, s.type), s);
    proposalKeyToId.set(s.id.replace(/^source-/, ""), s.id.replace(/^source-/, ""));
  }

  const merged = [...baseRegistry];
  let added = 0;

  for (const batch of batches) {
    for (const p of batch.proposals) {
      const title = p.title?.trim();
      const type = p.type?.trim() || "引用";
      if (!title) continue;

      const titleKey = normalizeKey(title, type);
      const existing = byTitle.get(titleKey);
      if (existing) {
        for (const k of proposalKeys(p)) {
          proposalKeyToId.set(k, existing.id.replace(/^source-/, ""));
        }
        continue;
      }

      const isPublic = /公开|第三方|政府|监管|审计|年报|market|public/i.test(type);
      const id = nextId(merged, isPublic ? "A" : "U");
      const source: StructuredKbSource = {
        id,
        type,
        title,
        author: p.author?.trim(),
        excerpt: p.excerpt?.trim(),
        usedIn: p.usedIn,
      };
      byTitle.set(titleKey, source);
      merged.push(source);
      for (const k of proposalKeys(p)) {
        proposalKeyToId.set(k, id);
      }
      proposalKeyToId.set(id, id);
      added += 1;
    }
  }

  const normalized = normalizeStructuredKbSources(merged);
  if (normalized.error) {
    return { registry: baseRegistry, added: 0, proposalKeyToId };
  }
  return { registry: normalized.normalized, added, proposalKeyToId };
}
