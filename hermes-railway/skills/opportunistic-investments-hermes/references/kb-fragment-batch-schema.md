# kb-fragment-batch · Hermes delivery schema (v2.91 / D path)

Worker **fragment-batch** jobs expect one JSON object per Hermes reply (inside a single ` ```json ` fence).

## Envelope

```json
{
  "type": "kb-fragment-batch",
  "schemaVersion": "2.91",
  "mode": "full",
  "batchIndex": 0,
  "summary": "本批 1–2 句摘要",
  "overviewMeta": {
    "lead": "一句话定位（masthead-lead，≤80 字，合成判断）",
    "autoSummary": "项目概览（kb-summary，≤200 字，合成：标的+阶段+资料边界）"
  },
  "sourceProposals": [],
  "fragments": {},
  "appendixFragments": {
    "glossary": null,
    "data-dictionary": null
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | yes | Must be `kb-fragment-batch` |
| `schemaVersion` | yes | `2.91` |
| `batchIndex` | yes | `0` … `5` (6 batches) |
| `mode` | optional | `initial` \| `full` \| `incremental` |
| `summary` | optional | Short batch summary |
| `overviewMeta` | batch 0 | `lead` + `autoSummary` — **Hermes 合成**写入 masthead / kb-summary；**禁止** PDF 摘录或「已索引 N 份资料」 |
| `maturity` | **omit** | **禁止 Hermes 自评**。若误传，Worker 组装时**丢弃**并以固定公式覆盖 Factor A/B/Combined |
| `sourceProposals` | optional | New sources; use `sourceKey`, Worker assigns `U-N` / `A-N` |
| `fragments` | yes | Map `canonicalSlot` → **full** `<section id="…">…</section>` HTML |
| `appendixFragments` | batch 5 | `glossary` + `data-dictionary` full sections; other batches may use `null` |

## Fragment HTML (Codex source of truth)

1. **One complete section per slot** — `id="{slot}"` matching canonical id.
2. **Forbidden in fragment** — whole-page shell: `<html>`, `<body>`, `kb-shell`, `<!-- KB-CONFIG -->`, nav, Appendix A/D.
3. **Citations** — only `#source-{id}` in Worker registry, or `sourceProposals.sourceKey` in the same batch.
4. **Gap-first** — insufficient evidence → `callout missing` / gap table rows; do not omit the slot.
5. **No forced gap** — when facts are sufficient, write substantive content.
6. **JSON escaping** — `fragments` / `appendixFragments` values are JSON strings. Escape `"` as `\"`, `\` as `\\`, and avoid raw newlines inside string values (use `\n` or one line). The fenced block must pass `JSON.parse` before delivery.

**diligence-gaps** must use collapsible `<details class="oq-group">` with `<summary><span class="oq-title">…</span><span class="oq-count">N 项</span></summary>` and `<ol class="oq-list">` items (see `knowledge-base-generation/examples/sample-output.html`). Do **not** use `<div class="oq-group"><h3>` or embedded question tables — `kb-template` CSS only styles `summary` children.

**Component selection** follows `references/slot-rendering-rules.md` and `scripts/render_kb_html.py` — especially **business-operations**:

- Pick **one** primary visualization: Journey Map > Process Flow > BMC > Revenue Tree table > Flywheel > Ecosystem.
- Revenue Tree is **not** the page title; it is one optional table when revenue-by-segment is the core story.
- Always follow the primary viz with operating validation tables (customers, economics, assumptions).
- See `examples-kb-fragment-batch-business-ops.json` for a PET-style `journey-wrap` example.

Worker **does not** rewrite h2 titles or inject component markup at merge time. Hermes must emit Codex-shaped HTML per batch rendering recipes in Worker instructions.

## Batch plan (Worker-owned)

| batchIndex | slots | appendixFragments |
|------------|-------|-------------------|
| 0 | snapshot, target-overview, industry-market | null |
| 1 | business-operations, legal-ownership, regulatory-compliance | null |
| 2 | resource-network, comps-benchmark | null |
| 3 | valuation-returns | null |
| 4 | diligence-gaps, risks-mitigation | null |
| 5 | timeline-milestones, decision-framework | **glossary + data-dictionary** |

## Incremental (single slot)

When `KN_GENERATION_MODE=fragment` and the user names **one** canonical slot:

- Deliver `kb-fragment-batch` with `"mode": "incremental"`, `"batchIndex": 0`
- `fragments` must contain **exactly one** key — the touched slot
- Full `<section id="{slot}">…</section>` per Codex recipes (same as full-batch fragments)
- Optional `sourceProposals` for new public/upload sources (Worker updates Appendix A)
- **Do not** use `structured-slot-patch` or PUT

## Prohibited

- `structured-slot-batch` / `structured-kb-data` in fragment-batch jobs
- Full KB HTML, PUT, inventing final `source-` ids
- Pasting PDF text into `overviewMeta` or `masthead-lead`

## Worker assemble

Worker stitches fragments into `kb-template`, renders Appendix A/D, runs envelope + citation validation only. Gap stubs for missing slots after one repair are Worker-owned and audited separately.

See `examples-kb-fragment-batch.json` (batch 0) and batch-scoped examples:

| File | batchIndex / slots |
|------|-------------------|
| `examples-kb-fragment-batch.json` | 0 · snapshot, target-overview, industry-market |
| `examples-kb-fragment-batch-business-ops.json` | 1 · business-operations, legal-ownership, regulatory-compliance |
| `examples-kb-fragment-batch-resource-comps.json` | 2 · resource-network, comps-benchmark |
| `examples-kb-fragment-batch-valuation.json` | 3 · valuation-returns |
| `examples-kb-fragment-batch-risks-diligence.json` | 4 · diligence-gaps, risks-mitigation |
| `examples-kb-fragment-batch-timeline-decision.json` | 5 · timeline, decision, appendix B/C |
