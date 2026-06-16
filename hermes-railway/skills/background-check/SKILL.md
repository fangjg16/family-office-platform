---
name: background-check
description: "Conduct background investigation on counterparties, key individuals, and related entities involved in a transaction. Covers corporate registry penetration, beneficial ownership, litigation, credit, and reputation. Triggers on \"background check\", \"背景调查\", \"who is this person\", \"check the seller\", \"对手调查\", \"实控人\", \"关联交易\", \"counterparty check\"."
---

# Background Check

## Workflow

### Step 1: Identify Investigation Targets

From the project's knowledge base, identify all entities and individuals requiring background checks:

| Target Type | Examples |
|-------------|----------|
| **Selling entity** | The company selling the asset |
| **Ultimate beneficial owner** | Person(s) who ultimately control the selling entity |
| **Key individuals** | Founders, directors, deal principals named in materials |
| **Related entities** | Parent companies, subsidiaries, affiliates, JV partners |
| **Advisors** | Seller's financial advisor, legal counsel, broker |

### Step 2: Corporate Registry Investigation

**Entity-Level Checks (by jurisdiction):**

| Check | China Sources | Australia Sources | HK Sources |
|-------|-------------|-------------------|------------|
| Registration details | 国家企业信用信息公示 | ASIC Company Extract | ICRIS |
| Directors & officers | 工商登记 | ASIC Officer Search | Companies Registry |
| Shareholders | 股权穿透 (天眼查/企查查) | ASIC Member Register | Annual Return |
| Charges & mortgages | 抵押登记 | PPSR / ASIC Charges | Companies Registry |
| Annual filings | 年报公示 | Annual statements | Annual Return |
| Status | 经营状态 (正常/注销/吊销) | Company status | Company status |

**Ownership Penetration:**
- Map the full ownership chain from the project entity up to the ultimate beneficial owner
- Identify any circular holdings or opaque structures
- Flag jurisdictions with weak disclosure requirements (BVI, Cayman, etc.)
- Note any state-owned enterprise (SOE) connections (relevant for FIRB and political risk)

### Step 3: Individual Background Checks

For key individuals, investigate:

| Check | Sources |
|-------|---------|
| **Identity verification** | Public records, professional registrations |
| **Professional history** | LinkedIn, industry databases, company announcements |
| **Directorship history** | ASIC historical search / 天眼查 任职信息 |
| **Litigation involvement** | Court records, 中国裁判文书网, Federal Court of Australia |
| **Bankruptcy / insolvency** | AFSA (AU), 失信被执行人 (CN), personal insolvency register |
| **Sanctions screening** | OFAC, EU sanctions, UN sanctions, DFAT (AU) |
| **Adverse media** | News search in relevant languages |
| **Regulatory actions** | ASIC disqualified persons, 市场禁入 |

### Step 4: Litigation & Dispute Check

Search for:
- Active litigation involving target entities or individuals
- Historical judgments and settlements
- Arbitration records (where publicly available)
- Regulatory enforcement actions
- Environmental violation records
- Tax disputes

| Jurisdiction | Court Search Sources |
|-------------|---------------------|
| China | 中国裁判文书网, 中国执行信息公开网, 信用中国 |
| Australia | Federal Court, State Supreme/District Courts, VCAT/NCAT, ASIC enforcement |
| Hong Kong | Judiciary case search |

### Step 5: Related Party Transaction Analysis

Identify potential conflicts of interest:
- Transactions between the target and entities controlled by the same individuals
- Advisory fees paid to related parties
- Land or asset transfers at non-arm's-length prices
- Management contracts with related entities
- Any arrangement where the seller benefits beyond the stated deal terms

### Step 6: Red Flag Indicators

Flag any of the following:
- Frequent corporate restructuring or entity changes
- Directors with history of failed companies in same sector
- Outstanding judgments or enforcement actions
- Sanctions list matches (even partial name matches require investigation)
- Inconsistencies between stated history and public records
- Opaque ownership structures with no clear business rationale
- SOE connections that may trigger foreign investment review issues

### Step 7: Output — Background Report

**Structure:**
1. **Summary**: Clean / Flags identified / Significant concerns
2. **Corporate structure chart**: Visual ownership chain
3. **Entity profiles**: Each entity with registration details, status, directors, shareholders
4. **Individual profiles**: Each key person with professional history, directorship, litigation
5. **Litigation & disputes register**: All findings with status and materiality assessment
6. **Related party transactions**: Identified transactions with arm's-length assessment
7. **Red flags & recommendations**: All flags with severity and suggested follow-up

## Output Format

- **Chat**: Markdown — flagged red flags + key entity/individual summary
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 三 法律结构与关键关系网
  - 九 关键风险与缓释 (only if background-check surfaces critical risks)
- **Section details**:
  - 三: 持股架构图 (HTML/SVG)、实控人识别、关联方网络、律师/会计师/估值师名单
  - 九: 任何 critical/high 风险 (司法记录、声誉风险、关联交易疑点) 同步到风险矩阵章节
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `../knowledge-base-generation/references/visual-style-guide.md`.
## Important Notes

- Background checks must respect privacy laws — use only publicly available information and lawful inquiry methods.
- For cross-border deals, check ALL relevant jurisdictions (the entity may be registered in one country but operate in another).
- SOE connections are not inherently negative but must be flagged for FIRB/regulatory analysis.
- Sanctions screening is non-negotiable for any cross-border transaction.
- Background check findings feed into `risk-matrix` (counterparty risk category).
- When adverse information is found, assess materiality before escalating — not every old lawsuit is relevant.
- Update the background check if new individuals or entities are introduced during the deal process.


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
