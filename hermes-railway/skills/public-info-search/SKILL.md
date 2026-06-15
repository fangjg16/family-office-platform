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
- **Relevance**: Direct (about **this project/target/counterparty/asset**) vs. contextual (about the market/area/industry)
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
- **KB update**: writes to Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html` via `knowledge-base-generation` handoff (this skill does **not** edit HTML directly):
  - 一 项目快照 · 二 资产构成 · 三 法律结构 · 四 业务模式 · 五 融资结构 · **八 项目时间轴（仅 eligible 项目事件）**
- **Section routing** (default — **not** “everything with a date → timeline”):

| Finding type | Target slot(s) | timeline? |
|---|---|---|
| Regulatory approval **on this project/asset** | `assets`, `legal-relationships` | Only if dated **project** action (permit granted, hearing held, filing submitted) |
| Corporate registry **of target/counterparty** | `legal-relationships`, `snapshot` | Rarely — only entity events tied to **this deal** (e.g. ownership change affecting transaction) |
| Land/title **of project asset** | `assets`, `legal-relationships` | Only project-specific encumbrance/closing events |
| Market data, industry stats, pricing windows | `comps`, `business-model` | **No** — never default to timeline |
| Comparable transactions | `comps` (+ handoff to `comp-analysis`) | **No** |
| Policy / regulation (generic background) | `risks`, `decision-framework`, Appendix A | **No**, unless creates **this project's** filing deadline or approval path |
| News & sentiment | `risks`, `decision-framework`, `snapshot` (if about **target**) | **No** for industry/platform/sector news |

- **宏观背景**（行业大盘、技术趋势、口岸概况、区域政策环境）**不得**写入 `timeline`。处理：① 支撑 `business-model` / `comps` 表格内联引用；② 投资论点层面 → `decision-framework`；③ 监管/宏观风险 → `risks`；④ 仅备查 → Appendix A `new-sources`。
- **不写 七 投资回报**: 投资人 IRR / MOIC 是 returns-analysis 的产物, 不是公开信息搜集的结果。
## KB Handoff (mandatory — do not skip)

This skill does **not** write HTML or edit the KB file directly. After Step 4, output the following Handoff Block in the chat response, then invoke `knowledge-base-generation` to render it. Omit any slot key that has no new findings.

**Target slots** (subset, based on what was found): `snapshot`, `assets`, `legal-relationships`, `business-model`, `capital-structure`, `comps`, `risks`, `decision-framework`, `timeline` (**only when ≥1 handoff item has `timelineEligible: true`**)

**Timeline eligibility (mandatory for every dated finding):**

Before adding a `timeline` block, classify each candidate:

```yaml
scope: project | target | counterparty | asset | regulator | market | industry | internal | data
timelineEligible: true | false
reason: <one sentence>
```

- **Include `timeline` in `target-slots` only if at least one item has `timelineEligible: true`.**
- Category 4 Market Data, Category 6 generic policy, Category 7 industry/platform news → `timelineEligible: false` → route to `comps`, `business-model`, `risks`, `decision-framework`, or `new-sources`.
- Category 7 with **direct** relevance to **this project/target/counterparty** (e.g. DA approved for **this** site, FIRB filing for **this** buyer) → may be `timelineEligible: true` with `scope: regulator` or `project`.

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
  comps:                       # market data, comparables — never timeline
    - item: <comparable or dataset>
      signal: <price/multiple/volume>
      limitation: <why not identical to this project>
      certainty: ...
      source: [...]
  risks:                       # macro/policy/industry risk context
    - scenario: <concrete failure mode>
      evidence: <...>
      certainty: ...
      source: [...]
  decision-framework:          # macro thesis support
    - thesis: <argument>
      evidence: <...>
      certainty: ...
      source: [...]
  timeline:                    # ONLY items with timelineEligible: true — omit entire key if none
    - date: <YYYY-MM-DD or YYYY-MM or 待定>
      scope: project | target | counterparty | asset | regulator
      timelineEligible: true
      reason: <why this is a project execution node, not industry background>
      block: 已发生 | 正在推进 | 未来关键节点
      event: <project-specific description>
      controller: <who controls next step>
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

> Never write KB section HTML directly from this skill. **宏观/行业/市场背景** 写入 `comps`, `business-model`, `risks`, `decision-framework`, or `new-sources` — **not** `timeline` unless `timelineEligible: true` with explicit project/target link.

## Important Notes

- Always record the source URL or reference — every finding must be traceable.
- For cross-border projects, search BOTH jurisdictions (e.g., a Chinese company buying in Australia — search ASIC and 天眼查).
- Do NOT present raw search results as conclusions — they are inputs for structuring (L1).
- When a government portal shows a project status, capture the exact status label and date.
- Comparable transaction data is often behind paywalls — note what is available vs. what requires paid access.
- Respect data privacy — do not attempt to access non-public personal information.


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
