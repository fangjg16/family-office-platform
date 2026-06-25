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
| `mode` | optional | `initial` \| `full` |
| `summary` | optional | Short batch summary |
| `maturity` | batch 0 | `{ factorA, factorB, combined, tier?, factorANote?, factorBNote? }` — Hermes 自评写入 masthead；**禁止**在 slot HTML 写 `C · 22%` |
| `sourceProposals` | optional | New sources; use `sourceKey`, Worker assigns `U-N` / `A-N` |
| `fragments` | yes | Map `canonicalSlot` → **full** `<section id="…">…</section>` HTML |
| `appendixFragments` | batch 5 | `glossary` + `data-dictionary` full sections; other batches may use `null` |

## Fragment HTML rules (L1–L3)

1. **One complete section per slot** — must include `id="{slot}"` matching canonical id (`snapshot`, `target-overview`, …).
2. **Forbidden in fragment** — whole-page shell: `<html>`, `<body>`, `kb-shell`, `<!-- KB-CONFIG -->`, nav, Appendix A/D, maturity scorecard.
3. **Citations** — only `#source-{id}` already in Worker registry, or `sourceProposals.sourceKey` in the same batch.
4. **Gap-first** — when evidence is insufficient, use `callout missing` / gap tables; **do not** omit the slot key or ship empty panels.
5. **No forced gap** — when facts are sufficient, write substantive content; do not add fake gaps.

## Batch plan (Worker-owned)

| batchIndex | slots | appendixFragments |
|------------|-------|-------------------|
| 0 | snapshot, target-overview | null |
| 1 | industry-market, business-operations | null |
| 2 | legal-ownership, regulatory-compliance | null |
| 3 | resource-network, comps-benchmark | null |
| 4 | valuation-returns, diligence-gaps, risks-mitigation | null |
| 5 | timeline-milestones, decision-framework | **glossary + data-dictionary** |

## Prohibited

- `structured-slot-batch` / `structured-kb-data` in fragment-batch jobs
- Full KB HTML, PUT, `render_kb_html.py` (unless Worker explicitly requests fallback)
- Inventing final `source-` ids not in registry or proposals

## Worker assemble

Worker stitches fragments into `kb-template` shell, renders Appendix A/D, runs strict HTML validation, and may inject **Worker gap stubs** for slots still missing after one repair — those are audited separately and are **not** Hermes output.

See `examples-kb-fragment-batch.json` for a minimal valid batch-0 example.
