---
name: project-intake
description: "Automatically diagnose a new project's information maturity, identify which Project Knowledge Base sections are actionable, and seed v1 of the KB. Use when a new investment opportunity arrives at the platform — whether it's just a name, a forwarded PDF, or a full data room. Triggers on \"new project\", \"项目入驻\", \"look at this deal\", \"someone sent me a project\", \"add project\", \"看下这个项目\", or AUTOMATICALLY when a user uploads files to a project folder without prior context."
---

# Project Intake & Maturity Diagnosis

> **v2.8 KB 交叉引用（写入 KB 时必读）**
> - 结构：`../knowledge-base-generation/references/kb-schema.md`（11 canonical slots）
> - 配置：`../knowledge-base-generation/references/kb-config.md`（KB-CONFIG、display-order、project-type）
> - Slot 规则：`../knowledge-base-generation/references/slot-specific-rules.md`
> - 模板：`../knowledge-base-generation/assets/kb-template.html`（**非**根目录 `kb-template.html`）

## Auto-trigger Conditions

This skill should fire **automatically without explicit user request** whenever:

1. A new project folder appears and contains one or more documents.
2. A user uploads files to an existing project folder and no `[AI] <项目名>_知识网络.html` exists yet.
3. A user opens a project folder in Cowork and says anything that implies "this is a new deal" ("帮我看下"、"有个新项目"、"这个怎么样").

When auto-triggered, do not wait for the user to instruct further — proceed through Steps 1–7 and produce v1 of the Project Knowledge Base before pausing for input.

## Workflow

### Step 1: Collect Initial Input

Determine what the user has provided. It may be any combination of:
- **Just a project name** (e.g., "Stone Island", "南宁生鲜智慧港")
- **A brief verbal description** (e.g., "有个澳洲的岛要卖")
- **One or more files** (PDF, Word, Excel, images) — read every one of them
- **A forwarded email or message**
- **A link to a listing or government portal**

Do NOT ask the user to fill out a form. Accept whatever they give and work from there.

**File reading is mandatory.** If files are present, open and read each file's content (PDF text extraction, Word, Excel sheets) before moving to Step 2. Sector identification and maturity scoring depend on what's actually in the documents, not just filenames.

### Step 2: Sector Identification + Project Scope Determination

#### Step 2.1: Project Type Identification

Identify the project type. The type code is written to KB-CONFIG and drives the default display order for this project's Knowledge Base.

| Type code | 项目类型 | 关键信号 | 核心分析逻辑 |
|-----------|---------|---------|------------|
| `real-estate-dev` | 房地产·开发类 | DA, zoning, FSR, GFA, construction, 在建, 开发 | 审批 + 建设时间线 + 资本支出 |
| `real-estate-income` | 房地产·持有/收益类 | 租金, occupancy, WALE, cap rate, 已运营 | 租金收益 + 估值倍数 |
| `energy-operating` | 能源/基础设施·运营类 | 已并网, operational, PPA, dispatch history, revenue | 收入合同 + 历史发电数据 |
| `energy-dev` | 能源/基础设施·开发类 | BESS, solar, wind, MW/MWh, AEMO, LFP, 构网型逆变器, DA pending | 审批路径 + 并网节点，无运营历史 |
| `biotech` | 生物科技/生物合成 | fermentation, synthetic biology, GMP, FDA, clinical trial, IP | IP/技术平台 + 监管路径 |
| `technology` | 科技/SaaS | SaaS, ARR, NRR, CAC, platform, API, Series A/B/C | 产品 + SaaS 指标 |
| `trade-commodities` | 贸易/大宗商品 | supply chain, cold chain, import/export, logistics, quota, 配额, 牌照 | 关系网络 + 牌照资质 + 单位利润 |
| `hospitality` | 酒店/旅游/度假 | resort, hotel, ADR, RevPAR, occupancy, island, eco-tourism | 物业资产 + 运营指标 |

**区分 real-estate-dev vs real-estate-income**：项目是否已稳定运营并有租金/收益历史——有则 income，无或在建则 dev。
**区分 energy-operating vs energy-dev**：是否已商业运营并网——是则 operating，否则 dev。

If type is ambiguous after reading available materials, ask the specific distinguishing question (e.g., "项目目前是已并网运营还是仍在开发阶段？"). Do not present the full 8-type menu.

#### Step 2.2: Jurisdiction (triggers bilingual KB)

Identify the deal's primary jurisdiction. If jurisdiction is **non-China** (overseas), set the KB to bilingual mode (zh + en with language toggle) — see `../knowledge-base-generation/references/style-guide-v2.7.md` "Bilingual Knowledge Base". For domestic Chinese deals (jurisdiction = China mainland), Chinese-only KB.

Cross-border deals where the target is overseas but the buyer is Chinese: treat as overseas → bilingual.

#### Step 2.3: Project scope and naming

> **Critical rule**: the project name must represent the **whole investment package**, not just the most-documented sub-asset. A deal to buy a portfolio of two BESS sites is "澳大利亚 BESS 包" or "Wollar + Moorabool BESS Portfolio" — **never** just "Wollar" even if Wollar has 80% of the available data and Moorabool has 5%. Naming after one sub-asset hides the existence of the others and corrupts every downstream analysis.

Determine:

| Question | Why it matters |
|---------|----------------|
| How many distinct sub-assets / targets does this deal contain? | Decides whether multi-asset rendering rules apply |
| Are the sub-assets bought as a package or independently? | Package = single KB with per-asset partitioning; independent = separate projects |
| Do the sub-assets share counterparty, deal structure, and timing? | If yes, definitely one project |
| What is the deal-level package name (not asset name)? | This is the project name written to the KB header and file name |

Examples of correct vs. incorrect project naming:

| Situation | ❌ Wrong | ✅ Correct |
|-----------|----------|------------|
| Acquiring 2 BESS sites (Wollar + Moorabool) as one deal | Wollar BESS | 澳大利亚 BESS 包 (Wollar + Moorabool) |
| 3-tower mixed-use development | Tower A | XYZ 城中综合体（3栋）|
| Land bank of 4 adjacent parcels | Lot 12 Acquisition | Bakehouse Quarter 4-parcel 收储 |
| Platform acquisition with 5 operating units | (Largest unit name) | XYZ Platform (5-unit) |

If the user has already given a single-asset name, ask: "这个交易里只有 X 这一个标的，还是包含其他资产？"

#### Step 2.4: Multi-asset detection

A project is multi-asset if Step 2.3 identifies ≥ 2 distinct sub-assets sharing one deal vehicle. If so:
- List every sub-asset with a short id (the asset id is reused across the whole KB).
- For each sub-asset, note: location / scale / current state / data availability.
- Set the KB to multi-asset rendering mode (see `../knowledge-base-generation/references/style-guide-v2.7.md` "Multi-Asset Project Rendering").
- Factor A scoring in Step 3 will be per-asset per-section, then averaged.

#### Step 2.5: KB-CONFIG Determination

Based on Steps 2.1–2.4, determine the KB-CONFIG values to pass to `knowledge-base-generation`:

| Field | Value | Source |
|-------|-------|--------|
| `project-type` | 8 类类型码 | Step 2.1 |
| `rendering-mode` | `bilingual` (海外项目) / `chinese-only` (国内项目) | Step 2.2 |
| `multi-asset` | `true` / `false` | Step 2.4 |
| `display-order` | 该类型的默认展示顺序（见下表） | Step 2.1 |

**各类型默认展示顺序**：

| Type code | 默认 display-order | 设计逻辑 |
|-----------|-------------------|---------|
| `real-estate-dev` | snapshot, assets, legal-relationships, capital-structure, timeline, business-model, comps, returns, risks, open-questions, decision-framework | 先确认能建什么、审批状态、资本需求和时间线，再谈收益 |
| `real-estate-income` | snapshot, assets, business-model, comps, legal-relationships, capital-structure, returns, timeline, risks, open-questions, decision-framework | 租金/出租率是估值基础，先看经营再看结构 |
| `energy-operating` | snapshot, assets, business-model, comps, returns, capital-structure, legal-relationships, timeline, risks, open-questions, decision-framework | 收入合同和历史数据决定价值，法律结构是后置确认项 |
| `energy-dev` | snapshot, assets, legal-relationships, timeline, capital-structure, business-model, comps, returns, risks, open-questions, decision-framework | 审批状态和里程碑是最大不确定性，前置 |
| `biotech` | snapshot, assets, legal-relationships, business-model, capital-structure, comps, returns, timeline, risks, open-questions, decision-framework | IP 归属和监管路径决定项目存活，商业模式次之 |
| `technology` | snapshot, assets, business-model, comps, capital-structure, returns, legal-relationships, timeline, risks, open-questions, decision-framework | 产品 + SaaS 指标是估值核心，法律结构靠后 |
| `trade-commodities` | snapshot, assets, legal-relationships, business-model, comps, capital-structure, returns, timeline, risks, open-questions, decision-framework | 牌照/配额/关系是核心护城河，前置法律结构 |
| `hospitality` | snapshot, assets, business-model, legal-relationships, comps, capital-structure, returns, timeline, risks, open-questions, decision-framework | 物业条件 + 运营指标定价值，再看产权和管理合同 |

将以上字段作为 KB-CONFIG 参数随交接块一并传递给 `knowledge-base-generation`，由其在新建 KB 时写入 `<!-- KB-CONFIG -->` 注释块。

### Step 3: Maturity Diagnosis (two-factor model)

> **Critical**: maturity is NOT just "how much information is present" — it is **information × source diversity**. A single beautifully-formatted internal analyst summary can look 80% complete on content but score Low on diversity, because it has only one source and one perspective. Real maturity requires triangulation across counterparties.

#### Factor A — Content Completeness (11 KB sections)

Score 0–100% for each of the 11 Project Knowledge Base sections. Apply the **hard-evidence rule**: a section is not "present" just because the topic is mentioned; it must contain specific facts with figures, dates, names, or documents attached.

> **Conceptual rule**: distinguish 四 (target company's revenue model) from 七 (investor's expected returns). A CIM saying "项目预计 IRR 18%" populates 七, NOT 四. A CIM listing "主要租户和单平米租金" populates 四, NOT 七. Cross-confusion is a common scoring error.

| KB Section | What counts as "present" (hard evidence) | Hard rules |
|-----------|------------------------------------------|------------|
| 一 项目快照 | Name, location, counterparty entity, indicative price/range, current stage | If no indicative price stated → cap at 40% |
| 二 资产构成 | Physical assets enumerated, area/scale figures, current condition, approval status | Generic descriptions without numbers → cap at 30% |
| 三 法律结构与关键关系网 | Holding entity name, equity %, legal advisors named, related-party map | "Entity TBD" or "shareholders to be confirmed" → cap at 20% |
| 四 业务模式与收入假设 | Target company's revenue line items, unit economics, customer/tenant base, pricing model | No specific unit prices or customer names → cap at 30%. Investor-return language (IRR, MOIC) does NOT count here — it goes to 七 |
| 五 融资结构与资本结构 | **Total investment amount, equity vs debt split, funding sources, capital sources timing** | **If no specific investment amount stated → score ≤ 5%, NOT 55%. "需要融资" is not capital structure.** |
| 六 市场对标与可比交易 | Named comparable transactions with prices/multiples; market data with source | "Market is hot" without comps → 0% |
| 七 投资回报与敏感性分析 | **Quantified IRR / MOIC / Cash-on-Cash / Payback for at least one scenario; explicit assumptions; sensitivity** | **If no specific investment amount AND no quantified return projections → score ≤ 5%, NOT 55%. A CIM phrase "高回报" with no numbers contributes 0%.** "Expected IRR 18%" with no underlying model contributes ≤ 20%. |
| 八 项目时间轴 | Dated past milestones, current status, dated future catalysts | Vague phases without dates → cap at 25% |
| 九 关键风险与缓释 | Identified specific risks with likelihood/impact + mitigation actions | Generic "market risk" lists → cap at 15% |
| 十 待确认问题清单 | Explicit open questions tracked, owners assigned | (Score reflects how well-tracked the open items are) |
| 十一 决策框架 | Explicit recommendation + value-add levers + option analysis | No quantified scenarios in 七 → 十一 cannot exceed 20% |

#### Factor B — Source Diversity

Score 0–100% based on the variety of independent perspectives in the available materials.

| Diversity tier | Description | Score range |
|---------------|-------------|-------------|
| **Single internal source** | Only one document, or multiple documents all authored by the same party (e.g., user's own analyst summary, or only the seller's CIM) | 0–25% |
| **Two-party** | At least one seller-side document AND one buyer-side / analyst document, OR seller + one independent source | 25–50% |
| **Multi-party** | ≥3 distinct sources spanning seller, buyer, advisors, government records, news | 50–75% |
| **Triangulated** | All major claims cross-confirmed across ≥3 independent sources; includes professional third-party reports (Big-4 audit, Tier-1 legal, JLL/CBRE valuation, etc.) | 75–100% |

**Source-counting rules:**
- Count *authoring parties*, not file count. Ten PDFs from the same broker = one source.
- Self-generated summaries (家族办公室内部分析) count as one source, even if they cite many internal sub-documents — because nothing has been independently verified.
- Government registry extracts, court records, regulator publications each count as independent sources.
- Press articles count as one source per outlet, with a cap of three press sources contributing to diversity.

#### Multi-asset Factor A computation

If the project is multi-asset (Step 2.4), Factor A is computed per asset per section, then averaged:

```
section_score = mean(per-asset scores for that section)
Factor A      = mean(section scores)
```

The intake report and the KB header must surface the **per-asset breakdown** alongside the average — never collapse multi-asset maturity into a single number, because the asymmetry IS the most important diagnostic signal:

```
Factor A: 35%   ← deal average
├── Wollar:    62%
└── Moorabool:  8%
```

Without this breakdown a reader assumes "Early stage across the board" when the truth is "Wollar is Mid-stage, Moorabool is Bare-lead". The asymmetry tells the user exactly where to direct the next dollar of diligence effort.

#### Combined Maturity & Entry State

```
Overall maturity = 0.6 × (mean of 11 section completeness scores) + 0.4 × source diversity
```

| Entry State | Overall maturity | Recommended next step | Platform action |
|-------------|-----------------|----------------------|-----------------|
| **Bare lead** | < 15% | Information search | Auto-trigger `public-info-search` + `gap-tracking`; render KB with mostly 缺乏资料 callouts |
| **Early stage** | 15–40% | Source diversification + structuring | Supplement search + `knowledge-base-generation`; flag missing source types explicitly |
| **Mid stage** | 40–65% | Critical audit | `knowledge-base-generation` + `dd-claim-audit`; rebalance scores after audit |
| **Mature** | 65%+ | Risk, valuation, decision | `risk-matrix` + `comp-analysis`; consider `/valuation` and `/ic-memo` |

> **Warning behavior**: If Factor A is high (≥ 60%) but Factor B is low (< 30%) — i.e. "looks complete but only one perspective" — DO NOT label this as Mid/Mature. Cap the entry state at **Early stage** and explicitly flag in the chat response: "信息看似完整但来源单一，建议补充[卖方/独立第三方/政府记录]资料后再升级评估。"

### Step 4: Seed Project Knowledge Base (v1)

Immediately invoke `knowledge-base-generation` (handoff, in the same turn) to create `[AI] <项目名>_知识网络.html` (note `[AI]` prefix — distinguishes from human-uploaded files) with:
- **KB-CONFIG block** (Step 2.5 values) written to `<body>` opening — this is mandatory for all downstream display-order operations
- All 11 sections rendered in the Step 2.5 default display-order for this project type, populated where evidence exists, otherwise 缺乏资料 callouts
- **Multi-asset mode** if Step 2.4 detected ≥ 2 sub-assets: every asset-specific section partitions per asset with its own 缺乏资料 callout when data is missing for that specific asset
- **Bilingual mode** if Step 2.2 detected overseas jurisdiction: zh + en parallel content + language toggle button
- 附录 A (来源索引) listing every file/URL processed, tagged 📄 user-uploaded vs 🤖 AI-generated
- 附录 B (术语表) seeded with technical terms encountered (delegated to `term-annotator`), bilingual entries in bilingual mode
- Header showing overall maturity %, Factor A %, Factor B %, source count, AI-generated badge

### Step 5: Generate Intake Diagnosis (chat-only)

Return to the user in chat:

1. **Project header**: Project **package name** (per Step 2.3 — never just one sub-asset), sector, jurisdiction (zh-only / bilingual mode), counterparty (if known)
2. **Sub-asset roster** (multi-asset only): list each sub-asset with location + scale + one-line current state + data availability flag
3. **Two-factor maturity scorecard**: A% / B% / Overall%
4. **Per-section heatmap**: All 11 sections with their completeness scores
5. **Per-asset breakdown** (multi-asset only): each sub-asset's Factor A; flag any asset with < 20% as "数据严重失衡，需优先补足"
6. **Source diversity snapshot**: Source-type breakdown (e.g., "1 卖方 CIM, 0 第三方报告, 0 政府记录")
7. **Entry state determination**: Which state, why, and any source-diversity downgrade applied
8. **Immediate next steps**: Specific, actionable
9. **Material request prompts**: What to upload or who to ask, prioritized by impact on maturity AND by which sub-asset is most starved of data

### Step 6: Guided Questions

If overall maturity is below 40% OR source diversity is below 30%, ask up to 4 targeted questions. Questions should be sector-aware and source-aware:

**Source-diversity questions (any type):**
- "目前的资料是否都来自[卖方/内部分析师]？是否有第三方机构（律所、会计师、估值师）出具的报告？"
- "卖方对外报价或 indicative pricing 是否有书面记录？"

**real-estate-dev / real-estate-income:**
- "这是一个收购项目还是合作开发项目？"
- "目前处于什么阶段——拿地/在建/已建成运营？"（用于确认 dev vs income）
- "是否涉及外资审批（如 FIRB）？"

**energy-operating / energy-dev:**
- "项目是否已商业运营并网？"（用于确认 operating vs dev）
- "并网审批走到什么阶段了？"
- "是否已有 PPA 或类似收入合同？"

**trade-commodities:**
- "核心竞争力是牌照/配额/政府关系，还是物流基础设施？"
- "用地性质是什么（工业/商业/综合）？"

**biotech / technology:**
- "IP 归属方是目标公司还是创始团队个人？"
- "目前有没有商业化收入，还是纯研发阶段？"

**hospitality:**
- "酒店/度假村目前是自营还是委托管理（管理合同）？"
- "是否有历史运营数据（ADR/RevPAR）？"

### Step 7: Handoff to Downstream Skills

Based on entry state, automatically queue (do not require user confirmation):
- **Bare lead** → `public-info-search` + `gap-tracking`
- **Early stage** → `public-info-search` + `knowledge-base-generation` + `gap-tracking`
- **Mid stage** → `knowledge-base-generation` + `dd-claim-audit` + `risk-matrix`
- **Mature** → `risk-matrix` + `comp-analysis` (suggest `/valuation` and `/ic-memo` to user)

If multiple files were uploaded, also invoke `document-reorganize` in parallel during Step 4.

## Output Format

- **Chat**: Markdown — intake diagnosis with two-factor scorecard, section heatmap, source breakdown, next steps
- **KB update**: Section 一 (项目快照) populated; all 10 other sections rendered (data or 缺乏资料 callout); header carries maturity scores; changelog v1.0 entry added
- **No standalone "intake report"** — the intake diagnosis lives in chat; the KB is the persistent artifact
- All output conforms to `../knowledge-base-generation/references/style-guide-v2.7.md`

## Important Notes

- Never force users into a form. Accept unstructured input and extract what you can.
- The KB is a living document — it updates as new information arrives. Every subsequent skill call must update the KB.
- Always err on the side of starting work (even partial) rather than blocking on missing info.
- For cross-border projects, flag jurisdiction early — it affects every downstream analysis.
- Source diversity is the single most-overlooked factor. A high content-completeness score from a single source can mislead the IC. **Always show A% and B% separately, never just a single blended number.**
- When files are uploaded, immediately trigger `document-reorganize` in parallel.
- When technical terms appear in the source materials (e.g., 构网型逆变器, LFP, AEMO, DA, FIRB), do not silently include them in the KB — delegate to `term-annotator` so they receive footnote definitions.
- **Project naming is a one-time decision with permanent downstream consequences**. If unsure between single-asset and multi-asset, ask once before generating the KB — re-naming later requires re-renumbering every per-asset reference. Default to multi-asset when in doubt: a single-asset deal can always be rendered without partitioning, but a multi-asset deal mis-rendered as single-asset hides material information.
- **Asymmetric multi-asset data is the rule, not the exception** in opportunistic investing. One asset is always more documented than the others. The plugin must surface this asymmetry loudly, not paper over it. Every section, every callout, every chat response must distinguish "we have data for asset X" from "we have data for the deal".


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
