---
name: project-intake
description: "Automatically diagnose a new project's information maturity, identify which Project Knowledge Base sections are actionable, and seed v1 of the KB. Use when a new investment opportunity arrives at the platform — whether it's just a name, a forwarded PDF, or a full data room. Triggers on \"new project\", \"项目入驻\", \"look at this deal\", \"someone sent me a project\", \"add project\", \"看下这个项目\", or AUTOMATICALLY when a user uploads files to a project folder without prior context."
---

# Project Intake & Maturity Diagnosis

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

#### Step 2.1: Sector

Identify the project's sector from available context:

| Sector | Signals |
|--------|---------|
| **Real Estate** | Land, property, development, DA, zoning, FSR, GFA, residential, commercial, industrial park |
| **Energy / Infrastructure** | BESS, solar, wind, grid, MW/MWh, AEMO, pipeline, transmission, LFP, 构网型逆变器 |
| **Biosynthetics / Biotech** | Fermentation, synthetic biology, feedstock, GMP, FDA, clinical trial |
| **Technology** | SaaS, ARR, platform, API, user base, Series A/B/C |
| **Trade / Commodities** | Supply chain, cold chain, import/export, commodity, logistics, warehouse |
| **Hospitality / Tourism** | Resort, hotel, ADR, RevPAR, occupancy, island, eco-tourism |

If sector is ambiguous, ask one targeted question — do not present a menu.

#### Step 2.2: Jurisdiction (triggers bilingual KB)

Identify the deal's primary jurisdiction. If jurisdiction is **non-China** (overseas), set the KB to bilingual mode (zh + en with language toggle) — see `STYLE_GUIDE.md` "Bilingual Knowledge Base". For domestic Chinese deals (jurisdiction = China mainland), Chinese-only KB.

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
- Set the KB to multi-asset rendering mode (see `STYLE_GUIDE.md` "Multi-Asset Project Rendering").
- Factor A scoring in Step 3 will be per-asset per-section, then averaged.

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

Immediately invoke `knowledge-base-generation` (handoff, in the same turn) to create or refresh `[AI] <项目名>_知识网络.html` (note `[AI]` prefix — distinguishes from human-uploaded files) with:
- All 11 sections rendered, populated where evidence exists, otherwise filled with 缺乏资料 callouts
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

**Source-diversity questions (any sector):**
- "目前的资料是否都来自[卖方/内部分析师]？是否有第三方机构（律所、会计师、估值师）出具的报告？"
- "卖方对外报价或 indicative pricing 是否有书面记录？"

**Real Estate examples:**
- "这是一个收购项目还是合作开发项目？"
- "目前处于什么阶段——拿地/在建/已建成运营？"
- "是否涉及外资审批（如 FIRB）？"

**Energy examples:**
- "项目是已建成运营还是开发阶段？"
- "并网审批走到什么阶段了？"
- "是出售方还是买方的角色？"

**Trade / Industrial Park examples:**
- "目前招商签约率大概是多少？"
- "用地性质是什么（工业/商业/综合）？"

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
- All output conforms to `STYLE_GUIDE.md`

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


## 持续学习（Self-Evolution）

每次开始任务时，先读取 `knowledge/` 文件夹中已有的学习记录；每次完成任务后，把新学到的内容追加进去。

触发记录的条件：
- 遇到当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得重用的成功经验或模式
- 原有指令出现歧义或冲突

若认为核心指令需要改进，请主动告知用户并说明原因。
