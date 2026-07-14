/** v2.91 core analysis slots (13) */
export const CANONICAL_KB_SLOTS = [
  "snapshot",
  "target-overview",
  "industry-market",
  "business-operations",
  "legal-ownership",
  "regulatory-compliance",
  "resource-network",
  "comps-benchmark",
  "valuation-returns",
  "diligence-gaps",
  "risks-mitigation",
  "timeline-milestones",
  "decision-framework",
] as const;

/** Appendix A–D */
export const KB_APPENDIX_SLOTS = [
  "source-index",
  "glossary",
  "data-dictionary",
  "version-ledger",
] as const;

export type CanonicalKbSlotId = (typeof CANONICAL_KB_SLOTS)[number];
