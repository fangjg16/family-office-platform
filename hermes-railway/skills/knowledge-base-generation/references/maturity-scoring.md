# Maturity Scoring

## Header scorecard (stat-row) — mandatory format

The masthead `.stat-row` has three cards. **`.stat-value` must be a percentage 0–100%** (e.g. `38%`, `10%`, `27%`) or `—` when not yet scored.

| Card | `.stat-value` | `.stat-note` / elsewhere |
|---|---|---|
| Factor A · 内容覆盖度 | `0%`–`100%` | slot counts like `7/11 populated` |
| Factor B · 来源多样性 | `0%`–`100%` | source-type lists, party names |
| Combined · 综合成熟度 | `0%`–`100%` | tier labels: Early stage, C+, etc. |

**Forbidden in `.stat-value`:** `7/11`, bare integers (`6`), letter grades (`C+`), entry-state text (`Early stage`).

Overall maturity = `0.6 * Factor A + 0.4 * Factor B`.

## Factor A

Factor A is the mean of all 11 canonical slot scores. The denominator is always 11. Empty slots score 0. Stub slots usually score 5-15%.

Hard evidence rule: a topic is not present unless it contains specific facts such as figures, dates, named entities, or documents.

Caps:

- No indicative price in `snapshot`: cap 40%.
- Generic asset description without numbers: cap 30%.
- Legal structure TBD: cap 20%.
- Business model without unit prices/customer names: cap 30%.
- No specific investment amount in capital structure: score <= 5%.
- No quantified returns: score <= 5%; headline IRR without model <= 20%.
- Timeline without dates: cap 25%.
- Generic risks: cap 15%.
- Decision framework without quantified returns: cap 20%.

## Factor B

Count independent authoring parties, not file count.

| Tier | Score |
|---|---|
| Single internal or single seller source | 0-25% |
| Two-party | 25-50% |
| Multi-party | 50-75% |
| Triangulated with professional/authority sources | 75-100% |

If Factor A >= 60% but Factor B < 30%, cap entry state at Early stage and explicitly flag source concentration.

## Entry State

- Bare lead: < 15%.
- Early stage: 15-40%.
- Mid stage: 40-65%.
- Mature: >= 65%.
