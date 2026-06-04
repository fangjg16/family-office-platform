---
name: public-info-search
description: "Systematically search and collect publicly available information about an investment target. Covers government approvals, corporate registry, land titles, market data, comparable transactions, and news. Search strategy adapts to sector and jurisdiction (domestic China vs. overseas). Triggers on \"search for\", \"搜一下\", \"public info\", \"公开信息\", \"what can we find on\", \"background on this project\", or automatically from project-intake when completeness is below 40%."
---

# Public Information Search

## Workflow

### Step 1: Define Search Scope

Based on project name, location, and sector, determine:
- **Jurisdiction**: Domestic China / Australia / Hong Kong / Other (affects source selection)
- **Sector**: Real Estate / Energy / Biosynthetics / Technology / Trade (affects search priorities)
- **Search depth**: Broad scan (bare lead) vs. targeted fill (known gaps only)

### Step 2: Execute Search by Category

Search across 7 categories. Sources vary by jurisdiction:

**Category 1: Regulatory & Approvals**

| Jurisdiction | Sources | Priority Fields |
|-------------|---------|-----------------|
| China | 自然资源局, 住建局, 发改委, 政务公开网, 生态环境局 | 规划许可, 施工许可, 环评批复, 立项备案 |
| Australia (NSW) | Planning Portal, Council DA tracker, Major Projects, AEMO | DA status, SEPP/LEP provisions, GPS review stage |
| Australia (VIC) | DELWP, Council, VCAT, Planning Schemes Online | Planning permit, EES, overlay controls |
| Hong Kong | Town Planning Board, Lands Department, Buildings Department | OZP zoning, lease conditions, building plans |

**Category 2: Corporate & Ownership**

| Jurisdiction | Sources | Priority Fields |
|-------------|---------|-----------------|
| China | 天眼查/企查查, 国家企业信用信息公示, 工商登记 | 股东, 实控人, 注册资本, 经营范围, 司法风险 |
| Australia | ASIC, ABN Lookup | Company extract, directors, shareholders, charges |
| Hong Kong | Companies Registry, ICRIS | Directors, shareholders, annual returns |
| Cross-border | Multiple registries | Map ownership chain across jurisdictions |

**Category 3: Land & Title**

| Jurisdiction | Sources | Priority Fields |
|-------------|---------|-----------------|
| China | 不动产登记中心, 自然资源确权系统, 土地市场网 | 用地性质, 面积, 出让年限, 抵押/查封 |
| Australia | Land Registry Services, Title Search | Lot/Plan, Freehold/Leasehold, encumbrances, easements, covenants |
| Hong Kong | Land Registry | Memorial search, government lease conditions |

**Category 4: Market Data**

| Sector | Sources (China) | Sources (Overseas) |
|--------|----------------|-------------------|
| Real Estate | 克而瑞, 中指, 贝壳, 统计局 | CoreLogic, Domain, RPData, ABS |
| Energy | 中电联, 国网, 能源局 | AEMO, AEMC, Clean Energy Council, IRENA |
| Trade/Industrial | 海关总署, 行业协会 | Trade statistics, port authority data |
| Biosynthetics | CDE/NMPA, 药智网 | FDA/EMA databases, ClinicalTrials.gov |

**Category 5: Comparable Transactions**

| Sector | China Sources | Overseas Sources |
|--------|-------------|-----------------|
| Real Estate | 土地市场网 (出让结果), 产权交易所, 上市公司公告 | JLL/CBRE research, AFR, Domain, capital markets announcements |
| Energy | 电力交易中心, 行业新闻 | Infrastructure Investor, Mergermarket, BNEF |
| Biosynthetics | 医药并购数据库 | BioPharma Dive, Evaluate Pharma |

**Category 6: Policy & Regulation**

| Jurisdiction | Sources |
|-------------|---------|
| China | 住建部, 央行, 银保监, 地方限购/限贷政策, 土地增值税规则 |
| Australia | State planning legislation, FIRB rules, CGT/GST, heritage acts, aboriginal heritage |
| Hong Kong | Rating and Valuation Dept, IRD, Town Planning Ordinance |

**Category 7: News & Sentiment**

- Google News (English + Chinese)
- Industry-specific media
- Community opposition / social media (for projects with public impact)
- Court/tribunal records (legal disputes)

### Step 3: Information Quality Assessment

For each item found, assess:
- **Source authority**: Government / independent body / media / forum
- **Recency**: How current is the information
- **Relevance**: Direct (about the project) vs. contextual (about the market/area)
- **Conflicts**: Does this contradict other sources → flag for `dd-claim-audit`

### Step 4: Output — Search Results Dossier

| # | Category | Item Found | Source | Date | Confidence | Relevance | Notes |
|---|----------|-----------|--------|------|-----------|-----------|-------|
| 1 | Approval | DA approved for Mod 4 BESS | NSW Planning Portal | 2025-04-02 | High | Direct | SSD-9254-MOD-4 |
| 2 | Corporate | BEI Australia Pty Ltd — holder | ASIC | Current | High | Direct | ACN查询 |

### Step 5: Feed Downstream

- All findings → `knowledge-base-generation` (as source material)
- Contradictions → `dd-claim-audit` (as audit triggers)
- Missing categories → `gap-tracking` (as registered gaps)
- Comparable transactions → `comp-analysis` (as input)

## Output Format

- **Chat**: Markdown — key findings summary by category + top gaps
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 一 项目快照
  - 二 资产构成
  - 三 法律结构与关键关系网
  - 四 业务模式与收入假设
  - 五 融资结构与资本结构
  - 八 项目时间轴
- **Section details**:
  - 根据搜索结果性质分别落地: 政府审批 → 二; 工商登记 → 三; 目标公司客户/定价/单位经济 → 四; 资金来源/融资轮次/债务安排 → 五; 历史事件/新闻 → 八
  - **宏观背景信息（Category 4 Market Data / Category 6 Policy & Regulation 中属于行业大势、口岸概况、区域政策等环境性数据）不单独写入任何 section 作为独立子块**。处理规则：① 若某条数据用于支撑 section 二 的某个资产/资源条目，作为该行表格来源列的内联引用；② 若属于投资论点层面的宏观支撑，归入 section 十一 决策框架的论据；③ 若两者均不符合，仅登记至附录 A 备查，不强行塞入正文。
  - **不写 七 投资回报**: 投资人 IRR / MOIC 是 returns-analysis 的产物, 不是公开信息搜集的结果。即使 OM 中写了 'projected IRR 18%', 也只能作为'卖方声称'录入 七 的对比项, 不能作为投资回报本身。
  - 每条新增内容标注 certainty (默认 ⚪ 待确认 或 🔵 分析师推论)
  - 新增的 URL/文献来源同步登记到 附录 A
## KB Handoff (mandatory — do not skip)

This skill does **not** write HTML or edit the KB file directly. After Step 4, output the following Handoff Block in the chat response, then invoke `knowledge-base-generation` to render it. Omit any slot key that has no new findings.

**Target slots** (subset, based on what was found): `snapshot`, `assets`, `legal-relationships`, `business-model`, `capital-structure`, `timeline`

```
---KB-HANDOFF---
from-skill:   public-info-search
target-slots: [<only the slots with new findings>]
update-mode:  merge
version-bump: minor | major    # minor if ≤3 slots; major if ≥4
findings:
  snapshot:                    # include only if new snapshot-level facts found
    - field: <field name, e.g. 当前阶段>
      value: <value>
      certainty: ✅ | 🟡 <party> | 🔵 AI推论 | ⚪
      source: [A-N]
  assets:                      # include only if new asset/resource facts found
    - item: <asset or resource name>
      detail: <description>
      certainty: ...
      source: [...]
  legal-relationships:
    - entity: <canonical entity name>
      role: 实控人 | 董事 | 关联方 | 顾问 | ...
      detail: <detail>
      certainty: ...
      source: [...]
  business-model:
    - topic: <topic name, e.g. 中国出口合规路径>
      status: 待调研 | 部分解答 | 研究结论 | 已解答
      findings:
        - <finding text, certainty tag, source>
  capital-structure:
    - field: <e.g. 历史融资轮次>
      value: <value>
      certainty: ...
      source: [...]
  timeline:                    # project-entity events only; no industry history
    - date: <YYYY-MM-DD or YYYY-MM>
      event: <event description>
      relevance: 关键 | 重要 | 一般
      certainty: ...
      source: [...]
new-sources:
  - id: A-N
    type: AI生成
    title: <source title, e.g. TGA官网 BPC-157 Schedule 4公告>
    url: <url>
    excerpt: <verbatim 1-2 sentences from the source, max 200 chars>
new-terms: [<any new technical/regulatory terms introduced>]
---END-HANDOFF---
```

> Never write KB section HTML directly from this skill. **宏观背景数据**（行业大盘、政策环境等）只作为 `new-sources` 登记到附录 A，不写入任何 slot 的 findings 中。

## Important Notes

- Always record the source URL or reference — every finding must be traceable.
- For cross-border projects, search BOTH jurisdictions (e.g., a Chinese company buying in Australia — search ASIC and 天眼查).
- Do NOT present raw search results as conclusions — they are inputs for structuring (L1).
- When a government portal shows a project status, capture the exact status label and date.
- Comparable transaction data is often behind paywalls — note what is available vs. what requires paid access.
- Respect data privacy — do not attempt to access non-public personal information.


## 持续学习（Self-Evolution）

每次开始任务时，先读取 `knowledge/` 文件夹中已有的学习记录；每次完成任务后，把新学到的内容追加进去。

触发记录的条件：
- 遇到当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得重用的成功经验或模式
- 原有指令出现歧义或冲突

若认为核心指令需要改进，请主动告知用户并说明原因。
