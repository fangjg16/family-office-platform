# KB Schema

The KB has 11 canonical slots. Slot keys and anchors are data-layer constants; display order is controlled by `KB-CONFIG`.

| Slot key | Anchor | Title | Primary writers |
|---|---|---|---|
| `snapshot` | `#snapshot` | 项目快照 | project-intake, public-info-search |
| `assets` | `#assets` | 资产构成 / 平台能力与资源 | public-info-search, dd-claim-audit |
| `legal-relationships` | `#legal-relationships` | 法律结构与关键关系网 | background-check, public-info-search |
| `business-model` | `#business-model` | 业务模式与收入假设 | public-info-search |
| `capital-structure` | `#capital-structure` | 融资结构与资本结构 | public-info-search |
| `comps` | `#comps` | 市场对标与可比交易 | comp-analysis |
| `returns` | `#returns` | 投资回报与敏感性分析 | returns-analysis, sensitivity-analysis |
| `timeline` | `#timeline` | 项目时间轴 | node-monitoring, public-info-search |
| `risks` | `#risks` | 关键风险与缓释 | risk-matrix, dd-claim-audit |
| `open-questions` | `#open-questions` | 待确认问题清单 | gap-tracking, dd-checklist |
| `decision-framework` | `#decision-framework` | 决策框架 | value-creation-plan + synthesis |

Appendices:

- `source-index` / `#source-index` for source index.
- `glossary` / `#glossary` for terms.

## Suggested Structured Data

```json
{
  "project": {
    "name": "",
    "type": "real-estate-dev",
    "jurisdiction": "",
    "renderingMode": "chinese-only",
    "multiAsset": false,
    "assets": []
  },
  "kbConfig": {
    "displayOrder": ["snapshot", "assets", "legal-relationships", "business-model", "capital-structure", "comps", "returns", "timeline", "risks", "open-questions", "decision-framework"],
    "projectType": "real-estate-dev",
    "renderingMode": "chinese-only",
    "multiAsset": false,
    "configVersion": 1,
    "displayOrderHistory": []
  },
  "maturity": {
    "factorA": 0,
    "factorB": 0,
    "combined": 0,
    "tier": "Bare lead",
    "slotScores": {}
  },
  "slots": {
    "snapshot": { "state": "stub", "html": "", "items": [], "missing": [] }
  },
  "sources": [],
  "terms": [],
  "changelog": []
}
```

Slot state values:

- `populated`: evidence-backed content exists.
- `stub`: the skill checked the slot and found meaningful missing data.
- `empty`: no assessment yet; hide from display but score as 0 for Factor A.

## Structured Slot Keys By Slot

Prefer structured keys over freeform `html` when a section fits the default established KB component pattern. This keeps v2.8 from flattening detailed sections into generic prose.

| Slot | Preferred structured keys | Default renderer output |
|---|---|---|
| `snapshot` | `facts`, `items` | key-facts table |
| `assets` | `rows`, `assets` | asset/resource table |
| `legal-relationships` | `entities`, `relationships`, `rows` | org chart + relationship table |
| `business-model` | `journey`, `processFlow`, `canvas`, `revenueTree`, `valueChain`, `flywheel`, `ecosystemMap`, `valuationBox`, `topics`, `rows` | established KB business visualization + assumption table |
| `capital-structure` | `sourcesUses`, `capitalStack`, `rows` | sources & uses table + capital stack |
| `comps` | `rows` | comparable table with signal and caveat |
| `returns` | `valuationBox`, `valuationBoxes`, `scenarios`, `assumptions`, `sensitivities`, `rows` | valuation box + scenario cards + assumptions/sensitivity tables |
| `timeline` | `rows` | established KB timeline layout: 8.1/8.2 vertical items, 8.3 future-node table |
| `risks` | `rows` | portable KB visual style risk matrix |
| `open-questions` | `groups`, `items` | priority question cards |
| `decision-framework` | `recommendation`, `recommendationReason`, `valuationBox`, `valuationBoxes`, `theses`, `valueLevers`, `options`, `blockers`, `pros`, `cons`, `nextActions`, `rows` | recommendation + valuation box + theses + value-add levers + options + blockers + next actions |

Do not replace a structured slot with a shorter prose summary unless the user explicitly asks for a narrative-only output. If evidence is missing, keep the slot structure and put the missing input in `missing`, `gap`, `trigger`, or the relevant row-level field.

## Advanced Optional Component Shapes

Use these only when the project needs the structure:

- `revenueTree`: `{ "groups": [{ "name": "", "items": [{ "name": "", "revenue": "", "share": "", "certainty": "", "source": "" }] }], "total": "" }`
- `valueChain`: `{ "steps": [{ "stage": "", "capability": "", "benchmark": "", "moat": "强/中/弱", "moatNote": "", "certainty": "", "source": "" }] }`
- `flywheel`: `{ "title": "", "nodes": [{ "stage": "", "text": "" }], "assumption": "", "certainty": "", "source": "" }`
- `ecosystemMap`: `{ "center": "", "actors": [{ "actor": "", "gives": "", "receives": "", "strength": "强/中/弱" }], "valueCapture": "" }`
- `valuationBox`: `{ "label": "", "value": "", "note": "", "certainty": "", "source": "" }`

## Timeline Rows

When slot `timeline` is populated from structured data, prefer `rows` over freeform `html`. The renderer turns these rows into the three canonical vertical sub-blocks:

```json
{
  "timeline": {
    "state": "populated",
    "rows": [
      {
        "date": "2026-06-12",
        "sortDate": "2026-06-12",
        "kind": "推进中",
        "item": "Confirm quota availability and platform access path",
        "controller": "项目方 / 平台方",
        "materiality": "Determines whether the transaction can move from concept to executable structure",
        "trigger": "Positive: request term sheet; Negative: keep as watchlist only",
        "source": "[U-1]",
        "asset": ""
      }
    ]
  }
}
```

Allowed `kind` values: `已发生`, `推进中`, `外部依赖`, `截止`, `未来关键节点`.

Do not put data-reference windows, AI workflow actions, or internal research actions into `timeline.rows`. Put data references in the analytical slot they support and cite them through Appendix A.

## Risk Rows

When slot `risks` is populated from structured data, prefer `rows` over freeform `html`:

```json
{
  "risks": {
    "state": "populated",
    "rows": [
      {
        "level": "高",
        "risk": "Quota availability cannot be confirmed, blocking executable transaction design",
        "evidence": "Current materials mention quota-dependent delivery but do not provide quota documents",
        "certainty": "⚪ 待确认",
        "source": "[U-1]",
        "mitigation": "Request quota policy, allocation proof, and platform access memo",
        "owner": "项目方",
        "trigger": "If quota is unavailable, downgrade to watchlist"
      }
    ]
  }
}
```

The renderer outputs the portable KB visual style `级别 / 风险 / 证据 / 缓释措施` matrix.

## Open Question Groups

When slot `open-questions` is populated from structured data, prefer `groups` over freeform `html`:

```json
{
  "open-questions": {
    "state": "populated",
    "groups": [
      {
        "priority": "P1",
        "title": "紧急 — 监管确认",
        "items": [
          {
            "question": "Quota and platform access path?",
            "owner": "项目方",
            "why": "Blocks executable transaction structure",
            "action": "Request written confirmation and source documents",
            "source": "[U-1]"
          }
        ]
      }
    ]
  }
}
```

The renderer outputs established KB priority cards with item counts.
