# Content Rules · v2.91

Use this file before writing to any slot. The purpose is to prevent slot drift.

## Routing Table

| Content type | Target slot |
|---|---|
| Project identity, stage, counterparty, indicative price, maturity one-liner | `snapshot` |
| What is being bought/built/licensed/controlled; asset/product/platform facts | `target-overview` |
| Channels, advisors, suppliers, government/industry relationships, key people, non-ownership execution resources | `resource-network` |
| Market size, demand, cycle, policy background, macro/trade statistics, pricing benchmarks | `industry-market` |
| Customer, payer, product use case, pricing, revenue, cost, unit economics, fulfillment, operating KPI | `business-operations` |
| Holding entities, shareholders, UBO, title, IP/contract rights, transferability, encumbrances, related parties | `legal-ownership` |
| Licenses, permits, approvals, privacy/data, cross-border, platform/content rules, industry compliance | `regulatory-compliance` |
| Comparable transactions, benchmark platforms, competitive cases, valuation/operating references | `comps-benchmark` |
| Investment amount, valuation, IRR, MOIC, scenarios, sensitivity, sources/uses, exit economics | `valuation-returns` |
| Claim audit, evidence grade, contradictions, missing docs, open questions, owner, urgency, blocker status | `diligence-gaps` |
| Concrete failure modes, likelihood/impact, mitigation, red flags, stop conditions | `risks-mitigation` |
| Project-level dated milestones, active workstreams, approvals/signatures/meetings, future decision gates | `timeline-milestones` |
| Investment thesis, options, trade-offs, recommendation, IC readiness, value-creation plan, next actions | `decision-framework` |
| Source title, authoring party, excerpt, affected slots | Appendix A `source-index` |
| Term definitions | Appendix B `glossary` |
| Field definitions, formulas, data samples, cleaning logic, model assumptions, chart caveats | Appendix C `data-dictionary` |
| KB versions, parent version, change history, historical snapshots | Appendix D `version-ledger` |

## Boundary Rules

- `business-operations` is target/platform economics. `valuation-returns` is investor economics.
- `legal-ownership` is who owns or controls rights. `regulatory-compliance` is what external rules must be satisfied.
- `resource-network` is execution leverage, not equity ownership.
- `industry-market` is context; it should not become project progress.
- `timeline-milestones` is project execution only, not a dated-news dump.
- `diligence-gaps` is operational missing evidence; `risks-mitigation` is failure modes and mitigations.
- `decision-framework` synthesizes across slots; it should not be a dumping ground for unresolved details.

## Timeline-Specific Rule

Every candidate dated item must pass the timeline eligibility gate in `references/timeline-rules.md` before entering `timeline-milestones`. If `timelineEligible=false`, route it to the analytical slot it supports.

## Citation and Certainty

Every filled fact should carry a source reference or an explicit reason why it is an analyst inference. Party statements and analyst inferences require attribution. Do not let AI-generated conclusions increase source diversity.
