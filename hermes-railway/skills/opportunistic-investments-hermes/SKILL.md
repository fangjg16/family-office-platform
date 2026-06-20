---
name: opportunistic-investments-hermes
description: Use inside Hermes/platform execution when generating, validating, rendering, or updating family-office Project Knowledge Base HTML. This Hermes v2.92 edition uses the 13-slot KB schema plus Appendix A-D and adds seven short default deep references for higher-quality full KB generation without loading the full Codex workflow system.
metadata:
  short-description: Hermes-ready opportunistic investment KB workflow v2.92
---

# Opportunistic Investments · Hermes v2.92

This is the Hermes-ready v2.92 edition. It keeps the lightweight v2.8/Hermes operating style, but the output schema is v2.91: 13 core analysis slots plus Appendix A-D. Route A applies: legacy v2.8 KBs should be rebuilt into v2.91 instead of patched in place.

## Core Rule

Establish evidence first, route each finding to the correct canonical slot, then analyze, then render or update the KB. Do not analyze from filenames alone. Use uploaded files, existing KB HTML, public sources, or user-provided facts with certainty labels.

## Quick Routing

| User intent | Read next | Prefer delivery |
|---|---|---|
| New KB / full refresh | Core rules + `references/structured-kb-data-schema.md` + `examples-kb-data.json` + default deep refs | **structured-kb-data** JSON → Worker render; PUT / full HTML **fallback only** |
| Incremental KB update (single slot) | Current KB HTML (read-only), touched slot rules, mapped deep refs | **structured-slot-patch** JSON; slot-html-patch / full HTML fallback |
| Incremental KB update (multi-slot) | Current KB HTML, touched slot rules | GET + edit + PUT, or structured-kb-data if user requests full refresh |
| Display-order change only | Current KB HTML and `references/kb-config.md` | `scripts/reorder_kb.py`, PUT |
| Research / diligence / legal / risk / valuation | `references/content-rules.md` to route findings, then the relevant slot coverage in `references/slot-specific-rules.md` | produce JSON handoff; merge/render only if KB is updated |
| Handoff from another workflow | `references/handoff-schema.md` | `scripts/merge_handoff.py` |

## Required Assets

- For **initial/full**: read `references/structured-kb-data-schema.md` and `examples-kb-data.json`; deliver **structured-kb-data** JSON that passes Worker **Full Quality Contract** (slot-specific coverage, not merely 13 keys). Worker renders `assets/kb-template.html` shell — Hermes must **not** hand-write the full page by default.
- For **incremental single-slot**: deliver **structured-slot-patch** JSON; Worker merges into existing HTML.
- For **PUT / HTML fallback** (when JSON cannot be delivered): use `assets/kb-template.html` as the only KB shell. Do not rewrite its CSS or JS.
- Use `references/kb-schema.md` for the v2.91 slot set.
- Use `references/kb-config.md` for display-order and project type defaults.
- Use `references/content-rules.md` for routing evidence into slots.
- Use `references/slot-specific-rules.md` for required coverage inside each slot.
- Use `references/slot-rendering-rules.md` for slot-specific components.
- Use `references/maturity-scoring.md` whenever creating a KB or editing the header scorecard.
- Use `references/timeline-rules.md` whenever touching `timeline-milestones`.
- For initial/full KB generation, also read the default short deep references in `references/deep/`: `knowledge-base-generation.md`, `project-intake.md`, `public-info-search.md`, `dd-claim-audit.md`, `compliance-check.md`, `risk-matrix.md`, and `returns-analysis.md`.
- For incremental updates, read only the deep reference(s) mapped to the touched slot; do not load all deep references.
- Use `assets/components.html` only when the task needs component class names or visual patterns. Do not load it by default for normal KB generation.
- Do not use old v2.7/v2.8 keys, root Claude plugin files, slash-command docs, or `KB_SPEC_LEGACY.md`.
- Do not expect Codex-only workflow files in this package. Hermes should rely on the schema, rules, template, and scripts.

## Default Deep References

These are Hermes-short references, not full Codex workflow playbooks. They are designed to improve analysis quality while keeping generation time controlled.

Read these seven by default for `initial` and `full` KB generation:

1. `references/deep/knowledge-base-generation.md`
2. `references/deep/project-intake.md`
3. `references/deep/public-info-search.md`
4. `references/deep/dd-claim-audit.md`
5. `references/deep/compliance-check.md`
6. `references/deep/risk-matrix.md`
7. `references/deep/returns-analysis.md`

For `incremental` updates, use this slot-to-deep-ref routing instead of reading all seven:

| Touched slot | Deep refs to read |
|---|---|
| `snapshot` | `project-intake.md`, `knowledge-base-generation.md` |
| `target-overview`, `resource-network`, `industry-market`, `comps-benchmark` | `public-info-search.md`, `dd-claim-audit.md` if claims need evidence audit |
| `business-operations` | `dd-claim-audit.md`, `returns-analysis.md` when economics are discussed |
| `legal-ownership`, `regulatory-compliance` | `compliance-check.md`, `dd-claim-audit.md` |
| `valuation-returns` | `returns-analysis.md`, `dd-claim-audit.md` |
| `diligence-gaps` | `dd-claim-audit.md`, `project-intake.md` |
| `risks-mitigation` | `risk-matrix.md`, plus `compliance-check.md` or `returns-analysis.md` if the risk is legal/regulatory or economic |
| `timeline-milestones` | `timeline-rules.md`; use deep refs only if the timeline changes risk, compliance, or returns |
| `decision-framework` | `knowledge-base-generation.md`, `risk-matrix.md`, `returns-analysis.md` |

Do not read deep refs for display-order-only `reorder` tasks.

## Deterministic Workflow For KB Work

1. Parse or create structured KB data using `references/kb-schema.md` and `references/structured-kb-data-schema.md` (initial/full) or structured-slot-patch (single-slot incremental).
2. Apply `references/content-rules.md` to route each finding to one or more canonical slots.
3. Apply `references/slot-specific-rules.md` for every slot being filled or materially refreshed.
4. Apply `references/slot-rendering-rules.md` so slot-specific visual structure is not flattened.
5. **Initial/full**: deliver one `structured-kb-data` JSON block meeting the Quality Contract; Worker renders KB-CONFIG, nav, slots, and appendices A–C. Do not thin-fill slots with minimal tables — follow `examples-kb-data.json` density. Worker recalculates maturity; Hermes self-scored percentages are not final.
6. **Incremental single-slot**: deliver one `structured-slot-patch` JSON block; Worker renders and merges the target section only.
7. **Fallback only**: render HTML with `scripts/render_kb_html.py` or PUT via `jfo_kb_put.sh` when JSON delivery is impossible.
8. Validate with `scripts/validate_kb_html.py` before PUT fallback delivery.
9. For display-order changes, run `scripts/reorder_kb.py`; do not regenerate content.

## v2.91 Gotchas

- The canonical schema has 13 core slots and 4 appendices. Do not use v2.8 keys such as `assets`, `business-model`, `returns`, `risks`, or `open-questions` in new KBs.
- `business-operations` is how the target/platform makes money and operates; `valuation-returns` is how the investor makes money.
- `legal-ownership` is who owns, controls, authorizes, transfers, or encumbers rights; `regulatory-compliance` is what external rules, permits, approvals, privacy/data, platform, and industry obligations must be satisfied.
- `resource-network` is non-ownership execution leverage: channels, advisors, government/industry relationships, suppliers, operators, and key people.
- `diligence-gaps` replaces old open questions plus claim/evidence gaps. It should include owner, urgency, blocker status, source needed, and what the answer unlocks.
- `timeline-milestones` is project execution only. Industry history, market trend dates, source coverage windows, AI/internal workflow actions, and research periods do not belong there.
- Appendix C `data-dictionary` is required whenever source data, dashboards, formulas, models, samples, cleaning logic, or chart assumptions are used.
- Appendix D `version-ledger` is required in v2.91.
- Header scorecard `.stat-value` cells must be percentages: Factor A%, Factor B%, Combined%. Counts and letter grades belong only in notes or tier labels.
- Factor A uses 13 hard-evidence slot scores. Factor B counts independent authoring parties, not file count or AI summaries.
- Multi-asset deals must be named at package level and scored per asset before averaging.
- Reorder means only `KB-CONFIG`, nav order, and section display numerals change. Content panels must remain unchanged.
- IC memo is a frozen decision snapshot; synthesize the KB, do not paste it.

## Business Operations Visual Selection

Use one main visual in `business-operations`, then always add operational validation tables.

| Pattern | Use when |
|---|---|
| Journey Map | There are two or more monetization, distribution, or exit paths that run in parallel or compete. |
| Process Flow | There is one main linear workflow and the value-add/margin by step matters. |
| Business Model Canvas | The model is one stable closed loop with clear partners, activities, resources, value proposition, customers, costs, and revenue. |
| Revenue Tree | The key question is revenue decomposition, pricing drivers, conversion, volume, or mix. |
| Flywheel | Growth loops and self-reinforcing adoption matter more than a one-time transaction. |
| Ecosystem Map | The value chain depends on many external parties and relationship flows. |

Do not stop at the diagram. `business-operations` must also cover customers/payers, pricing, revenue streams, cost structure, fulfillment/supply chain, unit economics or operating KPIs, bottlenecks, and assumptions to verify.

## Output Discipline

For normal chat, lead with findings and next actions. For **initial/full KB work**, deliver **structured-kb-data** JSON (3–8 line summary + one ```json block) that satisfies the Quality Contract in `structured-kb-data-schema.md`. If Worker returns repair_needed, respond with a **full corrected JSON** (no HTML). For **single-slot incremental**, deliver **structured-slot-patch** JSON. PUT / full HTML are **fallback only**. Do not include large template source in chat unless the user explicitly asks.
