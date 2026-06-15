# Content Rules

## Certainty Tags

| Tag | Meaning | Requirement |
|---|---|---|
| ✅ 已核实 | Cross-checked or authoritative | Cite source |
| 🟡 当事方声明 | Stated by a party | Name the party |
| 🔵 分析师推论 | Derived conclusion | Name AI/internal inference basis |
| ⚪ 待确认 | Mentioned but unverified | State what confirms it |

## Source IDs

- `U-N`: user-uploaded source.
- `A-N`: AI-generated or public-info-search generated source.
- Tooltip excerpts should be short and source-specific.
- In rendered HTML, plain citations such as `[U-1]` should link to appendix rows, e.g. `<a href="#source-U-1">[U-1]</a>`.
- Appendix A rows should expose matching anchors such as `id="source-U-1"` so citations can jump.
- Because the KB uses hidden panels, citation clicks must reveal the Appendix A panel before scrolling to the source row. Keep the template's `revealAnchor` handler when changing JS.

## Missing Callouts

Missing data callouts must be project-type specific. Include:

1. What is missing.
2. Who or what source can provide it.
3. What analysis it unlocks.

## Multi-Asset

- Use deal/package name, not a sub-asset name.
- Asset-specific slots should partition by asset.
- Missing data must be flagged per asset.

## Bilingual

Overseas target assets use bilingual mode. Chinese and English content should be parallel enough for review, but do not inflate every minor table note if it adds no value.

## Timeline Classification

- `timeline` = **project execution nodes only** (not “all dated information”). See `references/timeline-rules.md` eligibility gate.
- Three sub-blocks: `已发生关键事件`, `正在推进`, `未来关键节点`.
- Before writing any timeline row, set `scope`, `timelineEligible`, `reason`. Only `timelineEligible=true` rows may render in `timeline`.
- `timelineEligible=false` items go to `comps`, `business-model`, `risks`, `decision-framework`, or Appendix A — never padded into timeline as industry filler.
- `已发生关键事件` = target/project/counterparty/regulator/**on-this-deal** dynamics. Excludes Codex/AI workflow, source coverage windows, internal research.
- Data coverage windows, market statistics, industry milestones = evidence, not timeline events.
- If no eligible project events exist, keep `timeline` as stub (three headings + missing callout); do not backfill with industry news.
