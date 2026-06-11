---
name: risk-matrix
description: "Systematically identify, categorize, and assess all material risks for an investment opportunity. Each risk is scored on likelihood and impact, linked to its source evidence, and tracked with mitigation status. The matrix is the definitive risk register for the project. Triggers on \"risk matrix\", \"风险矩阵\", \"what are the risks\", \"risk assessment\", \"风险评估\", \"what could go wrong\"."
---

# Risk Matrix

## Workflow

### Step 1: Risk Harvesting

Collect risk inputs from all upstream analysis layers:

| Source | Risk Type | Example |
|--------|-----------|---------|
| L1 Knowledge Base | Factual gaps that create uncertainty | Key approval status unknown |
| L2 Claim Audit | Contradicted or questionable claims | Seller's cost claim unsupported |
| L2 Claim Audit | Sensitive assumptions | Revenue depends on 80% occupancy assumption |
| DD Checklist | Red flags from diligence | Title encumbrance discovered |
| Background Check | Counterparty concerns | Director has insolvency history |
| Comp Analysis | Market positioning risk | Limited comps suggest thin market |

Additionally, scan for risks not surfaced by other layers (macro, political, force majeure).

### Step 2: Risk Categorization

Classify every risk into one of 8 standard categories:

| Category | Scope |
|----------|-------|
| **Policy & Regulatory** | Government policy changes, regulatory shifts, foreign investment rules |
| **Approval & Permitting** | DA/planning refusal, conditions, delays, appeals |
| **Market & Demand** | Price decline, demand shortfall, competition, cycle timing |
| **Capital & Financial** | Funding shortfall, interest rate, FX, cost overrun, liquidity |
| **Construction & Execution** | Delays, cost escalation, contractor failure, supply chain |
| **Legal & Compliance** | Title defect, litigation, environmental liability, tax exposure |
| **Counterparty & People** | Seller reliability, key person dependency, partner misalignment |
| **Environmental & Force Majeure** | Natural disaster, climate, contamination, pandemic |

**Sector-Specific Risk Additions:**

| Sector | Additional Risks |
|--------|-----------------|
| **Real Estate** | Heritage constraints, community opposition, infrastructure contribution escalation, strata defects |
| **Energy** | Grid connection failure (GPS rejection), curtailment, technology obsolescence, offtake counterparty default |
| **Biosynthetics** | Clinical trial failure, regulatory rejection, IP challenge, feedstock supply disruption |
| **Technology** | Technology disruption, data breach, customer churn, talent retention |
| **Trade** | Tariff changes, quarantine/inspection failure, cold chain breakdown, commodity price volatility |

### Step 3: Risk Assessment

For each risk, score:

**Likelihood:**
| Score | Label | Definition |
|-------|-------|-----------|
| 4 | Very Likely | > 70% probability |
| 3 | Likely | 40–70% |
| 2 | Possible | 15–40% |
| 1 | Unlikely | < 15% |

**Impact:**
| Score | Label | Definition |
|-------|-------|-----------|
| 4 | Fatal | Project becomes unviable |
| 3 | Severe | >20% value destruction or fundamental strategy change required |
| 2 | Significant | 5–20% value impact, manageable with adjustments |
| 1 | Minor | <5% impact, can be absorbed |

**Risk Score** = Likelihood × Impact (range 1–16)

| Score Range | Classification | Action |
|------------|----------------|--------|
| 12–16 | **Critical** | Must be resolved or mitigated before proceeding |
| 8–11 | **High** | Requires active management plan and deal term protection |
| 4–7 | **Medium** | Monitor and include in sensitivity analysis |
| 1–3 | **Low** | Accept and monitor |

### Step 4: Mitigation & Gap Assessment

For each risk, document:

| Field | Description |
|-------|-------------|
| **Risk ID** | R-001, R-002... |
| **Category** | One of 8 categories |
| **Description** | Specific risk scenario (not generic category name) |
| **Likelihood** | 1–4 |
| **Impact** | 1–4 |
| **Score** | L × I |
| **Current mitigation** | What is already in place |
| **Residual gap** | What additional mitigation is needed |
| **Mitigation owner** | Who is responsible |
| **Source** | Which analysis layer/finding generated this risk |
| **Update trigger** | What event would change this assessment |
| **Link to gap-tracking** | Gap ID if information gap exists |

### Step 5: Output — Risk Matrix

Report section contents:
- Full risk register (sortable by score, category, source)
- Risk heatmap (likelihood × impact grid with risk IDs plotted, rendered as HTML/SVG)
- Critical & High risks — detailed analysis
- Mitigation action plan
- Risk-source traceability (links to L2 findings, DD red flags, etc.)
- Top 5 risks summary for IC memo cross-reference
- Overall risk profile assessment (aggressive / moderate / conservative)

## Output Format

- **Chat**: Markdown — critical risks list + overall risk profile

## KB Handoff (mandatory — do not skip)

This skill does **not** write HTML or edit the KB file directly. After Step 5, output the following Handoff Block in the chat response, then invoke `knowledge-base-generation` to render it.

**Target slots**: `risks`, `open-questions`

```
---KB-HANDOFF---
from-skill:   risk-matrix
target-slots: [risks, open-questions]
update-mode:  merge
version-bump: minor
findings:
  risks:
    overall-profile: aggressive | moderate | conservative
    items:
      - id: R-001
        category: <one of 8 standard categories>
        description: <specific risk scenario — not just the category name>
        likelihood: 1-4
        impact: 1-4
        score: <L×I>
        level: Critical | High | Medium | Low
        redline: true | false       # true = deal-stopper if triggered
        mitigation-current: <what is already in place>
        mitigation-gap: <what additional action is needed>
        owner: <responsible party>
        certainty: ✅ | 🟡 <party> | 🔵 AI推论 | ⚪
        source: [U-N, A-N]
      - id: R-002
        ...
  open-questions:
    - section: risks
      item: <specific information gap or mitigation action>
      urgency: Blocker | 高 | 中
      owner: <who must provide this>
new-sources: []
new-terms: []
---END-HANDOFF---
```

> Never write `<table>`, `<tr>`, risk badge HTML, or any KB HTML fragment directly from this skill. All rendering is done by `knowledge-base-generation` from the Handoff Block above.
## Important Notes

- The risk matrix is a **living document** — update when new information arrives or events occur.
- Every critical/high risk should have a corresponding entry in `gap-tracking` (if information gap) or a mitigation action plan (if actionable).
- Risk scores should be revisited when key decision nodes are resolved (e.g., GPS approval → approval risk score changes).
- For cross-border projects, include a dedicated "Cross-border / Regulatory" sub-section covering FIRB, FX, tax treaty, and repatriation risks.
- The risk matrix feeds directly into `ic-memo` (Section 4: Core Risks) and `sensitivity-analysis`.
- Do NOT list risks without actionable context — every risk needs "so what" (what it means for the deal).


## 边界案例提醒

Plugin 安装后 skill 文件只读，Claude 无法在执行过程中自动写入经验。遇到以下情况时，在**本次对话末尾**用固定格式提醒用户，由用户决定是否开启更新会话手动写入 SKILL.md：

- 当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得复用的成功模式
- 原有指令存在歧义或冲突

提醒格式：
```
💡 建议写入 SKILL.md：[简短描述发现]
原因：[为什么值得复用]
```
