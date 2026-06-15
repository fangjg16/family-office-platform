# Timeline Rules

Use this file whenever the KB includes or updates slot `timeline`.

## Core Principle

`timeline` is **not** “anything with a date.” It is the **project execution timeline**: nodes that show how **this project / target / deal** has moved, is moving, or must move.

Industry news, market statistics, technology trends, platform launches, and research workflow actions are **not** timeline events unless they create a **project-specific** deadline, approval path, filing obligation, or transaction condition change.

## Eligibility Gate (mandatory before every write)

For **each candidate item** (from public-info-search handoff, node-monitoring, user materials, or generation), classify first:

| Field | Values |
|---|---|
| `scope` | `project` \| `target` \| `counterparty` \| `asset` \| `regulator` \| `market` \| `industry` \| `internal` \| `data` |
| `timelineEligible` | `true` \| `false` |
| `reason` | One sentence: why it does or does not belong in `timeline` |

**Write to `timeline` only when `timelineEligible=true`.**

When `timelineEligible=false`, **do not** place the item in `timeline`. Route it:

| scope / content type | Primary slot(s) |
|---|---|
| `industry`, `market`, macro trend | `comps`, `business-model`, `decision-framework` |
| `regulator` background (not project-specific action) | `risks`, `legal-relationships`, `decision-framework` |
| `data` coverage / sample period / publication date | `comps`, `business-model`, Appendix A (`source-index`) |
| `internal` research / AI / Codex actions | omit from KB body or `open-questions` if operational |
| policy that **changes this project's** path | `timeline` **only if** tied to a concrete deadline, gate, or filing for **this** project/target |

### timelineEligible = true (allowed)

- Concrete actions by **project sponsor, target, counterparty, asset, or regulator on this deal**
- Formal meetings, introductions, LOI/term sheet, signing, payment, closing, delivery
- Contract, license, authorization, KYC/UBO, diligence, audit, litigation, penalty, filing, approval **for this project**
- Current workstreams blocking or enabling **this** deal
- Future **project** deadlines: IC gate, approval window, closing condition, document cutoff, regulator decision **that gates this transaction**

### timelineEligible = false (forbidden in timeline)

- Industry trends, technology trends, market size changes
- Platform product launches, generic industry news, generic regulatory background
- Data coverage periods, sample windows, dataset publication dates
- Internal research actions, AI generation, analyst workflow (“完成资料结构化”, “生成知识网络”)
- Macro / policy nodes **unless** they become **this project's** external dependency, future gate, or deadline (then re-classify with explicit project link)

## Canonical Shape

Section `timeline` uses three vertical sub-blocks:

1. `已发生关键事件` (8.1)
2. `正在推进` (8.2)
3. `未来关键节点` (8.3)

Do not render the canonical project timeline as one table. Do not merge the three blocks into one undifferentiated list.

Use the v2.8 timeline component:

- **8.1 已发生关键事件**: `.timeline` / `.tl-item`; past events may use `.tl-tree` when >4 items or year/month summaries.
- **8.2 正在推进**: `.timeline` / `.tl-item.pending` with pending dots.
- **8.3 未来关键节点**: **table** (columns: `节点 | 预计时间 | 影响程度 | 结果触发行动`); blocker rows use `tr.highlight-row`.

Each timeline item should carry:

| Field | Meaning |
|---|---|
| `date` | Known date, range, status label, or `待定` |
| `sortDate` | Optional sortable date, e.g. `2026-06-12` |
| `kind` | `已发生`, `推进中`, `外部依赖`, `截止`, or `未来关键节点` |
| `item` | **Project-specific** event, workstream, dependency, or gate |
| `controller` | Who controls the next move |
| `materiality` | Why it matters to **this investment decision** |
| `importance` / `impactLevel` | Badge such as `关键`, `重要`, `一般`, `极高` |
| `certainty` | `✅ 已核实`, `🟡 项目方`, `🔵 AI推论`, or `⚪ 待确认` |
| `trigger` | Action if positive / negative / delayed |
| `source` | Citation IDs such as `[U-1]` or `[A-2]` |
| `asset` | Optional asset label for multi-asset projects |

## Block Rules

### 已发生关键事件

Only **project-entity** dynamics that already happened (see eligibility gate).

### 正在推进

Current workstreams that decide whether **this project** can proceed (missing terms, approvals, audits, KYC, counterparty confirmation, etc.).

### 未来关键节点

Future catalysts, dependencies, deadlines, or decision gates **for this project** (regulatory decision on this filing, offer deadline, signing/closing, IC gate, document cutoff).

## Stub When No Eligible Events

If **no** candidate has `timelineEligible=true`:

- Keep section `id="timeline"` and all three sub-headings (8.1 / 8.2 / 8.3).
- Do **not** fill blocks with industry history or market milestones.
- Render a project-specific stub, e.g. `callout missing`: “暂无已核实的项目级时间轴事件；待项目方/交易对手提供会议记录、签约节点、审批状态或尽调里程碑。”
- 8.3 may show an empty table header or one row “待定 — 待项目资料确认关键节点”.

## Evidence Windows

Official customs coverage, transaction datasets, pricing windows, industry statistics, and comparable sample periods are **evidence**, not timeline events. Cite in `comps`, `business-model`, `risks`, `decision-framework`, or Appendix A.

Example: “海关数据覆盖 2024-01 至 2026-04” supports `comps` — it enters `timeline` only if a **dated rule change** creates a **project-specific** filing deadline or execution block.

## Detail Standard

A good item answers: (1) what changed / what must be decided, (2) who controls it, (3) why it matters to **this deal**, (4) what action follows, (5) which source supports it.
