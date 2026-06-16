# Slot-Specific Rules

Use this file for full KB generation, major refreshes, or when filling a specific canonical slot. These are compressed per-slot coverage requirements (portable KB visual style), not a generic depth checklist.

General rule: do not invent coverage. If a required item is missing, render a specific gap or stub that says what source can answer it and what analysis it unlocks.

## `snapshot` - 项目快照

Must cover: project/deal identity, asset/package name, jurisdiction, current stage, parties, proposed transaction or ask if known, key blocker, and current recommendation posture. Do not let the snapshot become a narrative summary; it should orient the reader quickly.

## `assets` - 资产构成 / 平台能力与资源

Must cover: what the project actually owns, controls, can access, or claims to access; asset scale/location/status; permits/licenses/quotas/data/platform resources; encumbrances or dependency on third parties. For multi-asset projects, split by asset and keep the package name at the top level.

## `legal-relationships` - 法律结构与关键关系网

Must cover: entity chain, ownership/UBO if known, key counterparties, contractual rights and obligations, license/permit holders, relationship dependencies, related-party issues, litigation/regulatory flags, and what remains unverified.

## `business-model` - 业务模式与收入假设

Must cover: revenue path, customer/buyer, product/service/commodity, pricing basis, supply chain or delivery path, cost/margin drivers, operating bottlenecks, and evidence quality. This is how the target/project makes money; do not mix it with investor returns.

## `capital-structure` - 融资结构与资本结构

Must cover: transaction amount or ask, current capitalization if known, equity/debt split, sources and uses, repayment/security/priority, funding timing, dilution, covenants or consent requirements, and missing term-sheet items.

## `comps` - 市场对标与可比交易

Must cover: named comparables or datasets, why each is comparable, why each may not be comparable, price/multiple/volume signal, recency, source quality, and what valuation or market conclusion follows. Avoid generic market heat claims without comparables.

## `returns` - 投资回报与敏感性分析

Must cover: investor cash-flow logic, entry assumptions, exit/repayment assumptions, base/upside/downside cases, IRR/MOIC/cash-on-cash/payback when numbers allow, top sensitivity drivers, breakpoints, and which missing inputs block reliable modeling.

## `timeline` - 项目时间轴

**Not a dated-news dump.** Apply `references/timeline-rules.md` eligibility gate on every candidate (`scope` / `timelineEligible` / `reason`).

Three blocks: 已发生关键事件 / 正在推进 / 未来关键节点. Only **project / target / counterparty / asset / regulator-on-this-deal** dynamics, current workstreams, and future **project** gates.

**Exclude from timeline:** industry trends, tech trends, market size, platform launches, generic news/policy background, data sample periods, internal/AI workflow.

**Redirect when ineligible:** industry/market → `comps`, `business-model`, `decision-framework`; policy background → `risks`, `legal-relationships`; sources → Appendix A.

**Stub:** if zero `timelineEligible=true` events, keep slot + three headings + `callout missing` (project-specific gap); do not fill with industry events.

## `risks` - 关键风险与缓释

Must render as a risk matrix, not loose prose. Each row must include:

- level: `致命`, `高`, `中`, or `低`;
- specific risk scenario, written as a concrete failure mode;
- evidence basis, with certainty tag and source;
- mitigation measure or mitigation gap;
- owner/controller, trigger, and affected value driver where known.

Preserve established KB information density: the reader should see "级别 / 风险 / 证据 / 缓释措施" in one scan. Avoid generic risk labels such as "market risk" unless tied to a concrete mechanism, consequence, and mitigation.

## `open-questions` - 待确认问题清单

Must render as prioritized question groups, not a flat missing-data callout. Group by `P1 紧急`, `P2 重要`, `P3 跟进` or equivalent. Each item must include:

- exact question;
- responsible party or suggested source;
- why it matters or what downstream analysis it unlocks;
- status if partially answered;
- next action.

Preserve established KB information density: each group should display its count and keep the original question wording when user/meeting questions exist. Missing data should be operational, not vague.

## `decision-framework` - 决策框架

Must cover: recommendation posture and one-sentence reason; 3-5 investment theses, each tied to evidence; value-creation levers with amount/value, probability, and time window where known; conditions to proceed; conditions to pause/kill; blocker confirmations; scenario/option trade-off; and next actions with owner and deadline/window. It should synthesize the KB rather than repeat it.
