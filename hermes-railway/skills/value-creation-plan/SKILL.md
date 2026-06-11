---
name: value-creation-plan
description: "Develop a structured post-acquisition value creation plan that identifies specific levers to enhance asset value, estimates their impact, and defines an execution roadmap. Bridges the gap between \"what we're buying\" and \"what we'll make it worth\". Triggers on \"value creation\", \"投后增值\", \"how do we add value\", \"value-add plan\", \"增值方案\", \"what can we do with this asset\"."
---

# Value Creation Plan

## Workflow

### Step 1: Establish Baseline

Define the asset's current state from the knowledge base (L1):

| Baseline Metric | Current Value | Source |
|----------------|---------------|--------|
| Asset value / purchase price | X | Comp analysis / offer |
| Current revenue / NOI | X | Financial DD |
| Current occupancy / utilization | X% | Operating data |
| Current cost structure | X | Financial DD |
| Current market position | Description | Commercial DD |

### Step 2: Identify Value Creation Levers

Scan for applicable levers by category:

**Revenue Enhancement**

| Lever | Applicability by Sector |
|-------|------------------------|
| Rental / price increase | Real Estate, Industrial |
| Occupancy improvement | Real Estate, Industrial, Hospitality |
| Revenue mix optimization | All (shift to higher-margin products/tenants/uses) |
| New revenue streams | All (ancillary services, fees, licensing) |
| Market repositioning | Hospitality, Commercial RE, Technology |
| Expansion / densification | Real Estate (FSR uplift), Energy (capacity addition) |

**Cost Reduction**

| Lever | Applicability |
|-------|---------------|
| Operational efficiency | All |
| Energy cost reduction | Industrial, Real Estate, Energy |
| Procurement optimization | All (renegotiate contracts at scale) |
| Management fee reduction | Real Estate (internalize management) |
| Technology-enabled savings | All (automation, IoT, AI) |

**Capital Structure Optimization**

| Lever | Applicability |
|-------|---------------|
| Refinancing at lower rate | All (when rate environment allows) |
| Leverage optimization | All (increase LTV if asset stabilized) |
| Tax structure optimization | Cross-border (treaty planning, CGT deferral) |
| Capital recycling | Portfolio (sell low-yield, redeploy to high-yield) |

**Strategic / Development Value**

| Lever | Applicability |
|-------|---------------|
| Rezoning / entitlement uplift | Real Estate (increase FSR/density) |
| Master plan approval | Real Estate (unlock development potential) |
| Technology upgrade | Energy (repowering, BESS addition), Industrial (automation) |
| Brand / management upgrade | Hospitality (flag to international operator) |
| Platform build-out | All (use as base for roll-up or regional expansion) |

### Step 3: Quantify Each Lever

For each identified lever:

| Field | Description |
|-------|-------------|
| **Lever** | Specific action |
| **Value impact** | Estimated dollar impact on asset value or annual cash flow |
| **Probability of execution** | High / Medium / Low |
| **Risk-adjusted impact** | Impact × probability |
| **Capital required** | Investment needed to execute |
| **Time to realize** | Months/years until value is captured |
| **Dependencies** | What must happen first (approvals, capex, market conditions) |

### Step 4: Value Creation Bridge

Build a waterfall from purchase price to target exit value:

```
Purchase Price: $X
+ Revenue enhancement: +$A
+ Cost reduction: +$B
+ Cap rate compression / multiple expansion: +$C
+ Development value uplift: +$D
- Execution / capex cost: -$E
= Target Exit Value: $Y
Value Created: $Y - $X = $Z
```

### Step 5: Execution Roadmap

| Phase | Timeline | Key Actions | Capital Required | Value Unlocked |
|-------|----------|-------------|-----------------|----------------|
| Quick wins (0–6 months) | Immediate | Rent review, cost audit, management change | Low | Moderate |
| Medium-term (6–24 months) | Year 1–2 | Repositioning, capex program, tenant remix | Moderate | Significant |
| Long-term (2–5 years) | Year 2–5 | Development, rezoning, platform expansion | High | Transformative |

### Step 6: Output

Report section contents:
1. Baseline assessment (current state snapshot)
2. Value creation lever inventory (all identified levers with quantification)
3. Value bridge waterfall (rendered as HTML/SVG)
4. Execution roadmap (phased action plan)
5. Key risks to value creation plan
6. KPI tracking framework (how to measure progress)

## Output Format

- **Chat**: Markdown — top 3 levers + total estimated value creation
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 十一 决策框架
- **Section details**:
  - 十一: 可执行 value-add 杠杆清单 (每项标注影响金额、概率、时间窗口)
  - 100天 / 1年 / 出售前 三档执行 roadmap
  - 桥接 '我们买了什么' → '我们能让它值多少'
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Value creation is where family offices differentiate from passive investors — this plan should reflect what THIS investor can uniquely do.
- Be realistic about execution capability — a plan that requires skills the team doesn't have is not a plan.
- Distinguish between value creation (genuine improvement) and value recognition (market timing / cap rate movement).
- For cross-border assets, include currency hedging and repatriation strategy as a value preservation measure.
- The value creation plan feeds into `ic-memo` as supporting evidence for the investment thesis.
- Track execution against plan post-acquisition — the plan should have measurable KPIs.


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
