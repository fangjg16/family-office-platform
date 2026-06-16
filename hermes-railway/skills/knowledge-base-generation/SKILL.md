---
name: knowledge-base-generation
description: "Owns the project's single Project Knowledge Base (项目知识网络) HTML. Creates, updates, re-renders, and reorders the 11-section KB. Triggers on \"generate knowledge base\", \"项目知识网络\", \"update KB\", \"refresh knowledge base\", \"adjust display order\", \"reorder sections\", or when other skills produce KB handoffs."
---

# Knowledge Base Generation · Hermes v2.8

Codex v2.8 opportunistic-investments KB skill, adapted for Railway Hermes + JFO Worker PUT loop.

## Core Rule

Establish evidence first, then analyze, then render or update HTML. Do not analyze from filenames alone. Project materials come from **jfo-r2-materials** (manifest → digest →按需 textUrl), not Cowork local folders.

## Required References (by task — Worker 会注入清单)

**Formal v2.8 sources (priority order for conflicts):**

1. `SKILL.md` (this file — routing & gotchas)
2. `references/kb-schema.md` — 11 canonical slots & structured keys
3. `references/kb-config.md` — KB-CONFIG & display-order
4. `references/content-rules.md` — certainty tags, citations, stubs
5. `references/slot-specific-rules.md` — per-slot depth (not generic guardrails)
6. `references/slot-rendering-rules.md` — Revenue Tree, Value Chain, Flywheel, etc.
7. `references/timeline-rules.md` — when touching `#timeline`
8. `assets/kb-template.html` — **only** shell; do not rewrite CSS/JS
9. `assets/components.html` — **visual/debug only** (not default generation)

**Optional (visual / debug only):** `references/visual-style-guide.md`  
**Do NOT read on each run:** `examples-kb-data.json`, `scripts/`  
**Do NOT use:** `skills_reference.md`, root `kb-template.html`, old `STYLE_GUIDE.md`, `README-hermes.md`

## Task Routing

| User intent | Read | Materials |
|---|---|---|
| First KB / full rebuild | kb-schema, kb-config, content-rules, slot-specific, slot-rendering, **kb-template** | jfo-r2-materials manifest → 按需 textUrl |
| Incremental slot update | above + current KB HTML | 当前 KB + 点名 slot 相关资料 |
| Reorder display order | **kb-config + SKILL** + current KB HTML | **禁止**拉项目资料全文 |
| Timeline slot | + timeline-rules | 按需 |
| Visual / CSS debug only | + visual-style-guide, components.html | 非默认 |

## 11 Canonical Slots (data layer — never rename)

`snapshot`, `assets`, `legal-relationships`, `business-model`, `capital-structure`, `comps`, `returns`, `timeline`, `risks`, `open-questions`, `decision-framework`

Appendices: `#source-index`, `#glossary`

`business-model` = target company economics; `returns` = investor economics. Never mix.

## KB-CONFIG

Mandatory `<!-- KB-CONFIG -->` at `<body>` start. See `references/kb-config.md`. Reorder = **only** KB-CONFIG + nav + `<h2>` section numbers; **never** rewrite content panels.

## Timeline (v2.8)

Three blocks: 已发生关键事件 / 正在推进 / 未来关键节点. See `references/timeline-rules.md`. Exclude data coverage windows, AI/internal workflow actions, and research periods as "已发生".

## Citations

Body refs like `[U-1]` / `href="#source-U-1"` must match appendix `id="source-U-1"`. Template includes `revealAnchor` for cross-panel jumps — do not remove.

## Hermes Delivery (JFO)

1. GET current KB via Worker Hermes bridge (if exists)
2. Edit working HTML under `./kb/{projectId}/`
3. PUT to `/api/hermes/projects/{projectId}/knowledge-network/current?userId=&jobId=&mode=`
4. **Same reply** must end with full ` ```html ` page (fallback if PUT fails)

## Handoff

Prefer JSON per `references/handoff-schema.md`. Legacy `---KB-HANDOFF---` blocks: translate to structured data before merge.

## Gotchas

- Missing evidence → specific stub callout, not silent omission
- Reorder ≠ regenerate
- Factor A denominator always 11 canonical slots
- IC memo is separate; this skill owns HTML KB only
