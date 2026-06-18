# Slot-Specific Rules · v2.91

Use this file for full KB generation, major refreshes, or when filling a specific canonical slot. These are slot-specific coverage requirements, not a generic depth checklist.

General rule: do not invent coverage. If a required item is missing, render a specific gap or stub that says what source can answer it and what analysis it unlocks.

## `snapshot` - 项目快照

Must cover: project/deal identity, package name, jurisdiction, project type, current stage, counterparties, proposed transaction/ask if known, indicative price/range if known, maturity posture, key gating issue, and one-sentence judgment. Do not let snapshot become a narrative summary; complete legal analysis, regulatory analysis, risks, and investment recommendation belong elsewhere.

## `target-overview` - 资产构成 / 标的概况

Must answer: what exactly is being acquired, controlled, licensed, funded, or built.

Must cover: asset/product/platform definition; physical or digital asset list; scale/location/capacity; rights, data, IP, permits, licenses, approval status, deliverables, condition, and evidence gaps. For light-asset/IP/platform projects, do not force hard-asset language; explicitly list rights assets, data/material assets, production capability, reusable tools, and investmentability.

For multi-asset projects, partition by asset and keep the deal/package name at the top level.

## `resource-network` - 资源关系与关键协作网络

Must cover: non-ownership resources that make execution possible: channels, suppliers, operators, advisors, government/regulatory access paths, industry relationships, customer access, platform partners, and key individuals.

Each material relationship should include: who the resource is, why it matters, relationship strength, verification status, whether it depends on an individual, and what breaks if it is not available. Do not duplicate legal ownership unless the relationship creates control, related-party risk, or formal rights.

## `industry-market` - 行业背景与市场格局

Must cover: market size, demand drivers, pricing/volume benchmarks, policy background, cycle position, competitive structure, trade/macro signals, data limitations, and how the market context affects this specific project.

Market background is not project timeline. Dated industry history belongs here, not in `timeline-milestones`.

## `business-operations` - 业务模式与运营假设

Must answer: how the target/platform makes money and what operating evidence shows the model can be executed.

Must cover: application/product scenarios, customers/audience/paid users, payer, revenue streams, pricing basis, unit economics, cost structure, supply chain or fulfillment path, operating KPIs, customer acquisition/retention where relevant, bottlenecks, and assumptions still awaiting validation.

Use one or more business visualizations when useful: Journey Map, Process Flow, BMC, Revenue Tree, Value Chain, Flywheel, Ecosystem Map. The chart is not enough; always follow it with operating validation tables for customers, pricing, costs, KPIs, and unverified assumptions.

Do not put investor IRR/MOIC/exit economics here. Those belong in `valuation-returns`.

## `legal-ownership` - 法律结构与权属关系

Must cover: holding structure, entity chain, shareholders/UBO, directors/controllers, title/registry evidence, asset/IP/contract rights ownership, transferability, sublicensing, exclusivity, encumbrances, pledge/security, related-party issues, conflicts, litigation flags, and what remains unverified.

Do not replace rights/ownership facts with compliance obligations. Compliance obligations belong in `regulatory-compliance`.

## `regulatory-compliance` - 监管合规与许可路径

Must cover: applicable regulator/law, regulatory route, licenses, permits, approvals, filings, privacy/data/cross-border requirements, advertising/content/platform rules, industry-specific compliance, prohibited conduct, timing, status, blockers, and primary-source basis.

For regulated projects, identify gating approvals and red lines. If current status is unknown, render it as a gap with the authority/source needed.

## `comps-benchmark` - 市场对标与可比案例

Must cover: named comparable transactions, benchmark platforms, operating cases, market datasets, why each is comparable, why it may not be comparable, price/multiple/volume/operating signal, recency, source quality, and the valuation or positioning conclusion.

Avoid generic "market is hot" claims without comparables or data.

## `valuation-returns` - 投资回报与敏感性分析

Must cover: investor economics; entry price/amount, sources/uses if relevant, valuation method, cash-flow logic, base/upside/downside cases, IRR/MOIC/cash-on-cash/payback when numbers allow, exit/repayment assumptions, key sensitivities, breakpoints, funding constraints, and which missing inputs block reliable modeling.

Transaction capital and financing are no longer a standalone slot. Put investor capital structure, sources/uses, and funding economics here; execution blockers go to `diligence-gaps` or `risks-mitigation`.

## `diligence-gaps` - 待确认问题 / 尽调缺口

Must render as an evidence/gap register plus prioritized question groups, not a vague missing-data paragraph.

Each item should include: exact claim/question, evidence status or grade, contradiction if any, responsible party or suggested source, urgency, whether it blocks decision, why it matters, and next action. Preserve user/meeting question wording where it exists.

## `risks-mitigation` - 关键风险与缓释

Must render as a risk register, not loose prose. Each row should include:

- level/severity;
- specific risk scenario, written as a concrete failure mode;
- category;
- likelihood and impact where known;
- evidence basis with certainty/source;
- current mitigation or mitigation gap;
- owner/controller/status;
- trigger and affected value driver where known.

Red-flag risks and stop/pause conditions must be separated when present. Avoid generic risk labels unless tied to mechanism, consequence, and action.

## `timeline-milestones` - 项目时间轴

Use the three-block structure in `references/timeline-rules.md`: 已发生关键事件 / 正在推进 / 未来关键节点.

Only include project dynamics, current workflows, external dependencies, approvals, signatures, meetings, and future decision gates. Exclude AI/internal workflow actions, evidence windows, market datasets, industry history, policy background dates, and research periods.

When no project-level timeline event is available, keep the section shell and render a missing-data stub instead of filling it with industry news.

## `decision-framework` - 决策框架、投资论点与下一步

Must synthesize the KB into a decision posture. Must cover: recommendation and one-sentence reason; 3-5 investment theses tied to evidence; preconditions to proceed; conditions to pause/kill; key options and trade-offs; value creation levers with amount/value/probability/time window where known; IC readiness; blocker confirmations; and next actions with owner and deadline/window.

Do not merely repeat the current assumptions. The reader should understand why the project is worth continuing, under what conditions it becomes investable, and what must happen next.
