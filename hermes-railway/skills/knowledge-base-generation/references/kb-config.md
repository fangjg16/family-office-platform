# KB-CONFIG

`KB-CONFIG` is the display-layer control block. It must appear near the opening of `<body>`.

```html
<!-- KB-CONFIG
display-order: snapshot, assets, legal-relationships, business-model, capital-structure, comps, returns, timeline, risks, open-questions, decision-framework
project-type: real-estate-dev
rendering-mode: chinese-only
multi-asset: false
config-version: 1
display-order-history:
  2026-06-12 | intake | 初始顺序
-->
```

Rules:

- Display order may change; slot keys and anchors may not.
- `config-version` increments when display order changes.
- Reorder should append to `display-order-history`.
- Reorder must not touch content panels. Use `scripts/reorder_kb.py`.
- If a KB lacks this block, full rebuild or migrate before incremental updates.

## Project Types and Default Orders

| Type code | Default display-order |
|---|---|
| `real-estate-dev` | snapshot, assets, legal-relationships, capital-structure, timeline, business-model, comps, returns, risks, open-questions, decision-framework |
| `real-estate-income` | snapshot, assets, business-model, comps, legal-relationships, capital-structure, returns, timeline, risks, open-questions, decision-framework |
| `energy-operating` | snapshot, assets, business-model, comps, returns, capital-structure, legal-relationships, timeline, risks, open-questions, decision-framework |
| `energy-dev` | snapshot, assets, legal-relationships, timeline, capital-structure, business-model, comps, returns, risks, open-questions, decision-framework |
| `biotech` | snapshot, assets, legal-relationships, business-model, capital-structure, comps, returns, timeline, risks, open-questions, decision-framework |
| `technology` | snapshot, assets, business-model, comps, capital-structure, returns, legal-relationships, timeline, risks, open-questions, decision-framework |
| `trade-commodities` | snapshot, assets, legal-relationships, business-model, comps, capital-structure, returns, timeline, risks, open-questions, decision-framework |
| `hospitality` | snapshot, assets, business-model, legal-relationships, comps, capital-structure, returns, timeline, risks, open-questions, decision-framework |
