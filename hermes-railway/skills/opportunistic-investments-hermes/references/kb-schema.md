# KB Schema · v2.91

The KB has 13 canonical core analysis slots plus 4 appendix slots. Slot keys and anchors are data-layer constants; display order is controlled by `KB-CONFIG`.

## Core Analysis Slots

| Slot key | Anchor | Title | Content boundary | Primary writers |
|---|---|---|---|---|
| `snapshot` | `#snapshot` | 项目快照 | project name, jurisdiction, project type, stage, counterparties, indicative price/range, maturity, one-line judgment | project-intake, public-info-search |
| `target-overview` | `#target-overview` | 资产构成 / 标的概况 | assets, products, technology, platform, permits, capacity, location, approval status, deliverables | public-info-search, dd-claim-audit |
| `resource-network` | `#resource-network` | 资源网络与关键协作 | channels, government/regulatory pathways, industry resources, suppliers, advisors, operators, key people, relationship strength | public-info-search, background-check, meeting-briefing, vendor-check |
| `industry-market` | `#industry-market` | 行业背景与市场格局 | market size, demand drivers, policy background, market cycle, price benchmarks, macro/trade/statistical conclusions | public-info-search, compliance-check, analyze |
| `business-operations` | `#business-operations` | 业务模式与运营假设 | customers, pricing, unit economics, supply chain, fulfillment, operating KPI, SaaS metrics, occupancy/utilization | public-info-search, analyze, build-dashboard |
| `legal-ownership` | `#legal-ownership` | 法律结构与权属关系 | holding entities, ownership, UBO, title/IP/contract rights, directors/controllers, encumbrances, related parties | background-check, legal-risk-assessment, public-info-search |
| `regulatory-compliance` | `#regulatory-compliance` | 监管合规与许可路径 | regulatory route, licenses, permits, approvals, privacy/data, industry-specific compliance, cross-border requirements | compliance-check, legal-risk-assessment, public-info-search |
| `comps-benchmark` | `#comps-benchmark` | 市场对标与可比案例 | comparable transactions, multiples, benchmark platforms, operating references, competitive cases | comp-analysis, public-info-search, analyze |
| `valuation-returns` | `#valuation-returns` | 投资回报与敏感性分析 | valuation, IRR, MOIC, cash-on-cash, payback, scenarios, sensitivities, tornado, break-even, exits | returns-analysis, sensitivity-analysis, analyze |
| `diligence-gaps` | `#diligence-gaps` | 待确认问题 / 尽调缺口 | claim register, evidence grade, contradictions, material requests, open questions, owner, urgency, blocker status | dd-checklist, dd-claim-audit, gap-tracking, document-reorganize |
| `risks-mitigation` | `#risks-mitigation` | 关键风险与缓释 | risk register, likelihood x impact, evidence, mitigation, owner/status, red flags and stop conditions | risk-matrix, dd-claim-audit, legal-risk-assessment, compliance-check |
| `timeline-milestones` | `#timeline-milestones` | 项目时间轴 | project-level history, current workflow, external decision nodes, approval/signature/meeting action items | node-monitoring, meeting-briefing, signature-request, public-info-search |
| `decision-framework` | `#decision-framework` | 决策框架 | investment theses, options, trade-offs, recommendation, value creation plan, IC readiness, next steps | value-creation-plan, knowledge-base-generation |

## Appendices

| Slot key | Anchor | Appendix | Content |
|---|---|---|---|
| `source-index` | `#source-index` | Appendix A · 来源索引 | user/AI sources, authoring party, excerpt, affected slots |
| `glossary` | `#glossary` | Appendix B · 术语表 | glossary terms and tooltip definitions |
| `data-dictionary` | `#data-dictionary` | Appendix C · 数据字典、模型假设与数据证据底稿 | fields, formulas, sample scope, cleaning/calculation logic, dashboard/workpaper links, model caveats |
| `version-ledger` | `#version-ledger` | Appendix D · 版本记录 | current and historical KB version, generated time, parent version, change summary |

## Suggested Structured Data

```json
{
  "project": {
    "name": "",
    "type": "pe-growth",
    "jurisdiction": "",
    "renderingMode": "chinese-only",
    "multiAsset": false,
    "assets": []
  },
  "kbConfig": {
    "schemaVersion": "2.91",
    "displayOrder": ["snapshot", "target-overview", "industry-market", "business-operations", "legal-ownership", "regulatory-compliance", "resource-network", "comps-benchmark", "valuation-returns", "diligence-gaps", "risks-mitigation", "timeline-milestones", "decision-framework"],
    "projectType": "pe-growth",
    "renderingMode": "chinese-only",
    "multiAsset": false,
    "configVersion": 1,
    "displayOrderHistory": []
  },
  "maturity": {
    "factorA": "0%",
    "factorB": "0%",
    "combined": "0%",
    "tier": "Bare lead",
    "slotScores": {}
  },
  "slots": {
    "snapshot": { "state": "stub", "html": "", "items": [], "missing": [] }
  },
  "sources": [],
  "terms": [],
  "dataDictionary": [],
  "versionLedger": []
}
```

Slot state values:

- `populated`: evidence-backed content exists.
- `stub`: the skill checked the slot and found meaningful missing data.
- `empty`: no assessment yet; hide from display but score as 0 for Factor A.

## Structured Slot Keys By Slot

Prefer structured keys over freeform `html` when a section fits the default component pattern. This keeps v2.91 from flattening detailed sections into generic prose.

| Slot | Preferred structured keys | Default renderer output |
|---|---|---|
| `snapshot` | `facts`, `items`, `gatingWarning` | fixed key-facts table + one-line judgment |
| `target-overview` | `rows`, `assets`, `rightsAssets`, `deliverables`, `missing` | asset/product/platform table |
| `resource-network` | `actors`, `relationships`, `rows`, `networkMap` | relationship/resource network table |
| `industry-market` | `rows`, `drivers`, `policySignals`, `marketData`, `datasets` | market/policy benchmark table |
| `business-operations` | `journey`, `processFlow`, `canvas`, `revenueTree`, `valueChain`, `flywheel`, `ecosystemMap`, `scenarios`, `customers`, `unitEconomics`, `kpis`, `assumptions`, `rows` | business visualization + operating assumption tables |
| `legal-ownership` | `entities`, `relationships`, `rights`, `rows` | org chart + rights/ownership table |
| `regulatory-compliance` | `approvals`, `licenses`, `rules`, `redFlags`, `rows` | compliance matrix |
| `comps-benchmark` | `rows`, `cases`, `datasets` | comparable table with signal and caveat |
| `valuation-returns` | `valuationBox`, `valuationBoxes`, `scenarios`, `assumptions`, `sensitivities`, `capitalUses`, `rows` | valuation box + scenario cards + assumptions/sensitivity tables |
| `diligence-gaps` | `claims`, `groups`, `items`, `rows` | evidence/gap register + priority groups |
| `risks-mitigation` | `rows`, `redFlags`, `stopConditions` | risk register + red-flag table |
| `timeline-milestones` | `rows` | three-block project timeline: occurred / ongoing / future nodes |
| `decision-framework` | `recommendation`, `recommendationReason`, `valuationBox`, `valuationBoxes`, `theses`, `preconditions`, `options`, `tradeOffs`, `valueLevers`, `icReadiness`, `blockers`, `nextActions`, `rows` | recommendation + theses + trade-off/options + next actions |

Do not replace a structured slot with a shorter prose summary unless the user explicitly asks for narrative-only output. If evidence is missing, keep the slot structure and put the missing input in `missing`, `gap`, `trigger`, `blocker`, or the relevant row-level field.

## Legacy Key Migration

Route A means legacy v2.8 KBs should be rebuilt, not incrementally patched. If legacy keys appear in a handoff, translate them before writing:

| Legacy v2.8 key | v2.91 target |
|---|---|
| `assets` | `target-overview` plus `resource-network` when relationships/resources are involved |
| `legal-relationships` | `legal-ownership`, `regulatory-compliance`, `resource-network` depending on content |
| `business-model` | `business-operations` |
| `capital-structure` | `valuation-returns`; blockers to `diligence-gaps` or `risks-mitigation` |
| `comps` | `comps-benchmark` |
| `returns` | `valuation-returns` |
| `open-questions` | `diligence-gaps` |
| `risks` | `risks-mitigation` |
| `timeline` | `timeline-milestones` |
