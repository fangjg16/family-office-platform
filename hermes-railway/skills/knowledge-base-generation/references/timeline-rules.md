# Timeline Rules

Use this file whenever the KB includes or updates slot `timeline`.

## Canonical Shape

Section `timeline` uses three vertical sub-blocks:

1. `已发生关键事件`
2. `正在推进`
3. `未来关键节点`

Do not render the canonical project timeline as one table. Do not merge the three blocks into one undifferentiated list.

Use the v2.7 dedicated timeline component:

- `8.1 已发生关键事件`: render as `.timeline` / `.tl-item`; when past events exceed 4 items or contain year/month summaries, render the expandable `.tl-tree` year -> month -> item structure.
- `8.2 当前正在推进的事项`: render as `.timeline` / `.tl-item.pending` with orange pending dots.
- `8.3 未来关键节点`: render as a table, not a vertical timeline. Columns are fixed: `节点 | 预计时间 | 影响程度 | 结果触发行动`; blocker nodes use `tr.highlight-row`.

Each timeline item should carry:

| Field | Meaning |
|---|---|
| `date` | Known date, date range, status label, or `待定` |
| `sortDate` | Optional sortable date, e.g. `2026-06-12` |
| `kind` | `已发生`, `推进中`, `外部依赖`, `截止`, or `未来关键节点` |
| `item` | Project-specific event, current workstream, dependency, or future node |
| `controller` | Who controls the next move: seller, buyer, regulator, bank, platform, counterparty, etc. |
| `materiality` | Why it matters to investment decision-making |
| `importance` / `impactLevel` | Badge label such as `关键`, `重要`, `一般`, `极高`, `中高`, or `里程碑` |
| `certainty` | Certainty tag such as `✅ 已核实`, `🟡 项目方`, `🔵 AI推论`, or `⚪ 待确认` |
| `trigger` | What action follows from positive / negative outcomes |
| `source` | Citation IDs such as `[U-1]` or `[A-2]` |
| `asset` | Optional asset/package label for multi-asset projects |

## Block Rules

### 已发生关键事件

Only include actual project dynamics that already happened:

- Project-company, seller, buyer, counterparty, regulator, bank, or asset-level events.
- Contract/LOI/term sheet, closing, payment, delivery, permit, filing, financing, litigation, audit, site visit, management meeting, formal investor introduction, formal project discussion.
- If the event is only a user/agent/internal research action, do not include it.

Hard exclusions:

- Do not include "生成 Codex v2.8 项目知识网络", "完成首轮资料结构化", "AI 整理资料", "我们做了调研", or similar workflow actions.
- Do not include official customs data coverage, third-party transaction sample periods, pricing windows, industry statistics, or market-data observation periods.
- Do not include a source's publication period unless the publication itself creates a project-specific legal, regulatory, commercial, or execution event.

### 正在推进

Include current workstreams that decide whether the project can proceed:

- Missing deal terms, quota, approval, audit, title, financing, KYC/UBO, buyer/seller confirmation, platform access, commercial validation.
- Use `进行中` or another short status label when no exact date exists.
- Each item should say what must be confirmed and who controls it.

### 未来关键节点

Include future catalysts, dependencies, deadlines, or decision gates:

- Regulatory decisions, approval windows, offer deadlines, signing/closing dates, financing milestones, delivery milestones, audit cutoffs.
- Use a clear trigger: what action follows if the result is positive, negative, delayed, or not received.
- Always render future nodes as the v2.7 8.3 table. Do not render them as a third vertical list.

## Evidence Windows

Do not turn background evidence into timeline events.

- Official customs data coverage, transaction datasets, pricing windows, industry statistics, and comparable transaction sample periods are evidence windows, not project events.
- Market history, policy background, and industry development history belong in `business-model`, `comps`, `risks`, `decision-framework`, or Appendix A unless they create a project-specific deadline or dependency.
- If a data window is important, cite it in the relevant analysis row and list it in Appendix A; do not label it `已发生关键事件`.

Example: "官方海关数据覆盖 2024-01 至 2026-04 的进口金额" is a data reference. It should support `business-model`, `comps`, or `decision-framework`. It enters `timeline` only if a customs rule change on a specific date creates a project-specific deadline or execution risk.

## Detail Standard

The three-block timeline should preserve v2.7-level detail. A good item should answer:

1. What changed, what is being pushed, or what must be decided?
2. Who controls it?
3. Why does it matter?
4. What action follows?
5. Which source supports it?

If those answers are missing, keep the item but mark the missing part explicitly instead of summarizing it away.
