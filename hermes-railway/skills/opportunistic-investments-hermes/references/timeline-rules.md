# Timeline Rules · v2.91

`timeline-milestones` is for project execution. It is not a place for industry history, market trend dates, source coverage windows, or AI/internal workflow actions.

## Eligibility Gate

For every candidate dated item, assign:

```json
{
  "scope": "project | target | counterparty | asset | regulator | market | industry | internal | data",
  "timelineEligible": true,
  "reason": "one sentence"
}
```

Only `timelineEligible=true` items may enter `timeline-milestones`.

Eligible examples:

- project meeting, LOI, signing, exclusivity, approval, filing, permit, data room, diligence deadline, IC decision, capital call, closing.
- target/company/asset-specific milestone.
- counterparty action that directly changes this project's execution path.
- regulator decision specifically applicable to the project, target, product, license, filing, or approval.

Ineligible examples:

- industry launch date, market size release, technology trend, general policy background.
- customs/statistical data coverage windows.
- AI generation, Codex/Hermes workflow, internal research period.
- comparable-company milestones unless the comparable is a direct counterparty or project asset.

## Three Blocks

Render `timeline-milestones` in three sub-blocks:

1. `8.1 已发生关键事件`
2. `8.2 正在推进`
3. `8.3 未来关键节点`

Use vertical timeline items for 8.1 and 8.2. Use a future-node table for 8.3 when there are several future dependencies.

## Stub Rule

If no project-level eligible event exists:

- keep the `timeline-milestones` section shell;
- render a `callout missing`;
- say that no verified project-level timeline events are available;
- ask for project documents that can unlock the slot, such as meeting notes, LOI, term sheet, approval/filing record, data room timeline, signing schedule, or diligence tracker.

Never fill an empty project timeline with industry events.

## Row Fields

Preferred row fields:

```json
{
  "date": "2026-06-16",
  "sortDate": "2026-06-16",
  "kind": "已发生 | 正在推进 | 未来关键节点",
  "item": "",
  "controller": "",
  "materiality": "",
  "trigger": "",
  "certainty": "",
  "source": "[U-1]",
  "asset": "",
  "scope": "project",
  "timelineEligible": true,
  "reason": ""
}
```
