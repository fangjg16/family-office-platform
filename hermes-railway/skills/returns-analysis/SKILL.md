---
name: returns-analysis
description: "Build and evaluate investment return profiles for opportunistic investments. Calculates IRR, NPV, equity multiple, cash-on-cash, and payback period under base, upside, and downside scenarios. Adapts methodology to deal type and sector. Triggers on \"returns analysis\", \"回报测算\", \"what's the IRR\", \"model the returns\", \"投资回报\", \"financial model\", \"cash flow model\"."
---

# Returns Analysis

## Workflow

### Step 1: Determine Return Model Type

Select the appropriate model structure based on deal type:

| Deal Type | Model Structure | Key Output |
|-----------|----------------|------------|
| **Development (build & sell)** | Waterfall: land cost → construction → sales → exit | Development margin, IRR, equity multiple |
| **Development (build & hold)** | DCF: construction capex → stabilized NOI → terminal value | Levered IRR, cash yield, NAV |
| **Acquisition (operating asset)** | DCF: purchase → operating cash flows → exit | Levered/unlevered IRR, equity multiple, cap rate spread |
| **Acquisition (turnaround)** | Staged: purchase → capex/repositioning → stabilization → exit | Total return, value creation breakdown |
| **JV / Co-investment** | Promote waterfall: capital structure → distribution tiers → carry | LP IRR, GP promote, net return after carry |

### Step 2: Input Parameters

Collect from knowledge base (L1) and claim audit (L2):

**Universal Inputs:**
- Investment amount (equity + debt)
- Holding period (years)
- Discount rate / hurdle rate
- Exit assumption (sale price, cap rate, multiple)
- Tax rate and structure
- Currency (and FX assumptions for cross-border)

**Sector-Specific Inputs:**

| Sector | Key Revenue Drivers | Key Cost Drivers |
|--------|-------------------|-----------------|
| **Real Estate (Dev)** | Units × price per unit, GFA × price per m² | Land, construction per m², soft costs, finance, tax (土增税/CGT) |
| **Real Estate (Commercial)** | NLA × rent per m², occupancy rate, annual escalation | Purchase price, capex, opex, management fee, land tax |
| **Energy** | MW × capacity factor × price per MWh, ancillary services revenue | Equipment cost per MW, EPC, O&M, grid charges, degradation |
| **Biosynthetics** | Revenue ramp by year, milestone payments, royalty streams | R&D burn rate, clinical costs, manufacturing scale-up |
| **Technology** | ARR × growth rate, expansion revenue, churn | CAC, R&D, hosting, G&A, sales efficiency |
| **Trade / Industrial** | Throughput × service fee, rental income, cold chain premium | Operating costs, maintenance, energy, labor |

### Step 3: Build Three Scenarios

| Scenario | Revenue Assumption | Cost Assumption | Exit Assumption |
|----------|-------------------|-----------------|-----------------|
| **Base** | Management case (most likely) | Budget + 5% contingency | Market-implied exit |
| **Upside** | Favorable market + execution | On-budget | Premium exit (scarcity, catalyst) |
| **Downside** | Stressed demand, delayed timeline | Cost overrun 15–25% | Distressed / forced exit |

### Step 4: Calculate Return Metrics

| Metric | Definition | Use |
|--------|-----------|-----|
| **Unlevered IRR** | Return on total capital, ignoring debt | Asset quality measure |
| **Levered IRR** | Return on equity after debt service | Equity investor return |
| **Equity Multiple (MOIC)** | Total distributions / total equity invested | Absolute return measure |
| **Cash-on-Cash** | Annual cash flow / equity invested | Current yield measure |
| **NPV** | Present value of all cash flows at discount rate | Value creation measure |
| **Payback Period** | Time until cumulative cash flow turns positive | Liquidity measure |
| **Development Margin** | (Revenue - Total Cost) / Total Cost | Profitability (dev deals) |
| **Peak Equity** | Maximum cumulative equity deployed | Capital commitment |

### Step 5: Capital Structure Sensitivity

Model the impact of leverage on returns:

| Leverage (LTV) | Equity Required | Levered IRR | DSCR | Equity Multiple |
|---------------|----------------|-------------|------|-----------------|
| 0% (all equity) | Full | X% | N/A | X.Xx |
| 50% | Half | Y% | Y.Yx | Y.Yx |
| 65% | 35% | Z% | Z.Zx | Z.Zx |

Flag if any leverage scenario breaches typical DSCR minimums (1.2x for commercial, 1.1x for residential).

### Step 6: Output

Report section contents:
- Summary dashboard (all metrics, 3 scenarios, side by side)
- Detailed cash flow model (annual, by line item, as HTML table)
- Scenario comparison (base/upside/downside)
- Capital structure sensitivity
- Assumptions register (every input with source and certainty tag from L1)
- Return profile summary for IC memo cross-reference

## Output Format

- **Chat**: Markdown — headline returns (IRR/multiple/payback for 3 scenarios)
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 七 投资回报与敏感性分析 (主要)
  - 五 融资结构与资本结构 (仅补充投资人侧的资金需求与退出路径)
- **Section details**:
  - 七: 三档情景回报表 (base/upside/downside)、关键假设清单、退出方式与时点
  - 五: 仅在与投资人资金安排相关的部分补充 (e.g. 自有资金占比、债务杠杆假设)
  - **不写 四**: 目标公司的收入模型、客户、定价属于 public-info-search 的范畴，本 skill 只消费这些假设、不写入它们
  - 每条假设 trace 回 KB 中对应 section + 来源 + certainty。🟡/⚪ 假设须显式高亮
## KB Handoff (mandatory — do not skip)

This skill does **not** write HTML or edit the KB file directly. After Step 6, output the following Handoff Block in the chat response, then invoke `knowledge-base-generation` to render it.

**Target slots**: `returns` (primary), `capital-structure` (supplementary, only if new capital-structure facts arise from modeling)

```
---KB-HANDOFF---
from-skill:   returns-analysis
target-slots: [returns]        # add capital-structure only if new facts
update-mode:  replace          # returns is always replaced with the latest model
version-bump: minor
findings:
  returns:
    model-type: development-sell | development-hold | acquisition-operating | acquisition-turnaround | jv
    currency-primary: <AUD | USD | CNY | ...>
    currency-secondary: RMB    # always include for cross-border deals
    scenarios:
      base:
        unlevered-irr: X%
        levered-irr: X%
        equity-multiple: X.Xx
        cash-on-cash: X%
        npv: $Xm
        payback-years: N
        exit-year: N
        exit-assumption: <description of exit basis>
      upside:
        <same fields>
      downside:
        <same fields>
    key-assumptions:
      - name: <assumption name, e.g. 终端零售价 AUD/瓶>
        value: <value>
        certainty: 🟡 <party> | 🔵 AI推论 | ⚪
        source-slot: <#anchor of the KB section this assumption came from>
        flagged: true | false    # true = 🟡/⚪ assumptions that need visual highlight
    seller-irr-comparison:       # only if seller claimed an IRR in their materials
      seller-claimed: X%
      our-base: X%
      gap-explanation: <reason for the gap>
  capital-structure:             # only if new facts; omit this block otherwise
    equity-required: $Xm
    debt-assumed: $Xm | none
    ltv: X%
    dscr-check: X.Xx | n/a
new-sources: []
new-terms: []
---END-HANDOFF---
```

> Never write cash-flow tables, IRR cells, or scenario comparison HTML directly from this skill. **不写 section 四**: target-slots 中不含 `business-model`——目标公司的客户/定价数据属于 `public-info-search` 的范畴，本 skill 只消费这些假设，不重复写入它们。

## Important Notes

- Every assumption in the model MUST trace back to the knowledge base (L1) with a certainty tag.
- Where assumptions are "🟡 Party Statement" or "⚪ Unconfirmed", the model should highlight these cells.
- Tax modeling must be jurisdiction-specific — 土地增值税 (China) vs. CGT + GST (Australia) produce very different return profiles.
- For cross-border deals, model in BOTH local currency and RMB, with explicit FX assumption.
- The returns model feeds into `ic-memo` (Section 5: Valuation & Returns) and `sensitivity-analysis`.
- Do NOT present single-point IRR as "the" return — always show a range across scenarios.


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
