import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SourceProposalInput } from "./knowledge-network-source-proposals";
import type {
  StructuredKbData,
  StructuredKbSource,
} from "./knowledge-network-structured-kb-data-types";

export const KB_FRAGMENT_BATCH_TYPE = "kb-fragment-batch" as const;
export const KB_FRAGMENT_BATCH_SCHEMA_VERSION = "2.91" as const;

export type KbAppendixFragmentSlot = "glossary" | "data-dictionary";

export type KbFragmentBatchAppendixFragments = Partial<
  Record<KbAppendixFragmentSlot, string | null>
>;

export type KbFragmentBatchPayload = {
  type: typeof KB_FRAGMENT_BATCH_TYPE;
  schemaVersion: typeof KB_FRAGMENT_BATCH_SCHEMA_VERSION;
  mode: KnowledgeNetworkUpdateMode;
  batchIndex: number;
  fragments: Partial<Record<CanonicalKbSlot, string>>;
  appendixFragments?: KbFragmentBatchAppendixFragments | null;
  sourceProposals?: SourceProposalInput[];
  summary?: string;
};

export type KbFragmentAssemblyShell = Pick<
  StructuredKbData,
  "config" | "meta" | "maturity" | "sources" | "schemaVersion" | "summary" | "mode"
>;

export type KbFragmentAssemblyInput = {
  shell: KbFragmentAssemblyShell;
  fragments: Partial<Record<CanonicalKbSlot, string>>;
  appendixFragments?: Partial<Record<KbAppendixFragmentSlot, string>>;
};

export type SlotFragmentDeliveryStatus =
  | "delivered"
  | "gap-first"
  | "worker-stub"
  | "undelivered";

export type KbFragmentBatchExtractResult =
  | { ok: true; batch: KbFragmentBatchPayload }
  | { ok: false; reason: string };

export type KbFragmentValidationResult =
  | { ok: true; slot: CanonicalKbSlot | KbAppendixFragmentSlot; html: string }
  | { ok: false; slot: CanonicalKbSlot | KbAppendixFragmentSlot; reason: string; level: "L1" | "L2" | "L3" };

export type KbFragmentAssembleResult =
  | { ok: true; html: string; missingSlots: [] }
  | { ok: false; error: string; missingSlots?: CanonicalKbSlot[] };

export type KbFragmentRegistryContext = {
  /** Appendix A 中已登记 source id（不含 source- 前缀亦可，内部会 normalize） */
  knownSourceIds: ReadonlySet<string>;
};
