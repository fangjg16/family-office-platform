# Slot Rendering Rules

Use this file when rendering or refreshing KB sections. These rules preserve the v2.7 component choices while allowing v2.8 to use structured JSON.

| Slot | Default rendering pattern | Structured key |
|---|---|---|
| `snapshot` | concise key-facts table / bullets | `facts`, `items` |
| `assets` | asset/resource table, split by asset if multi-asset | `rows`, `assets` |
| `legal-relationships` | org chart for entity/control structure; relationship table when chart is not enough | `entities`, `relationships`, `rows` |
| `business-model` | choose one or more v2.7 visualization: journey map, process flow, BMC, revenue tree, value chain, flywheel, ecosystem map; then supporting assumptions | `journey`, `processFlow`, `canvas`, `revenueTree`, `valueChain`, `flywheel`, `ecosystemMap`, `valuationBox`, `rows` |
| `capital-structure` | sources & uses / capital stack table | `sourcesUses`, `capitalStack`, `rows` |
| `comps` | comparable table with signal and caveat | `rows` |
| `returns` | optional valuation box, scenario cards, assumptions/sensitivity table | `valuationBox`, `valuationBoxes`, `scenarios`, `assumptions`, `sensitivities` |
| `timeline` | v2.7 dedicated timeline: 8.1/8.2 vertical items, 8.1 `.tl-tree` when dense, 8.3 future-node table | `rows` |
| `risks` | risk matrix: level / risk / evidence / mitigation | `rows` |
| `open-questions` | P1/P2/P3 grouped question cards | `groups`, `items` |
| `decision-framework` | recommendation callout + optional valuation box + investment theses + value-add levers + option comparison + blockers + next actions | `recommendation`, `recommendationReason`, `valuationBox`, `valuationBoxes`, `theses`, `valueLevers`, `options`, `blockers`, `pros`, `cons`, `nextActions` |

If structured keys are present, prefer the renderer over hand-written HTML. If the section needs a highly custom visualization, hand-written `html` is allowed, but it must reuse `assets/components.html` classes and satisfy `references/slot-specific-rules.md`.

Alignment rule: every populated slot must keep both layers:

- Content layer: satisfy the slot's required coverage in `references/slot-specific-rules.md`.
- Structure layer: use the default component pattern above unless the project truly needs a custom v2.7 component.

Do not solve depth loss by adding a generic "analysis depth" paragraph. Preserve depth by keeping slot-level fields such as `evidence`, `gap`, `owner`, `trigger`, `caveat`, `sensitivity`, `source`, and `nextAction` wherever the slot calls for them.

Advanced component rule: Revenue Tree, Value Chain, Flywheel, Ecosystem Map, and Valuation Box are optional v2.7 components. Use them only when the project facts call for that structure; do not force all of them into every KB.
