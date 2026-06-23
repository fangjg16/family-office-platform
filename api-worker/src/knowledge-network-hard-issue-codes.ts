/** Worker hard issue codes：merge repair / publish gate 共用 */
export const HARD_SLOT_ISSUE_CODES = [
  "fabricated_license",
  "fabricated_comp",
  "fabricated_irr",
  "fabricated_partnership",
  "fabricated_risk",
  "payload_missing",
  "risk_rows_missing",
  "unmapped_row_keys",
  "invalid_component_type",
] as const;

export type HardSlotIssueCode = (typeof HARD_SLOT_ISSUE_CODES)[number];

export const HARD_SLOT_ISSUE_CODE_SET = new Set<string>(HARD_SLOT_ISSUE_CODES);

export function isHardSlotIssueCode(code: string): boolean {
  return HARD_SLOT_ISSUE_CODE_SET.has(code);
}
