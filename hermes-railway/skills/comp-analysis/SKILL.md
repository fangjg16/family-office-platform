---
name: comp-analysis
description: "Identify comparable transactions, build a valuation reference frame, and define the project's differentiated positioning versus peers. Combines quantitative comp data with qualitative anchoring analysis. Triggers on \"comp analysis\", \"可比交易\", \"comparable\", \"what's this worth\", \"market positioning\", \"对标\", \"valuation reference\", \"估值参照\"."
---

# Comparable Transaction & Market Positioning Analysis

## Workflow

### Step 1: Define Comp Criteria

Based on the project's knowledge base (L1), establish screening criteria:

| Criterion | Priority | Description |
|-----------|----------|-------------|
| **Location** | Primary | Same city/region > same-tier city > same country |
| **Sector / Asset Type** | Primary | Must match (residential ≠ commercial ≠ industrial) |
| **Scale** | Secondary | Within 0.3x–3x of target size |
| **Stage** | Secondary | Same development stage (land / under construction / operating) |
| **Recency** | Secondary | Within 24 months preferred; 36 months acceptable |
| **Transaction Type** | Tertiary | Acquisition / JV / IPO / refinancing |

### Step 2: Source Comparable Transactions

**Sector-Specific Comp Sources:**

| Sector | China Sources | Overseas Sources |
|--------|-------------|-----------------|
| **Real Estate** | 土地市场网, 产权交易所, 克而瑞, 上市公司公告 | CoreLogic, JLL/CBRE research, Domain, AFR, Major Transactions |
| **Energy** | 中电联, 行业新闻, 电力交易中心 | BNEF, Infrastructure Investor, Mergermarket, AEMO registry |
| **Biosynthetics** | 医药并购数据, CDE, 上市公司公告 | BioPharma Dive, Evaluate Pharma, BioWorld, SEC filings |
| **Technology** | IT桔子, 36氪, Crunchbase | Crunchbase, PitchBook, CB Insights |
| **Trade / Industrial** | 产权交易所, 行业新闻 | Industrial property databases, logistics REIT filings |

### Step 3: Build Comp Table

For each comparable, record:

| Field | Description |
|-------|-------------|
| Transaction name | Project / company name |
| Location | City / region |
| Transaction date | Close date |
| Transaction value | In local currency + RMB equivalent |
| Key metric | Sector-dependent (see below) |
| Unit value | Value per unit of key metric |
| Buyer type | Strategic / financial / sovereign / family office |
| Stage at transaction | Pre-approval / approved / RTB / operating |
| Key differences from target | What makes this comp imperfect |

**Sector-Specific Key Metrics:**

| Sector | Primary Metric | Secondary Metrics |
|--------|---------------|-------------------|
| Real Estate (Dev) | Price per m² (land) or per GFA | FSR, height, location premium |
| Real Estate (Operating) | Cap Rate, Price per NLA | Occupancy, WALE, tenant quality |
| Energy (Renewables) | AUD/MW (development) or AUD/MWh (storage) | Capacity factor, PPA terms, grid connection status |
| Biosynthetics | Revenue multiple, Price/pipeline asset | Phase of lead candidate, TAM |
| Technology | Revenue multiple, ARR multiple | Growth rate, NRR, Rule of 40 |
| Industrial / Trade | Price per m², Price per tonne capacity | Occupancy, throughput, lease terms |

### Step 4: Differentiation Anchor Analysis

Beyond quantitative comps, identify what makes this project DIFFERENT from comparables:

**Premium Anchors (why it might be worth MORE):**
- Scarcity (e.g., "唯一不受 GBMPA 限制的 Whitsundays 岛屿")
- Infrastructure advantage (e.g., "共址光伏场区内储能, 已有接网设施")
- Policy tailwind (e.g., "TOD Accelerated Precinct, 加速审批通道")
- Timing catalyst (e.g., "2032 Brisbane Olympics sailing venue")
- Approval certainty (e.g., "DA already granted, GPS in final review")

**Discount Anchors (why it might be worth LESS):**
- Approval uncertainty (e.g., "Rezoning not yet complete")
- Market immaturity (e.g., "区域认知度不足, 目的地尚未建立")
- Execution complexity (e.g., "遗产保护约束, 地下隧道穿越")
- Counterparty risk (e.g., "卖方财务状况不明")
- Information gaps (e.g., "关键可行性数据缺失")

### Step 5: Valuation Range

Based on comp analysis + differentiation anchors, establish:
- **Floor**: Conservative valuation (worst comp + discount anchors)
- **Midpoint**: Base case (median comp, adjusted for key differences)
- **Ceiling**: Optimistic valuation (best comp + premium anchors)
- **Recommended bid range**: Where to position given risk appetite

### Step 6: Output

Report section contents:
1. Comp selection methodology and criteria
2. Comp table (3–8 comparables)
3. Each comp: brief narrative on relevance and differences
4. Differentiation anchor analysis
5. Valuation range and recommendation
6. Comp data table (filterable)
7. Valuation sensitivity (how range changes if key assumptions shift)
8. Source registry

## Output Format

- **Chat**: Markdown — top 3 comps + valuation range conclusion
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 六 市场对标与可比交易
- **Section details**:
  - 六: 可比交易表 (日期/规模/对价/倍数)、行业基准数据、估值参照区间、项目差异化定位
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Perfect comps rarely exist for non-standard investments. Acknowledge imperfections explicitly.
- When few direct comps exist, expand to analogous sectors or structures (with clear disclaimers).
- Differentiation anchors are where the real analytical value lies — don't shortchange this section.
- For cross-border projects, always convert to a common currency AND note exchange rate assumptions.
- Valuation range should feed directly into `ic-memo` Section 5.
- Update comp table when new transactions are announced — comps are time-sensitive.


## 持续学习（Self-Evolution）

每次开始任务时，先读取 `knowledge/` 文件夹中已有的学习记录；每次完成任务后，把新学到的内容追加进去。

触发记录的条件：
- 遇到当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得重用的成功经验或模式
- 原有指令出现歧义或冲突

若认为核心指令需要改进，请主动告知用户并说明原因。
