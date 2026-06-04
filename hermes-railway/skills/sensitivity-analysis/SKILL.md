---
name: sensitivity-analysis
description: "Quantify how changes in key assumptions affect project valuation and investment returns. Produces tornado charts, data tables, and scenario matrices that make risk tangible and decision-relevant. Triggers on \"sensitivity analysis\", \"敏感性分析\", \"what if\", \"假设变动\", \"tornado\", \"how sensitive\", \"stress test\"."
---

# Sensitivity Analysis

## Workflow

### Step 1: Identify Key Assumptions

Pull from `returns-analysis` and `dd-claim-audit` the assumptions that most affect value:

**Universal High-Sensitivity Variables:**
- Revenue price (unit price, rental rate, tariff, ASP)
- Volume / absorption (units sold, occupancy, throughput)
- Construction / development cost
- Timeline (delay in months)
- Exit assumption (cap rate, exit multiple, terminal value)
- Discount rate / cost of capital
- Leverage and interest rate

**Sector-Specific Variables:**

| Sector | Critical Variables |
|--------|-------------------|
| **Real Estate** | FSR/GFA (if uncertain), price per m², construction cost per m², pre-sale rate, settlement default rate, 土增税 bracket |
| **Energy** | Electricity price (spot + contract), capacity factor, degradation rate, ancillary service revenue, curtailment % |
| **Biosynthetics** | Clinical success probability, time to approval, peak revenue, patent cliff date, manufacturing yield |
| **Technology** | ARR growth rate, churn rate, gross margin, CAC payback period |
| **Trade / Industrial** | 签约率, rental rate, occupancy ramp speed, cold chain energy cost |

### Step 2: Define Variation Range

For each variable, define base, optimistic, and pessimistic values:

| Variable | Pessimistic | Base | Optimistic | Source for Range |
|----------|------------|------|-----------|-----------------|
| Sale price per m² | -15% | Base | +10% | Market cycle analysis |
| Construction cost | +20% | Base | -5% | Recent tender data |
| Occupancy | 60% | 80% | 95% | Comparable projects |
| Timeline | +12 months | Base | On schedule | Historical DA timelines |

Ranges should be informed by:
- L2 claim audit findings (questionable assumptions get wider ranges)
- L4 comp analysis (market data boundaries)
- Industry benchmarks and historical distributions

### Step 3: One-Variable Sensitivity (Tornado Chart)

Hold all other variables at base case, vary one variable across its range:

| Variable | Pessimistic IRR | Base IRR | Optimistic IRR | Swing |
|----------|----------------|----------|----------------|-------|
| Sale price | 8% | 15% | 19% | 11% |
| Construction cost | 10% | 15% | 17% | 7% |
| Timeline delay | 11% | 15% | 15% | 4% |
| Occupancy | 7% | 15% | 18% | 11% |

Sort by swing (largest first) to produce tornado chart.

### Step 4: Two-Variable Sensitivity (Data Tables)

For the top 2–3 variables by swing, create two-way data tables:

**Example: Sale Price × Construction Cost → IRR**

| | Cost -5% | Cost Base | Cost +10% | Cost +20% |
|---|---------|-----------|-----------|-----------|
| **Price +10%** | 22% | 19% | 16% | 12% |
| **Price Base** | 18% | 15% | 12% | 8% |
| **Price -10%** | 13% | 10% | 7% | 3% |
| **Price -15%** | 10% | 8% | 4% | 0% |

Color-code: Green (above hurdle) / Yellow (marginal) / Red (below hurdle or negative).

### Step 5: Scenario Matrix

Combine multiple variable changes into coherent scenarios:

| Scenario | Description | Key Assumption Changes | IRR | Multiple |
|----------|-------------|----------------------|-----|----------|
| **Bull** | Strong market, fast execution | Price +10%, cost on-budget, on-time | 22% | 2.4x |
| **Base** | Management case | All base assumptions | 15% | 1.8x |
| **Bear** | Market softens, delays | Price -10%, cost +15%, +6 months | 7% | 1.3x |
| **Stress** | Everything goes wrong | Price -15%, cost +20%, +12 months, 60% occupancy | 2% | 1.1x |
| **Break-even** | What combination of adverse changes makes IRR = 0? | Calculate reverse | 0% | 1.0x |

### Step 6: Break-Even Analysis

Identify the break-even point for each key variable (all else equal):
- At what sale price does IRR = hurdle rate?
- At what occupancy level does the project break even?
- How many months of delay can the project absorb before IRR drops below hurdle?
- At what construction cost does equity multiple fall below 1.0x?

### Step 7: Output

Report section contents:
- Tornado chart (rendered as HTML/SVG)
- Two-way data tables (top 2–3 variable pairs, color-coded)
- Scenario matrix
- Break-even analysis
- Assumption register (all variables with ranges and sources)

## Output Format

- **Chat**: Markdown — top 3 sensitivities + break-even summary
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 七 投资回报与敏感性分析
- **Section details**:
  - 七: Tornado chart、双变量敏感性矩阵、break-even 关键阈值、对决策影响最大的 3-5 个变量
  - 如发现某变量对项目可行性极度敏感 → 同步到 九 关键风险与缓释
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Sensitivity analysis is only as good as the range definitions — garbage ranges produce garbage insights.
- When L2 claim audit flags an assumption as "questionable", automatically widen the range for that variable.
- Always include a **break-even analysis** — decision-makers care more about "can I lose money" than "what's the best case".
- For real estate, separately model pre-sale scenario vs. completed-stock scenario if market conditions are uncertain.
- Time delay sensitivity is often underestimated — model it explicitly (carrying cost, opportunity cost, market shift).
- This skill feeds directly into `ic-memo` and `risk-matrix`.


## 持续学习（Self-Evolution）

每次开始任务时，先读取 `knowledge/` 文件夹中已有的学习记录；每次完成任务后，把新学到的内容追加进去。

触发记录的条件：
- 遇到当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得重用的成功经验或模式
- 原有指令出现歧义或冲突

若认为核心指令需要改进，请主动告知用户并说明原因。
