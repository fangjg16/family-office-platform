# Maturity Scoring · v2.91

Overall maturity = `0.6 * Factor A + 0.4 * Factor B`.

Header scorecard main values must be percentages (`0%`-`100%`) or `—`. Slot counts, source counts, letter grades, and stage labels belong in notes or tier, not in `.stat-value`.

## Factor A

Factor A is the mean of all 13 core canonical slot scores. The denominator is always 13. Empty slots score 0. Stub slots usually score 5-15%.

Maturity measures evidence maturity, not how complete or attractive the rendered document looks. AI inference, generic market common sense, unsourced statements, titles-only sections, and descriptions without specific numbers/dates/entities/documents/links cannot justify high scores.

Hard-evidence caps:

| Slot key | Cap |
|---|---|
| `snapshot` | No indicative price/range: cap 40%. |
| `target-overview` | Generic asset/product description without numbers or deliverables: cap 30%. |
| `resource-network` | No named counterparties/resources/relationship strength: cap 20%. |
| `industry-market` | Pure opinion without sourced data: cap 20%. |
| `business-operations` | No unit price, customer evidence, or operating metrics: cap 30%. |
| `legal-ownership` | Entity, shareholder, title, IP, or rights ownership still TBD: cap 20%. |
| `regulatory-compliance` | Regulatory-sensitive project without primary-source status: cap 30%. |
| `comps-benchmark` | No named comparable case, dataset, transaction, or operating reference: 0%. |
| `valuation-returns` | No investment amount and no quantified return projections: score <= 5%; seller "high return" language contributes 0%. |
| `diligence-gaps` | Generic "needs more diligence" without claim/evidence/owner/urgency: cap 15%. |
| `risks-mitigation` | Generic risk list without concrete mechanism, impact, evidence, mitigation, or owner: cap 15%. |
| `timeline-milestones` | No dated project-level nodes: cap 25%. |
| `decision-framework` | No quantified `valuation-returns`: cap 20%. |

## Factor B

Score 0-100% based on independent authoring parties, not file count.

| Tier | Score |
|---|---|
| Single internal or single seller source | 0-25% |
| Two-party | 25-50% |
| Multi-party | 50-75% |
| Triangulated with professional/authority sources | 75-100% |

Source-counting rules:

- Count authoring parties, not file count. Ten PDFs from the same broker normally count as one source.
- Internal analyst summaries count as one internal source even if they cite many internal documents.
- Government registry extracts, court records, regulator publications, audited accounts, legal opinions, valuation reports, and direct counterparty documents should be tagged separately.
- Press articles count as one source per outlet, with a cap of three press sources contributing to diversity.
- AI-generated summaries, model outputs, and analyst inferences do not increase source diversity.

## Stage Guardrails

- Bare Lead usually stays below 25% overall unless complete transaction files and multiple independent sources already exist.
- Early usually stays below 40% overall unless key ownership, price, financial, contractual, regulatory, and third-party evidence are present.
- If Factor A is high but Factor B is low, do not upgrade to Mid/Mature; flag that the file is structurally complete but one-sided.
- If Factor B is high but Factor A is low, say sources are varied but transaction material remains incomplete.

## Multi-Asset Scoring

For multi-asset projects:

```text
slot_score = mean(per-asset scores for that slot)
Factor A   = mean(slot scores)
```

The KB header or note must surface the per-asset breakdown when asymmetry matters. Never let a well-documented sub-asset hide a bare-lead sub-asset.
