# KB-CONFIG · v2.91

`KB-CONFIG` is the display-layer control block. It must appear near the opening of `<body>`.

```html
<!-- KB-CONFIG
schema-version: 2.91
display-order: snapshot, target-overview, industry-market, business-operations, legal-ownership, regulatory-compliance, resource-network, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework
project-type: pe-growth
rendering-mode: chinese-only
multi-asset: false
config-version: 1
display-order-history:
  2026-06-16 | intake | v2.91 initial order
-->
```

Rules:

- `schema-version: 2.91` is mandatory as a **line** inside the HTML comment (not JSON-only in `<script>`).
- Copy the exact `<!-- KB-CONFIG` block shape from `assets/kb-template.html`.
- **Forbidden**: `"schema-version": "2.91"` JSON-only blocks without the line-oriented comment.
- Display order may change; slot keys and anchors may not.
- `display-order` contains the 13 core analysis slots only.
- Appendices are not listed in `display-order`; render them after the core slots in fixed A-D order.
- `config-version` increments when display order changes.
- Reorder should append to `display-order-history`.
- Reorder must not touch content panels. Use `scripts/reorder_kb.py`.
- If a KB lacks this block or uses v2.8 legacy keys, rebuild it into v2.91 before incremental updates.

## Project Types and Default Orders

| Type code | Default display-order |
|---|---|
| `pe-growth` | snapshot, target-overview, industry-market, business-operations, legal-ownership, regulatory-compliance, resource-network, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework |
| `ma-control` | snapshot, target-overview, legal-ownership, regulatory-compliance, business-operations, resource-network, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework |
| `trade-commodities` | snapshot, target-overview, resource-network, regulatory-compliance, industry-market, business-operations, comps-benchmark, valuation-returns, legal-ownership, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework |
| `regulated-platform` | snapshot, target-overview, resource-network, industry-market, business-operations, comps-benchmark, regulatory-compliance, valuation-returns, timeline-milestones, risks-mitigation, diligence-gaps, decision-framework |
| `pharma-biotech` | snapshot, target-overview, regulatory-compliance, legal-ownership, industry-market, resource-network, business-operations, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework |
| `technology` | snapshot, target-overview, industry-market, business-operations, resource-network, legal-ownership, regulatory-compliance, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, timeline-milestones, decision-framework |
| `real-estate-dev` | snapshot, target-overview, legal-ownership, regulatory-compliance, timeline-milestones, resource-network, industry-market, business-operations, comps-benchmark, valuation-returns, diligence-gaps, risks-mitigation, decision-framework |

Legacy type hints may map to the closest v2.91 project type:

- `real-estate-income` -> `pe-growth` or `real-estate-dev` depending on whether the core question is operating asset yield or development execution.
- `energy-operating` / `energy-dev` -> `pe-growth` unless the sector-specific workflow defines a narrower type later.
- `biotech` -> `pharma-biotech`.
