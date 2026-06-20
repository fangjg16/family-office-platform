import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

export const STRUCTURED_KB_DATA_TYPE = "structured-kb-data" as const;
export const STRUCTURED_KB_DATA_SCHEMA_VERSION = "2.91" as const;

export type StructuredKbRenderingMode = "chinese-only" | "bilingual";

export type StructuredKbSource = {
  id: string;
  type: string;
  title: string;
  author?: string;
  excerpt?: string;
  usedIn?: CanonicalKbSlot[];
};

export type StructuredKbGlossaryTerm = {
  term: string;
  definition: string;
  context?: string;
};

export type StructuredKbDataDictionaryEntry = {
  field: string;
  definition?: string;
  formula?: string;
  sample?: string;
  caveat?: string;
};

export type StructuredKbConfig = {
  displayOrder?: CanonicalKbSlot[];
  projectType?: string;
  renderingMode?: StructuredKbRenderingMode;
  multiAsset?: boolean;
  configVersion?: number;
};

export type StructuredKbMeta = {
  title: string;
  subtitle?: string;
  mastheadSubtitle?: string;
  lead?: string;
  autoSummary: string;
  navTitle?: string;
  status?: string;
  stage?: string;
  footerBrand?: string;
  version?: string;
  date?: string;
};

export type StructuredKbMaturity = {
  factorA: string;
  factorANote?: string;
  factorB: string;
  factorBNote?: string;
  combined: string;
  tier?: string;
};

export type StructuredKbSlots = {
  [K in CanonicalKbSlot]: SlotPayloadBySlot[K];
};

export type StructuredKbData = {
  type: typeof STRUCTURED_KB_DATA_TYPE;
  schemaVersion: typeof STRUCTURED_KB_DATA_SCHEMA_VERSION;
  mode: "initial" | "full";
  summary?: string;
  config: StructuredKbConfig;
  meta: StructuredKbMeta;
  maturity: StructuredKbMaturity;
  slots: StructuredKbSlots;
  sources: StructuredKbSource[];
  terms?: StructuredKbGlossaryTerm[];
  dataDictionary?: StructuredKbDataDictionaryEntry[];
};
