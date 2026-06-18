# Slot Rendering Rules · v2.91

Use this file when rendering or refreshing KB sections. These rules preserve information density while aligning the page to the v2.91 schema.

| Slot | Default rendering pattern | Structured key |
|---|---|---|
| `snapshot` | fixed key-facts table + one-line judgment / optional gating warning | `facts`, `items`, `gatingWarning` |
| `target-overview` | asset/product/platform table, split by asset if multi-asset | `rows`, `assets`, `rightsAssets`, `deliverables` |
| `resource-network` | relationship/resource network table; optional ecosystem map when multi-sided | `actors`, `relationships`, `rows`, `ecosystemMap` |
| `industry-market` | market/policy/data table with signal and implication | `rows`, `drivers`, `policySignals`, `marketData`, `datasets` |
| `business-operations` | one or more business visualizations plus operating validation tables | `journey`, `processFlow`, `canvas`, `revenueTree`, `valueChain`, `flywheel`, `ecosystemMap`, `customers`, `unitEconomics`, `kpis`, `assumptions`, `rows` |
| `legal-ownership` | org chart for ownership/control; rights/encumbrance table | `entities`, `relationships`, `rights`, `rows` |
| `regulatory-compliance` | compliance matrix: requirement / authority / current status / blocker / next action | `approvals`, `licenses`, `rules`, `redFlags`, `rows` |
| `comps-benchmark` | comparable/benchmark table with signal, caveat, implication | `rows`, `cases`, `datasets` |
| `valuation-returns` | valuation box, scenario cards, assumptions, sensitivity, sources/uses if relevant | `valuationBox`, `valuationBoxes`, `scenarios`, `assumptions`, `sensitivities`, `capitalUses`, `rows` |
| `diligence-gaps` | claim/evidence register + P1/P2/P3 grouped question cards | `claims`, `groups`, `items`, `rows` |
| `risks-mitigation` | risk register + red-flag/stop-condition table | `rows`, `redFlags`, `stopConditions` |
| `timeline-milestones` | three-block timeline: 8.1 past / 8.2 ongoing / 8.3 future nodes | `rows` |
| `decision-framework` | recommendation callout + theses + preconditions + option trade-off + value levers + IC readiness + next actions | `recommendation`, `recommendationReason`, `theses`, `preconditions`, `options`, `tradeOffs`, `valueLevers`, `icReadiness`, `blockers`, `nextActions`, `rows` |

If structured keys are present, prefer the renderer over hand-written HTML. If the section needs a custom visualization, hand-written `html` is allowed, but it must reuse `assets/components.html` classes and satisfy `references/slot-specific-rules.md`.

Alignment rule: every populated slot must keep both layers:

- Content layer: satisfy the slot's required coverage in `references/slot-specific-rules.md`.
- Structure layer: use the default component pattern above unless the project truly needs a custom component.

Do not solve depth loss by adding a generic "analysis depth" paragraph. Preserve depth by keeping slot-level fields such as `evidence`, `gap`, `owner`, `trigger`, `caveat`, `sensitivity`, `source`, `nextAction`, `authority`, `status`, `blocker`, `unitEconomics`, and `assumption`.

## Business-Operations Visualization Selection

- Journey Map: multiple monetization or execution paths.
- Process Flow: one linear operational chain where step economics or fulfillment matters.
- BMC: stable single-business model and no better structure fits.
- Revenue Tree: revenue by product line, customer segment, geography, fee type, or share.
- Value Chain: where operating advantage or bottleneck sits in the chain.
- Flywheel: self-reinforcing loop (users, supply, content, data, channels, liquidity).
- Ecosystem Map: multi-sided platform or multiple actors exchanging value.

The visualization explains the mechanism; the tables verify whether the mechanism is real.
