---
name: opportunistic-investments-hermes
description: Use inside Hermes/platform execution when generating, validating, rendering, or updating family-office Project Knowledge Base HTML. Hermes v2.93 adds kb-fragment-batch as the Worker slot-batch primary path (HTML section fragments); structured JSON remains for incremental patch and structured fallback.
metadata:
  short-description: Hermes-ready opportunistic investment KB workflow v2.93
---

# Opportunistic Investments · Hermes v2.93

Hermes-ready v2.93: **13-slot v2.91 schema** + Appendix A–D. **Worker fragment-batch** (6 batches, `kb-fragment-batch` JSON) is the default for `initial` / `full` when instructions say **fragment-batch** or **kb-fragment-batch**. **structured-kb-data** / **structured-slot-batch** remain for incremental patch, explicit structured fallback, or legacy Worker jobs.

## Core Rule

Establish evidence first, route each finding to the correct canonical slot, then analyze, then deliver the format Worker requested. Do not analyze from filenames alone. Use uploaded files, existing KB HTML, public sources, or user-provided facts with certainty labels.

## Quick Routing

| User intent | Read next | Prefer delivery |
|---|---|---|
| **Worker fragment-batch** (`initial` / `full`, 6 batches) | `references/kb-fragment-batch-schema.md` + `examples-kb-fragment-batch.json` + `references/slot-rendering-rules.md` | **kb-fragment-batch** JSON (section HTML per slot) |
| New KB / full refresh (non-batch or structured fallback) | `references/structured-kb-data-schema.md` + `examples-kb-data.json` + default deep refs | **structured-kb-data** JSON → Worker render; PUT / full HTML **fallback only** |
| Incremental KB update (single slot) | Current KB HTML (read-only), touched slot rules, mapped deep refs | **structured-slot-patch** JSON |
| Incremental KB update (multi-slot) | Current KB HTML, touched slot rules | GET + edit + PUT, or structured-kb-data if user requests full refresh |
| Display-order change only | Current KB HTML and `references/kb-config.md` | `scripts/reorder_kb.py`, PUT |
| Research / diligence / legal / risk / valuation | `references/content-rules.md` → `references/slot-specific-rules.md` | JSON handoff; merge only if KB is updated |
| Handoff from another workflow | `references/handoff-schema.md` | `scripts/merge_handoff.py` |

## Required Assets

### Fragment-batch (Worker default for full KB)

- Read `references/kb-fragment-batch-schema.md`, `references/kb-schema.md`, `references/content-rules.md`, and batch-scoped `examples-kb-fragment-batch*.json`.
- **batch 0** also read `references/kb-config.md` and `references/maturity-scoring.md`.
- Deliver **kb-fragment-batch** JSON: each slot = complete `<section id="{slot}">…</section>` HTML.
- **batch 0** must include `overviewMeta` (synthesized `lead` + `autoSummary`, ≤200 chars) and `maturity` (Factor A/B self-assessment) — Worker passes through to masthead; **not** PDF excerpts or file-index meta.
- Apply `references/slot-rendering-rules.md` (incl. Business-Operations visualization priority) and `references/slot-specific-rules.md`.
- **Forbidden**: whole-page HTML, KB-CONFIG, nav, Appendix A/D, `structured-slot-batch`, PUT (unless Worker declares fallback).
- Batch 5 must include `appendixFragments.glossary` and `appendixFragments.data-dictionary`.
- Evidence sufficient → substantive content; insufficient → gap-first callout (do not omit slot keys).

### Structured paths (incremental / fallback)

- **initial/full structured**: `references/structured-kb-data-schema.md`, `examples-kb-data.json`; Worker renders shell.
- **Incremental single-slot**: **structured-slot-patch** JSON.
- **PUT / HTML fallback**: `assets/kb-template.html` only; validate with `scripts/validate_kb_html.py`.

### Shared references

- `references/kb-schema.md`, `kb-config.md`, `content-rules.md`, `maturity-scoring.md`, `timeline-rules.md`, `gotchas.md`
- Deep refs under `references/deep/` — full set for structured full KB; minimal set for fragment-batch (see Worker batch instructions).
- `assets/components.html` only when visual patterns are needed.

## Fragment-Batch Workflow (Worker-orchestrated)

When Worker instructions include **fragment-batch** / **kb-fragment-batch**:

1. Read only the batch-scoped files Worker lists (typically fragment schema + slot rendering rules + example JSON).
2. Use Worker **Evidence Inventory / Source Registry** for facts; cite `#source-{id}` or `sourceProposals.sourceKey`.
3. For each slot in **this batch**, output `fragments.{slot}` as full section HTML.
4. Reply: 2–4 line summary + **one** ` ```json ` block (`type: kb-fragment-batch`).
5. On repair: fix only failed slots; still `kb-fragment-batch` JSON.
6. Do **not** render maturity, Appendix A/D, or full page — Worker assembles and validates.

## Structured Full KB Workflow (fallback)

1. Parse `references/kb-schema.md` + `structured-kb-data-schema.md`.
2. Route findings via `content-rules.md`; apply slot-specific + rendering rules.
3. Deliver one `structured-kb-data` JSON block; Worker renders template.
4. PUT / `render_kb_html.py` only when JSON delivery is impossible.

## Default Deep References (structured full KB only)

For **structured** `initial`/`full` (not fragment-batch), read these seven by default:

1. `references/deep/knowledge-base-generation.md`
2. `references/deep/project-intake.md`
3. `references/deep/public-info-search.md`
4. `references/deep/dd-claim-audit.md`
5. `references/deep/compliance-check.md`
6. `references/deep/risk-matrix.md`
7. `references/deep/returns-analysis.md`

For **fragment-batch**, Worker injects the **union** of short deep refs for that batch’s slots (not “0–1 only”). Full Skills load only when dynamic workflow routing fires.

For `incremental` updates, use slot-to-deep-ref routing (see `references/slot-specific-rules.md`).

## Maturity

Factor A/B/Combined are computed by **Worker** at assemble/publish from fragment HTML + Source Registry. Do **not** self-report `maturity` in JSON.

## v2.91 Gotchas

- 13 core slots + 4 appendices; no v2.8 keys (`assets`, `business-model`, `returns`, `risks`, `open-questions`).
- `business-operations` = how the target operates; `valuation-returns` = investor economics.
- `legal-ownership` vs `regulatory-compliance` — ownership/control vs external rules/permits.
- `diligence-gaps` = structured open questions + evidence gaps.
- `timeline-milestones` = project execution only (not industry history or AI workflow dates).
- Appendix C required when models/formulas/source data are used; batch 5 delivers B/C fragments.
- Appendix D written by Worker at publish.
- **Fragment-batch**: Hermes writes `overviewMeta` in batch 0 JSON; Worker computes Factor A/B at assemble; Appendix B/C prefer same-job wrap-up Run.
- **Structured slot-batch**: Factor A/B computed by Worker after ingest.

## Output Discipline

| Worker mode | Deliver |
|---|---|
| **fragment-batch** | Summary + one `kb-fragment-batch` JSON |
| **structured slot-batch** | Summary + one `structured-slot-batch` JSON |
| **structured full** | Summary + one `structured-kb-data` JSON |
| **single-slot incremental** | `structured-slot-patch` JSON |
| **repair** | Corrected JSON for the same type Worker requested |

PUT / full HTML are **fallback only**. Do not paste template source unless asked.
