---
name: dd-checklist
description: "Generate and track comprehensive due diligence checklists tailored to the target project's sector, jurisdiction, deal type, and complexity. Covers all major workstreams with request lists, status tracking, and red flag escalation. Use when kicking off diligence, organizing a data room review, or tracking outstanding items. Triggers on \"dd checklist\", \"尽调清单\", \"due diligence tracker\", \"diligence request list\", \"what do we still need to check\", \"data room review\"."
---

# Due Diligence Checklist

## Workflow

### Step 1: Scope the Diligence

Ask the user for:
- **Target project**: Name, sector, location
- **Deal type**: Asset acquisition, equity acquisition, JV, development, carve-out
- **Jurisdiction**: Domestic China, Australia, Hong Kong, cross-border
- **Deal size / complexity**: Determines depth of diligence
- **Key concerns**: Any known issues to prioritize
- **Timeline**: When is LOI / close targeted?

### Step 2: Generate Workstream Checklists

Generate a checklist across all major workstreams, with sector and jurisdiction customization:

**Financial Due Diligence**
- Historical financial statements (3 years)
- Revenue quality and sustainability analysis
- Working capital analysis — normalized vs. actual
- Debt and debt-like items (including off-balance sheet)
- Capital expenditure (maintenance vs. growth)
- Tax structure and exposure
- Pro forma adjustments

**Legal Due Diligence**
- Corporate structure and ownership chain
- Material contracts (customer, supplier, JV, lease)
- Litigation history and pending claims
- IP portfolio and protection (if applicable)
- Regulatory compliance history
- Employment agreements

**Title & Land Due Diligence** (Real Estate / Infrastructure)

| Item | China | Australia |
|------|-------|-----------|
| Title search | 不动产权证, 土地出让合同 | Certificate of Title, Title Search |
| Encumbrances | 抵押登记, 查封, 限制 | Mortgages, caveats, easements, covenants |
| Zoning / Land use | 用地性质, 规划条件 | LEP zoning, SEPP provisions |
| Survey | 勘测定界, 地形图 | Registered survey, lot boundaries |
| Environmental | 环评批复, 污染调查 | Phase 1/2 ESA, contamination assessment |
| Heritage | 文保评估 | CMP, Aboriginal heritage, s170 register |
| Native title | N/A | Native title search, ILUA |

**Planning & Approvals Due Diligence** (Real Estate)

| Item | China | Australia |
|------|-------|-----------|
| Development approval | 建设用地/工程规划许可 | DA / Planning Permit |
| Building approval | 施工许可证 | CC / Building Permit |
| Conditions compliance | 规划验收条件 | DA conditions schedule — which met, which outstanding |
| Planning controls | 控规指标对照 | LEP/DCP/SEPP controls vs. approved scheme |
| Staging approval | 分期批复 | Staged DA / Subdivision certificate |

**Grid & Network Due Diligence** (Energy / Infrastructure)
- Connection agreement status
- GPS (Generator Performance Standards) review stage
- Network capacity and curtailment assessment
- AEMO registration status
- Transmission upgrade requirements and cost allocation

**Technical Due Diligence**
- Engineering / design review
- Equipment specification and sourcing
- Construction methodology and timeline
- Performance guarantees and warranties
- O&M arrangements

**Regulatory & Compliance** (Biosynthetics / Technology)
- FDA/EMA/NMPA regulatory status
- Clinical trial data and outcomes
- GMP/ISO certifications
- Data privacy compliance (GDPR, PIPL, SOC2)
- Patent freedom-to-operate analysis

**Market & Commercial Due Diligence**
- Market size and growth trajectory
- Competitive landscape
- Customer / tenant analysis (concentration, retention)
- Pricing power and contract terms
- Pipeline and backlog

**HR / People Due Diligence**
- Key person dependencies
- Compensation and benefits structure
- Retention risk assessment
- Organizational capability

**Insurance Due Diligence**
- Current coverage adequacy
- Claims history
- Required coverage for operations

**Foreign Investment Review** (cross-border)
- FIRB / OIO / CFIUS applicability
- Application timeline and conditions
- National interest / security test considerations

### Step 3: Status Tracking

For each item, track:

| Item | Workstream | Priority | Status | Owner | Due Date | Notes |
|------|-----------|----------|--------|-------|----------|-------|
| Title search | Title & Land | P0 | Requested | | 2026-06-01 | Ordered via lawyer |
| QoE analysis | Financial | P0 | In Progress | | | Draft received, under review |

Status options: `Not Started → Requested → Received → In Review → Complete → Red Flag`

### Step 4: Red Flag Summary

Maintain a running list of red flags:
- What was found
- Which workstream
- Severity: **Deal-breaker** / **Significant** (affects terms) / **Manageable** (can be mitigated)
- Mitigant or path to resolution
- Impact on valuation or deal terms

### Step 5: Output

- Checklist tables per workstream with status tracking
- Summary dashboard: % complete by workstream, outstanding items, red flags
- Feed red flags into `risk-matrix`
- Feed outstanding items into `gap-tracking`

## Output Format

- **Chat**: Markdown — workstream progress summary + P0 outstanding items + red flags
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 十 待确认问题清单
- **Section details**:
  - 十: 按工作流 (法律/财务/税务/商业/技术/环境/监管) 组织的 open-question 表；每项标注紧迫度、责任方、阻塞性
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `../knowledge-base-generation/references/style-guide-v2.7.md`.
## Sector-Specific Additions

Automatically add relevant items based on sector:
- **Real Estate**: Title, planning controls, heritage, staging, infrastructure contributions, affordable housing obligations
- **Energy**: Grid connection, GPS review, AEMO registration, offtake/PPA, technology warranty
- **Biosynthetics**: Regulatory pathway, clinical data, IP, GMP certification, supply chain for feedstock
- **Technology**: Technical architecture, SOC2/security, product metrics, customer contracts, data privacy
- **Trade / Industrial**: Import/export licenses, 动检证, cold chain certification, occupancy/lease terms, environmental compliance

## Important Notes

- Prioritize P0 items that are gating to LOI or close.
- Flag items where the seller is slow to respond — may indicate issues.
- Cross-reference data room contents against the checklist to identify gaps.
- The checklist is a living document — update as diligence progresses.
- For cross-border deals, run parallel DD tracks for each jurisdiction.


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
