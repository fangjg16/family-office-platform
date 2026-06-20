import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";

/** 通用 structured patch primitives（纯数据，禁止 HTML） */
export type GapCallout = { text: string; confidence?: "gap" | "low" };

export type NarrativeBlock = {
  heading?: string;
  paragraphs: string[];
};

export type MetricCard = {
  label: string;
  value: string;
  note?: string;
};

export type TableRow = Record<string, string>;

export type RelationshipEdge = {
  relation: string;
  from: string;
  to: string;
  status?: string;
  risk?: string;
};

export type TimelineItem = {
  date?: string;
  title: string;
  detail: string;
  phase: "occurred" | "inProgress" | "future";
  evidenceSourceIds?: string[];
};

export type RiskRow = {
  level: string;
  risk: string;
  cause?: string;
  impact?: string;
  mitigation?: string;
  trigger?: string;
  evidenceSourceIds?: string[];
};

export type QuestionItem = {
  priority?: string;
  question: string;
  whyItMatters?: string;
  owner?: string;
  requiredEvidence?: string;
};

export type QuestionGroup = {
  priority: string;
  title?: string;
  questions: QuestionItem[];
};

export type ScenarioRow = {
  label: string;
  value: string;
  detail?: string;
};

export type SnapshotPayload = {
  title?: string;
  subtitle?: string;
  stage?: string;
  status?: string;
  oneLineJudgment?: string;
  maturityMetrics?: MetricCard[];
  overview?: NarrativeBlock[];
  keyFacts?: TableRow[];
  gaps?: GapCallout[];
};

export type TargetOverviewPayload = {
  businessSummary?: NarrativeBlock[];
  assetSummary?: TableRow[];
  transactionSummary?: TableRow[];
  keyClaims?: TableRow[];
  gaps?: GapCallout[];
};

export type IndustryMarketPayload = {
  marketSize?: TableRow[];
  marketDrivers?: TableRow[];
  valueChain?: TableRow[];
  policyContext?: TableRow[];
  comparableSignals?: TableRow[];
  gaps?: GapCallout[];
};

export type BusinessOperationsPayload = {
  journeyMap?: { stages: string[]; lanes?: Array<{ label: string; nodes: string[] }> };
  revenueTree?: TableRow[];
  flywheel?: NarrativeBlock[];
  operatingBottlenecks?: TableRow[];
  customerBuyer?: TableRow[];
  pricing?: TableRow[];
  supplyChain?: TableRow[];
  gaps?: GapCallout[];
};

export type LegalOwnershipPayload = {
  entities?: TableRow[];
  ownershipClaims?: TableRow[];
  contractRights?: TableRow[];
  licenseRights?: TableRow[];
  relationshipEdges?: RelationshipEdge[];
  unresolvedLegalIssues?: GapCallout[];
};

export type RegulatoryCompliancePayload = {
  jurisdictionRows?: TableRow[];
  licenseRequirements?: TableRow[];
  complianceRisks?: TableRow[];
  approvalPath?: TableRow[];
  privacyOrDataRules?: TableRow[];
  gaps?: GapCallout[];
};

export type ResourceNetworkPayload = {
  parties?: TableRow[];
  resources?: TableRow[];
  capabilities?: TableRow[];
  dependencies?: TableRow[];
  relationshipEdges?: RelationshipEdge[];
  missingResources?: GapCallout[];
};

export type CompsBenchmarkPayload = {
  compsRows?: TableRow[];
  transactionCases?: TableRow[];
  benchmarkMetrics?: TableRow[];
  valuationReference?: TableRow[];
  relevanceNotes?: GapCallout[];
};

export type ValuationReturnsPayload = {
  investmentCashflow?: TableRow[];
  scenarios?: ScenarioRow[];
  sensitivityItems?: TableRow[];
  returnDrivers?: TableRow[];
  downsideCases?: TableRow[];
  benchmarkMetrics?: TableRow[];
  gaps?: GapCallout[];
};

export type DiligenceGapsPayload = {
  questionGroups: QuestionGroup[];
};

export type RisksMitigationPayload = {
  riskRows: RiskRow[];
  stopConditions?: TableRow[];
};

export type TimelineMilestonesPayload = {
  occurred?: TimelineItem[];
  inProgress?: TimelineItem[];
  future?: TimelineItem[];
  gaps?: GapCallout[];
};

export type DecisionFrameworkPayload = {
  recommendation?: string;
  goNoGoConditions?: TableRow[];
  decisionTable?: TableRow[];
  nextActions?: TableRow[];
  openConditions?: GapCallout[];
  triggers?: TableRow[];
};

export type SlotPayloadBySlot = {
  snapshot: SnapshotPayload;
  "target-overview": TargetOverviewPayload;
  "industry-market": IndustryMarketPayload;
  "business-operations": BusinessOperationsPayload;
  "legal-ownership": LegalOwnershipPayload;
  "regulatory-compliance": RegulatoryCompliancePayload;
  "resource-network": ResourceNetworkPayload;
  "comps-benchmark": CompsBenchmarkPayload;
  "valuation-returns": ValuationReturnsPayload;
  "diligence-gaps": DiligenceGapsPayload;
  "risks-mitigation": RisksMitigationPayload;
  "timeline-milestones": TimelineMilestonesPayload;
  "decision-framework": DecisionFrameworkPayload;
};

export type StructuredPatchOperation =
  | "replace-slot-data"
  | "append-items"
  | "update-fields";

export type StructuredPatchStatus = "blocked" | "requires_full_update";

export const STRUCTURED_SLOT_PATCH_TYPE = "structured-slot-patch" as const;
export const STRUCTURED_SLOT_PATCH_SCHEMA_VERSION = "2.91" as const;

export type StructuredSlotPatch<S extends CanonicalKbSlot = CanonicalKbSlot> = {
  type: typeof STRUCTURED_SLOT_PATCH_TYPE;
  schemaVersion: typeof STRUCTURED_SLOT_PATCH_SCHEMA_VERSION;
  mode: "incremental";
  slot: S;
  operation: StructuredPatchOperation;
  payload: SlotPayloadBySlot[S];
  summary?: string;
  status?: StructuredPatchStatus;
};

export type StructuredSlotPatchAny = {
  [K in CanonicalKbSlot]: StructuredSlotPatch<K>;
}[CanonicalKbSlot];
