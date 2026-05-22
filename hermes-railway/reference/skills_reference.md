# 合域 AI · Opportunistic Investments Plugin
# Skills Reference Manual (16 Skills + Style Guide)

> **v0.4 — UX & multi-asset upgrade** (this version):
> 1. All AI-generated files carry `[AI]` filename prefix + KB header AI badge
> 2. Overseas projects render KB bilingually (zh + en with toggle button)
> 3. Citations `[U-7]`/`[A-3]` and term refs `*` are tooltip-enabled — hover for preview, click to jump
> 4. Timeline merged into one chronological table (event types tagged in fixed column, multi-asset filter buttons)
> 5. Multi-asset projects render per-asset subsections; missing data per asset is explicitly flagged instead of silently omitted; project name represents the whole deal package, never just one sub-asset

> **v0.3 (carried forward)**: 11 KB sections with 四 (target business model) separated from 七 (investor returns).

> **v0.2 architecture (carried forward)**: One Project Knowledge Base HTML per project, every non-IC skill writes through it, only `ic-memo` produces a separate Word document.

## Output Architecture

### One project = one knowledge base

```
<project-folder>/
├── <用户上传的原始文件 — no prefix>
├── [AI] <项目名>_知识网络.html      ← maintained by every non-ic-memo skill
├── [AI] IC备忘录_<项目名>_<日期>.docx  ← only produced by /ic-memo
└── [AI] IC Memo_<Project>_<Date>.docx   ← bilingual mode also produces English version
```

`[AI]` prefix universal; KB header carries 🤖 AI 生成 badge; 附录 A · 来源索引 tags each entry 📄 用户上传 or 🤖 AI 生成 with source IDs `U-N` / `A-N`.

### The 11 mandatory sections

| # | Section | Primary writer skills |
|---|---------|----------------------|
| 一 | 项目快照 | `project-intake`, `public-info-search` |
| 二 | 资产构成（投资标的剖析、规划审批状态） | `public-info-search`, `dd-claim-audit` |
| 三 | 法律结构与关键关系网 | `background-check`, `public-info-search` |
| 四 | 业务模式与收入假设 (target company) | `public-info-search` |
| 五 | 融资结构与资本结构 | `public-info-search` |
| 六 | 市场对标与可比交易 | `comp-analysis` |
| 七 | 投资回报与敏感性分析 (investor returns) | `returns-analysis`, `sensitivity-analysis` |
| 八 | 项目时间轴 (unified chronological table) | `node-monitoring`, `public-info-search` |
| 九 | 关键风险与缓释 | `risk-matrix`, `dd-claim-audit` |
| 十 | 待确认问题清单 | `gap-tracking`, `dd-checklist` |
| 十一 | 决策框架 | `value-creation-plan` + analyst synthesis |

Plus 附录 A · 来源索引 (`document-reorganize`) and 附录 B · 术语表 (`term-annotator`).

### Rendering modes (set at project-intake, persist for KB life)

| Mode | Trigger | Affected sections |
|------|---------|-------------------|
| Multi-asset | ≥2 sub-assets detected | 二/三/四/五/七/八/九 partition per asset with explicit per-asset 缺乏资料 callouts |
| Bilingual | Jurisdiction = overseas | zh + en parallel content blocks + language toggle button in header |

### Skill → KB section mapping (reverse view)

| Skill | KB Section(s) updated |
|-------|----------------------|
| `project-intake` | 一 (+ 全 KB scaffold + rendering modes) |
| `document-reorganize` | 附录 A (with U/A authorship + tooltip excerpts) |
| `public-info-search` | 一/二/三/四/五/八 — **不写 七 (returns)** |
| `knowledge-base-generation` | 全 KB (central writer; owns multi-asset and bilingual rendering) |
| `comp-analysis` | 六 |
| `dd-checklist` | 十 |
| `dd-claim-audit` | 全 KB certainty tags + 九 + 十 |
| `background-check` | 三 (+ 九 if risks surface) |
| `risk-matrix` | 九 |
| `returns-analysis` | 七 (+ 五 仅投资人侧资金需求) |
| `sensitivity-analysis` | 七 (+ 九 if hyper-sensitive) |
| `value-creation-plan` | 十一 |
| `gap-tracking` | 十 |
| `node-monitoring` | 八 (rows into the unified timeline table — no separate sub-blocks) |
| `term-annotator` | 附录 B + tooltip-enabled `*` markers in body (asterisks replace legacy ¹³ numbers) |
| `ic-memo` | **不写入 KB** — 输出独立 `.docx` (bilingual mode produces both zh and en files) |

### Auto-trigger & continuous-update model

1. **新项目入驻**: 用户上传文件到项目文件夹 → `project-intake` 自动浏览全部文件 + 检测多标的 + 检测海外 → 同回合内调用 `knowledge-base-generation` 生成 `[AI] <项目名>_知识网络.html` v1.0 (按 mode 渲染)
2. **后续对话**: 用户提问或主动告知新信息 → agent 自动分类到对应 KB 章节 / 子标的 → 触发相关 skill → KB 章节自动更新 (版本号 +1, changelog 记录)
3. **缺乏资料引导**: 任何无证据的章节 / 子标的都显式 render 为 `缺乏资料` callout，并给出具体的补充建议
4. **术语注脚**: 任何专有名词自动获得 tooltip-enabled `*` 标记，定义统一归集到 附录 B (bilingual mode 下双语)

All HTML conforms to `STYLE_GUIDE.md`.

---


## ═══ 一 项目入驻 ═══

---

### 📂 skills/project-intake/

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

---

### 📂 skills/document-reorganize/

# Document Reorganize

## Workflow

### Step 1: Inventory All Project Files (user-uploaded AND AI-generated)

List **every** file associated with the project, including both user-uploaded inputs and prior AI-generated outputs.

For each file, extract:
- Filename and format (PDF, DOCX, XLSX, PPTX, image, HTML)
- File size and page count
- Language (Chinese / English / bilingual)
- Upload date (for user files) or generation date (for AI files)
- **Authorship**: `📄 用户上传` (user-uploaded) or `🤖 AI 生成` (AI-generated, including the KB itself, prior IC memos, scraped public-info-search results)

The authorship is determined by:
- Files with `[AI]` filename prefix → AI-generated
- Files whose authorship is in the project's prior AI-output ledger → AI-generated
- Everything else → User-uploaded

Always preserve the distinction. AI-generated files should not be treated as primary evidence for new claims — they are syntheses, and citing them creates risk of circular reasoning.

### Step 2: Document Classification

Classify each document into one of the following categories. Classification is sector-aware:

**Universal Categories (all sectors):**

| Category | Description | Examples |
|----------|-------------|----------|
| **Pitch / IM** | Seller or sponsor marketing materials | 推介书, Information Memorandum, Teaser, 招商手册 |
| **Financial** | Financial models, projections, historical accounts | 投资测算表, Cash flow model, P&L, Balance sheet |
| **Legal** | Contracts, agreements, corporate documents | 合作协议, Sale contract, JV agreement, 股权结构 |
| **Regulatory / Approval** | Government permits, approvals, applications | DA批文, 规划许可证, Environmental assessment |
| **Technical / Design** | Engineering, architectural, or technical reports | 设计方案, Master Plan, 可研报告, Feasibility study |
| **Market Research** | Market studies, competitive analysis, industry data | 市场调研报告, Comparable sales, Industry report |
| **Valuation** | Independent valuations, appraisals | 估价报告, Valuation report, 资产评估 |
| **Meeting / Correspondence** | Minutes, emails, memos | 会议纪要, Email chain, Progress meeting notes |
| **Due Diligence** | DD reports, checklists, findings | 尽调报告, Title search, Environmental audit |
| **Media / Visual** | Photos, renderings, drone footage, maps | 效果图, Site photos, 航拍, Location map |
| **Internal Analysis** | Team's own analysis, notes, knowledge networks | 项目知识网络, 分析报告, Internal memo |
| **Other / Unclassified** | Doesn't fit above categories | Flag for manual review |

**Sector-Specific Additions:**

| Sector | Additional Categories |
|--------|----------------------|
| **Real Estate** | Heritage assessment (CMP), Planning instrument (LEP/SEPP/DCP), Strata plan, Survey |
| **Energy** | Grid connection (GPS), AEMO registration, Equipment spec, PPA/offtake |
| **Biosynthetics** | Patent filings, Clinical data, Regulatory submission (FDA/EMA), Lab results |
| **Technology** | Technical architecture, SOC2/security audit, Product roadmap, User metrics |
| **Trade** | Import/export licenses, Customs documentation, Quality certificates, 动检证 |

### Step 3: Metadata Extraction + Source ID Assignment

For each document, extract structured metadata AND assign a unique source ID:
- **Source ID**: `U-N` (sequential, for user-uploaded) or `A-N` (sequential, for AI-generated). These IDs are referenced everywhere in the KB as `[U-7]` / `[A-3]` inline citations.
- **Title**: Actual document title (not filename)
- **Author / Source**: Who created it (seller, advisor, government, internal, AI)
- **Date**: Document date (not upload date)
- **Version**: If identifiable
- **Key entities mentioned**: Companies, people, locations, amounts
- **Relevance to KB sections**: Which of the 11 KB sections does this document inform?
- **Tooltip excerpts**: For each KB section this document informs, extract a 1–2 sentence representative excerpt (max ~200 chars). These excerpts power the hover tooltips on citations in the KB body — without them, citations are unverifiable without leaving the document.

If a single document informs multiple sections, extract a separate tooltip excerpt for each section it informs.

### Step 4: Relationship Mapping

Identify relationships between documents:
- Documents that reference each other
- Documents that cover the same topic from different sources (potential for cross-verification in `dd-claim-audit`)
- Superseded versions (mark older versions clearly)
- Documents that are attachments/appendices to another document

### Step 5: Gap Identification

Compare the document inventory against the expected document set for the project's sector and stage:
- What document types are present ✅
- What document types are missing but expected ⚪
- What document types would be valuable but optional 🔵

Feed gaps into `gap-tracking`.

### Step 6: Output — Project File Index

Generate a structured file index (rendered as 附录 A · 来源索引 in the KB):

| Source ID | Authorship | Document Title | Category | Source | Date | Language | KB Sections | Notes |
|-----------|-----------|---------------|----------|--------|------|----------|-------------|-------|
| U-1 | 📄 用户上传 | 南宁东盟生鲜食品智慧港项目介绍 | Pitch / IM | Seller | 2022-06 | CN | 一, 二, 四 | 17 pages, covers Phase 1 only |
| U-2 | 📄 用户上传 | 嘉兴中润项目推介 | Pitch / IM | GFS (普冷) | 2022-11 | CN | 一, 二, 四 | 11 pages, 2 sub-projects |
| A-1 | 🤖 AI 生成 | [AI] 南宁智慧港_知识网络 v1.3 | Internal Analysis | This plugin | 2026-05-18 | CN | (synthesis) | Auto-generated KB |

## Output Format

- **Chat**: Markdown — document count by category, top gaps, file index table
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 附录 A · 来源索引
- **Section details**:
  - 附录 A: 完整文件索引表 (文件名 / 来源方 / 类型 / 主题 / 关联章节 / 上传日期 / source-ID)
  - 附录 A 中的 source-ID 被其他 section 中的 <sup>[id]</sup> 引用回填
  - Gap analysis: 哪些章节缺乏来源支撑 (馈送给 gap-tracking)
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Preserve original filenames — never rename user files.
- When a document contains information across multiple categories, assign the primary category and note secondary relevance.
- For bilingual documents, note both languages.
- When documents contain contradictory information, flag for `dd-claim-audit`.
- Auto-trigger this skill whenever files are uploaded to a project.
- This skill feeds directly into `knowledge-base-generation` — the file index becomes the source registry for the knowledge base.

---

## ═══ 二 信息搜集与结构化 ═══

---

### 📂 skills/public-info-search/

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
  - **不写 七 投资回报**: 投资人 IRR / MOIC 是 returns-analysis 的产物, 不是公开信息搜集的结果。即使 OM 中写了 'projected IRR 18%', 也只能作为'卖方声称'录入 七 的对比项, 不能作为投资回报本身。
  - 每条新增内容标注 certainty (默认 ⚪ 待确认 或 🔵 分析师推论)
  - 新增的 URL/文献来源同步登记到 附录 A
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Always record the source URL or reference — every finding must be traceable.
- For cross-border projects, search BOTH jurisdictions (e.g., a Chinese company buying in Australia — search ASIC and 天眼查).
- Do NOT present raw search results as conclusions — they are inputs for structuring (L1).
- When a government portal shows a project status, capture the exact status label and date.
- Comparable transaction data is often behind paywalls — note what is available vs. what requires paid access.
- Respect data privacy — do not attempt to access non-public personal information.

---

### 📂 skills/knowledge-base-generation/

# Knowledge Base Generation (Project 知识网络)

This is the **central output skill** of the plugin. The plugin maintains exactly one HTML file per project: `[AI] <项目名>_知识网络.html` (note `[AI]` prefix — always present to distinguish from human-uploaded files). Every other skill (except `ic-memo`) writes through this skill.

### Rendering modes (set during project-intake, persist for life of KB)

| Mode | Trigger | Effect |
|------|---------|--------|
| **Single-asset / Multi-asset** | `project-intake` Step 2.4 | Multi-asset partitions sections 二/三/四/五/七/八/九 per asset (`<h3>` subsections like 二.1, 二.2). See `STYLE_GUIDE.md` "Multi-Asset Project Rendering". |
| **Chinese-only / Bilingual** | `project-intake` Step 2.2 jurisdiction | Bilingual renders zh + en parallel content + adds language toggle button in header. See `STYLE_GUIDE.md` "Bilingual Knowledge Base". |

These modes interact: a bilingual multi-asset project renders both per-asset subsections AND per-language content blocks. The modes are decided once at intake and applied to every subsequent skill output.

## The 11 Mandatory Sections

Render these exact `<h2>` sections in this order. **Never omit a section** — render an empty section with a 缺乏资料 callout instead.

| # | Section | Anchor | Primary writer skills |
|---|---------|--------|----------------------|
| 一 | 项目快照 | `#snapshot` | `project-intake`, `public-info-search` |
| 二 | 资产构成（投资标的剖析、规划审批状态） | `#assets` | `public-info-search`, `dd-claim-audit` |
| 三 | 法律结构与关键关系网 | `#legal-relationships` | `background-check`, `public-info-search` |
| 四 | 业务模式与收入假设 | `#business-model` | `public-info-search` |
| 五 | 融资结构与资本结构 | `#capital-structure` | `public-info-search` |
| 六 | 市场对标与可比交易 | `#comps` | `comp-analysis` |
| 七 | 投资回报与敏感性分析 | `#returns` | `returns-analysis`, `sensitivity-analysis` |
| 八 | 项目时间轴（进展、依赖与外部窗口） | `#timeline` | `node-monitoring`, `public-info-search` |
| 九 | 关键风险与缓释 | `#risks` | `risk-matrix`, `dd-claim-audit` |
| 十 | 待确认问题清单 | `#open-questions` | `gap-tracking`, `dd-checklist` |
| 十一 | 决策框架 | `#decision-framework` | `value-creation-plan` + analyst synthesis |

> **Conceptual boundary between 四 and 七**: 四 describes the **target company's revenue model** (its customers, its pricing, its unit economics) — i.e. the business as a standalone entity. 七 describes the **investor's expected returns on this specific deal** (IRR/MOIC under base/upside/downside, sensitivity to assumptions, breakeven). Investor-return numbers go to 七 only, never to 四. Customer/pricing data goes to 四 only, never to 七.

Plus two unnumbered appendices:
- **附录 A · 来源索引** (`#source-index`) — maintained by `document-reorganize`
- **附录 B · 术语表** (`#glossary`) — maintained by `term-annotator`

## Workflow

### Step 1: Determine Mode

| Mode | Trigger | Action |
|------|---------|--------|
| **Create** | No `[AI] <项目名>_知识网络.html` exists | Build full HTML scaffold with all 11 sections + 2 appendices |
| **Update** | KB exists, a skill produced new findings | Locate target section(s), replace contents, re-render |
| **Re-audit** | User says "refresh KB" or completeness drift detected | Re-evaluate all sections against the latest source corpus |

### Step 2: For Each Section — Decide Render Mode

For every one of the 11 sections, decide:

| Render mode | When | What appears |
|-------------|------|-------------|
| **Populated** | Hard evidence exists (figures, dates, named parties, documents) | Tables, callouts, bullet lists with inline certainty tags + source links |
| **缺乏资料** | No evidence, or only vague mentions | A `<aside class="callout missing">` block — see template below |
| **Partially populated** | Some sub-topics have evidence, others don't | Render the populated parts normally; for missing sub-topics, embed a smaller "—— 待补充" line |

### Step 3: Apply Section-Specific Content Templates

Each section has a required sub-structure. If a sub-block has no data, render it as 缺乏资料.

#### 一、项目快照
- 项目名 / 所在地 / 资产类型
- 交易对手主体（法人名称）
- Indicative price / range
- 项目当前阶段
- 一句话定性（"Bare lead" / "Early stage" / "Mid stage" / "Mature"）
- 信息完备度（Factor A %）/ 来源多样性（Factor B %）/ 综合（Overall %）

#### 二、资产构成（投资标的剖析、规划审批状态）
- 物理资产清单（土地 / 建筑 / 设备 / 知识产权 / 客户合同）
- 规模数据（面积、产能、装机量等）
- 当前状态（在建 / 运营 / 待建 / 闲置）
- 规划审批状态：
  - 已取得的批文（名称、文号、有效期、发证机构）
  - 在审批文（提交日期、预计完成、风险点）
  - 缺失但必需的批文

#### 三、法律结构与关键关系网
- 持股架构图（项目公司 → 中间层 → 实控人）
- 关键关系人：实控人、董事、关联方
- 律师 / 会计 / 估值机构
- 关联交易识别
- 跨境结构（SPV、BVI、VIE 等）

#### 四、业务模式与收入假设
> Target-company analysis only. Investor returns belong in 七.

- 收入来源拆分（按产品 / 客户 / 地理 / 阶段）
- 单位经济假设：定价、毛利率、收入周期、产能利用率
- 主要客户 / 租户 / 用户名单（具体名称、合同金额、剩余期限）
- 关键运营假设（occupancy、价格涨幅、续约率、流失率等）
- 收入合同的可持续性、续约风险

#### 五、融资结构与资本结构
> Sources & uses + capital stack. Investor return targets belong in 七.

- 总投资额拆解（土地 / 建设 / 营运资金 / 储备）
- 资金来源（自有 / 股权 / 债务 / 政府补贴 / 优先股）
- 现有股东结构与历史融资轮次（轮次、估值、领投方）
- 拟议交易结构（收购 / 增资 / 合作开发 / SPV 安排）
- 债务条款（贷款方、利率、抵押安排、covenant、还款期）

#### 六、市场对标与可比交易
- 已识别可比交易表（日期、规模、对价、估值倍数）
- 行业基准（cap rate / EV/EBITDA / 单价 / 单位经济）
- 项目相对 peers 的差异化定位
- 估值参照区间

#### 七、投资回报与敏感性分析
> The investor's deal economics. Built primarily from `returns-analysis` + `sensitivity-analysis`. Every assumption MUST trace back to a source in another section (typically 四 / 五 / 六).

- 三档情景回报表（base / upside / downside）
  - IRR / MOIC / Cash-on-Cash / Payback
  - 退出时点、退出倍数、退出方式
- 关键假设清单（带 certainty 标签 + 来源指向）
  - 🟡 或 ⚪ 假设须用 `<span class="assumption flagged">` 高亮
- 敏感性分析
  - Tornado chart：对 IRR 影响最大的 5–8 个变量
  - 双变量敏感性矩阵（如 退出 cap rate × 营收增长率）
  - Break-even 阈值（哪些变量在什么值会让项目不可投）
- 与卖方声称 IRR / 项目 OM 中数字的差异分析
- 跨币种 / 跨税制时同时给出本币和 RMB 视角

#### 八、项目时间轴（进展、依赖与外部窗口）
> **Single unified timeline** — do NOT split into 4 sub-blocks. All event types (已发生 / 推进中 / 外部依赖 / 截止) appear in ONE chronological table, sorted by date, with type tag in a fixed column. See `STYLE_GUIDE.md` "Unified Timeline" component for the full table template.

The table columns are: `日期 | 类型 | 事件 | 责任方 | 影响`. Multi-asset projects add an `asset` column with filter buttons.

Event types and their tags:
| Type | Tag | Examples |
|------|-----|----------|
| 已发生 | `<span class="event-tag past">` | DA 批准、融资完成、收购协议签署 |
| 推进中 | `<span class="event-tag active">` | AEMO 注册、尽调进行中、谈判中 |
| 外部依赖 | `<span class="event-tag dependency">` | 监管审批截止日、市场窗口、对方公司决策 |
| 截止 | `<span class="event-tag deadline">` 或 `<span class="event-tag deadline critical">` | indicative offer 失效、option 到期、退出窗口关闭 |

Sort rule: ascending by date; "进行中无固定日期" anchored at the date they began. Past events truncated after the last 10 inside a `<details>` expander.

`node-monitoring` feeds rows into this single table — it does NOT produce its own separate table.

#### 九、关键风险与缓释
- 风险矩阵（Likelihood × Impact）
- 每条 critical/high 风险：来源证据、当前 mitigation、责任人
- 红线风险（一旦触发须停止推进）
- 来自 七 敏感性分析的极度敏感变量同步登记为风险

#### 十、待确认问题清单
- Open question 表（编号 / 问题 / 来源 / 紧迫度 / 解决方 / 状态）
- 按紧迫度排序
- 标记阻塞下一步决策的 "blocker" 项

#### 十一、决策框架
> Synthesis layer. Inputs from every section above.

- 投资论点（3–5 条，每条带证据链接到对应 section）
- 投后增值杠杆（金额、概率、时间窗口）— from `value-creation-plan`
- 关键决策选项（推进 / 改条件推进 / 放弃 / 暂缓）+ 各选项 trade-off
- 推荐意见 + 一句话理由
- 推进所需的下一步动作清单（owner / deadline）

### Step 4: 缺乏资料 Callout Template

```html
<aside class="callout missing">
  <p class="callout-title">⚠ 缺乏资料</p>
  <p>当前材料未提供 <strong>[具体缺失的子项]</strong>。需补充以下任一资料以激活本节：</p>
  <ul>
    <li>[最优先：来源类型 + 具体文件名建议]</li>
    <li>[次优先：来源类型 + 具体文件名建议]</li>
    <li>[备选：可通过公开渠道获取的资料]</li>
  </ul>
  <p class="callout-hint">在 chat 中直接补充信息或上传文件，本节将自动更新。</p>
</aside>
```

The bulleted prompts must be **sector-aware and specific** — not "请补充更多资料". Example for 五、融资结构 in a real-estate deal:
- 卖方提供的 indicative term sheet 或定价邮件
- 项目历史融资记录（资本变更登记、股东会决议）
- 拟定债务结构说明（贷款方、抵押安排、利率）

### Step 5: Certainty Tagging (every data point)

Every fact in the KB carries an inline certainty tag, defined in `STYLE_GUIDE.md`:

| Tag | Meaning | When |
|-----|---------|------|
| ✅ 已核实 | Cross-verified from ≥2 independent sources, or from an authoritative source (regulator, audit) | Use sparingly — most data does not qualify |
| 🟡 当事方声明 | Claimed by seller, project company, or their advisors; not independently confirmed | Default for most data from a CIM or seller deck |
| 🔵 分析师推论 | Derived by the analyst from underlying data; not stated explicitly anywhere | Mark conclusions, projections, estimates |
| ⚪ 待确认 | Mentioned but unverified, or partial information | Flag for follow-up |

### Step 6: Source Linking (clickable + hoverable)

Every populated paragraph must link back to its source(s). Citations are rendered as **tooltip-enabled references** — clickable to jump, hoverable to preview — using the pattern in `STYLE_GUIDE.md` "Tooltip-Enabled Citations".

```html
<span class="cite-ref">
  <a href="#src-U-7">[U-7]</a>
  <span class="tooltip">
    <span class="tooltip-title">📄 用户上传 · U-7</span>
    <span class="tooltip-source">DPHI Town Centres Strategy 2024.pdf, p.47</span>
    <span class="tooltip-preview">"…FSR for the precinct shall not exceed 2.5:1…"</span>
  </span>
</span>
```

Rules:
- Source IDs use **prefix convention**: `U-N` for user-uploaded sources, `A-N` for AI-generated sources (e.g., the KB itself, prior IC memos, scraped public-info-search results). `document-reorganize` assigns and maintains these IDs.
- The tooltip MUST include a 1–2 line verbatim excerpt where the citation lands — not just the filename. This lets the reader sanity-check without leaving the document.
- For URL-based sources, the tooltip excerpt is the relevant sentence from the page (max 200 chars).
- For AI-generated sources, the tooltip preview shows the relevant sentence from the prior agent output + timestamp.

### Step 7: Term Annotation Hand-off

After rendering, scan the new/updated content for technical terms (储能 LFP / 构网型逆变器 / DA / FSR / FIRB / AEMO / BESS / SPV / VIE / cap rate / ROFR etc.). For each newly-introduced term, invoke `term-annotator` to insert a **tooltip-enabled term reference** on first occurrence and add a glossary entry in 附录 B.

```html
<span class="term-ref">
  构网型逆变器<a href="#term-grid-forming" class="term-marker">*</a>
  <span class="tooltip">
    <span class="tooltip-title">构网型逆变器 / Grid-forming inverter</span>
    <span class="tooltip-preview">能主动建立电网电压与频率参考的逆变器…</span>
  </span>
</span>
```

Rules:
- First occurrence in the KB body gets the marker; subsequent occurrences do not (avoid `*` clutter).
- The hover tooltip carries the 1-sentence definition — full definition lives in 附录 B.
- In bilingual mode, both the inline marker and the tooltip definition are bilingual.

### Step 8: Version & Changelog

Increment the KB version (e.g., v1.6 → v1.7). Append one row to the changelog at the bottom of the HTML:

```
v1.7 | 2026-05-18 14:30 | risk-matrix | 八: 新增 3 项 critical 风险 (跨境合规、招商进度、电价波动)
v1.6 | 2026-05-18 12:10 | comp-analysis | 六: 添加 4 个澳洲 BESS 可比交易
...
```

### Step 9: Maturity Recompute

After every update, recompute Factor A (mean of 11 section completeness scores) and Factor B (source diversity from 附录 A). Update the header. If overall maturity crosses a tier boundary (Early → Mid → Mature), surface a notice in the chat response.

For multi-asset projects, Factor A is computed per-asset per-section first, averaged within section, then averaged across sections. The header MUST surface the per-asset breakdown — never collapse to a single number.

### Step 10: KB Header Construction

The header carries the package-level metadata. For multi-asset and bilingual projects, the header has additional rows:

```html
<header class="kb-header">
  <div class="kb-meta-row">
    <p class="kb-meta">合域 AI · 联合家族办公室投资智库</p>
    <span class="ai-badge">🤖 AI 生成</span>
    <!-- Bilingual only -->
    <div class="kb-lang-toggle">
      <button class="lang-btn active" data-lang="zh">中文</button>
      <button class="lang-btn" data-lang="en">English</button>
    </div>
  </div>

  <h1 class="kb-title">项目知识网络</h1>
  <p class="kb-subtitle"><!-- Package name, NOT a single asset name --></p>

  <div class="kb-info">
    <span>v1.7</span>
    <span>2026-05-19 14:30</span>
    <span>完备度 A: 35% · B: 42% · 综合 38%</span>
    <!-- Multi-asset only -->
    <span class="kb-asset-breakdown">Wollar 62% · Moorabool 8%</span>
    <span>内部文件</span>
  </div>

  <p class="kb-disclosure">
    本文档由 合域 AI / Claude 维护，根据项目文件夹中的用户上传材料和搜索到的公开信息持续更新。
    本文档非投资建议，所有结论需要 IC 复核。
  </p>
</header>
```

Style notes:
- `.ai-badge`: small inline badge in `--accent-subtle` color, `--text-xs`, no background fill. Always visible regardless of language toggle.
- `.kb-lang-toggle`: only rendered when bilingual mode is on. Right-aligned in the meta row.
- `.kb-asset-breakdown`: only rendered when multi-asset. Lists each asset's Factor A.
- `.kb-disclosure`: 1–2 lines, `--text-secondary`, `--text-sm`. Establishes AI authorship + scope of trust.

## Output Format

- **Chat**: Brief markdown — what changed in this update, which sections moved, new maturity scores, suggested next action
- **HTML file**: `[AI] <项目名>_知识网络.html` (note `[AI]` prefix is mandatory) — full re-render of the 11 sections + 2 appendices + header + changelog
- **Location**: Saved to the project folder root (same folder the user opened in Cowork)
- All visual rules in `STYLE_GUIDE.md`

## Important Notes

- **Single source of truth**: All non-IC outputs go here. Do NOT create separate "layer" HTML files. Do NOT spread project information across multiple documents.
- **Every section always present**: Use 缺乏资料 callouts liberally — they ARE the value of the document (they tell the user what to do next).
- **Specific prompts, not generic**: A 缺乏资料 callout that says "需要更多资料" is useless. It must name file types, source parties, and what they would unlock.
- **Certainty tagging is non-negotiable**: An untagged fact is worse than no fact. If unsure, mark ⚪ 待确认.
- **Atomic updates**: When a skill writes to multiple sections in one turn, do all writes + one version bump + one changelog entry, not multiple bumps.
- **The KB feeds `ic-memo`**: When `/ic-memo` is invoked, it reads this HTML as primary input. A high-quality KB → high-quality memo with minimal extra work.
- **Auto-update on every conversation**: Any new info from the user in chat (even a casual "对了忘了说，项目方已经拿到 FIRB 批准了") must be classified into the right section(s) and trigger an update.

---

### 📂 skills/term-annotator/

# Term Annotator (术语注脚)

The KB is read by people from finance, legal, real estate, energy, and technology backgrounds — no single reader knows every term. This skill makes the document self-explanatory by attaching a brief footnote definition to every technical term on its first appearance.

## When Invoked

- **Automatically** by `knowledge-base-generation` after each section update — scans for new terms not yet in 附录 B.
- **Automatically** by `project-intake` during v1 KB creation — seeds the glossary from initial documents.
- **Manually** when the user says "解释一下 [term]" or "把这些专有名词都加上注释".

## Workflow

### Step 1: Detect Terms

Scan the relevant section(s) (or the whole KB) for terms matching any of the lists below. Use case-insensitive matching for English acronyms; exact matching for Chinese terms.

#### Term inventory by domain

**储能 / 电力 (Energy storage / power)**
- BESS, LFP, NMC, SOC, SOH, DOD, C-rate, round-trip efficiency
- 构网型逆变器 (Grid-forming inverter), 跟网型逆变器, PCS, EMS, BMS
- 风机侧直流耦合, 光储一体, virtual synchronous generator
- AEMO, NEM, FCAS, ARENA, CIS, LGC, STC
- 并网点, 上网电价, 辅助服务市场, capacity market

**房地产 / 城市规划 (Real estate)**
- DA (Development Application), CC (Construction Certificate), OC (Occupation Certificate)
- FSR (Floor Space Ratio), GFA (Gross Floor Area), site coverage
- FIRB (Foreign Investment Review Board), SIRA
- PRCUTS, LEP, DCP, RZ1, B4 zoning
- 容积率, 建筑覆盖率, 限高, 退让

**金融 / 交易结构 (Finance / deal terms)**
- IRR, MOIC, DPI, TVPI, cash-on-cash, payback
- term sheet, NDA, LOI, MOU, SPA, SHA
- drag-along, tag-along, ROFR, ROFO, anti-dilution
- waterfall, carry, hurdle, catch-up, GP/LP
- cap rate, EV/EBITDA, exit multiple

**法律 / 架构 (Legal / structure)**
- SPV, BVI, VIE, Cayman SPV, 红筹架构, 反向并购
- 关联交易, 同业竞争, 一致行动人
- 实控人, UBO (Ultimate Beneficial Owner)
- 并购重组令, 41 号文, 75 号文, ODI

**生物合成 / 科技 (Biosynthetics / tech)**
- ARR, NRR, GRR, LTV/CAC, churn, MRR
- GMP, cGMP, FDA IND, EMA CTA
- titer, productivity, yield (fermentation)

**贸易 / 物流 (Trade / logistics)**
- DDP, CIF, FOB, EXW
- bonded warehouse, free trade zone, AEO
- cold chain, last-mile, 3PL/4PL

### Step 2: Decide Whether to Annotate

For each detected term:
- If already in 附录 B → skip (don't double-annotate).
- If appearing for the first time in the KB body → annotate (insert footnote marker + add glossary entry).
- If appearing in 附录 A (来源索引) only → don't annotate the source title, but DO ensure the term is in 附录 B if it's also in the body.

### Step 3: Insert Tooltip-Enabled Term Reference

> **v0.4 change**: numeric footnote markers (¹³) are deprecated. Use a single asterisk `*` as the marker for every glossary term. The marker is **both clickable** (jumps to 附录 B) **and hoverable** (shows definition preview inline). See `STYLE_GUIDE.md` "Tooltip-Enabled Citations and Glossary".

Wrap the first occurrence in the body:

```html
<span class="term-ref">
  构网型逆变器<a href="#term-grid-forming" class="term-marker">*</a>
  <span class="tooltip">
    <span class="tooltip-title">构网型逆变器 / Grid-forming inverter</span>
    <span class="tooltip-preview">能主动建立电网电压与频率参考的逆变器，相比跟网型逆变器，在弱电网或离网场景下可独立提供稳定电网。</span>
  </span>
</span>
```

Rules:
- The `*` marker is in `--accent-subtle`, font-size 0.75em, superscript.
- Tooltip body is the **1-sentence** definition. The full multi-sentence definition lives in 附录 B at the anchor.
- Tooltip appears on hover AND keyboard focus (`:focus-within`), no animation.
- Both bilingual languages live inside the tooltip when bilingual mode is on:

```html
<span class="tooltip">
  <span class="tooltip-title">构网型逆变器 / Grid-forming inverter</span>
  <span class="tooltip-preview" lang="zh">能主动建立电网电压与频率参考的逆变器…</span>
  <span class="tooltip-preview" lang="en">An inverter that actively establishes grid voltage and frequency reference…</span>
</span>
```

### Step 4: Add Glossary Entry

Append to 附录 B · 术语表 (`<dl class="glossary">`). In bilingual mode include `<dd lang="zh">` + `<dd lang="en">`:

```html
<!-- Chinese-only mode -->
<dt id="term-grid-forming">构网型逆变器 (Grid-forming inverter)</dt>
<dd>能主动建立电网电压与频率参考的逆变器，相比传统跟网型 (grid-following) 逆变器，在弱电网、高新能源渗透或离网场景下可独立提供稳定电网。新南威尔士州 AEMO 自 2024 年起对大型储能项目要求构网能力。<a href="https://aemo.com.au/...">来源</a></dd>

<!-- Bilingual mode -->
<dt id="term-grid-forming">构网型逆变器 / Grid-forming inverter</dt>
<dd lang="zh">能主动建立电网电压与频率参考的逆变器…新南威尔士州 AEMO 自 2024 年起对大型储能项目要求构网能力。</dd>
<dd lang="en">An inverter that actively establishes grid voltage and frequency reference… AEMO requires grid-forming capability for large-scale storage projects in NSW since 2024.</dd>
```

> The legacy numeric prefix in `<dt>` (¹³, ¹², etc.) is removed in v0.4 — anchors alone are sufficient since term references no longer use sequential numbers.

### Glossary entry rules

- **1–3 sentences max.** This is a footnote, not a Wikipedia article.
- **Bilingual term**: include both Chinese and English in `<dt>` if the term has both forms (e.g., "DA (Development Application)").
- **Practical relevance over pure definition**: explain what it MEANS for this kind of project, not just what the letters stand for. Example: "FIRB (Foreign Investment Review Board) — 澳大利亚外资审批机构。中国投资者收购澳洲土地或大型企业超过 \$310M 通常需事先申请，审批周期约 30–90 天，未获批前不得交割。"
- **Source link** when the definition is regulator-specific or rapidly evolving (e.g., AEMO rules, FIRB thresholds).
- **No marketing language.** This is reference material.

### Step 5: Sample Glossary Entries (use as quality bar)

| Term | Good entry |
|------|-----------|
| LFP | LFP（磷酸铁锂电池）— Lithium Iron Phosphate。储能项目主流电池化学体系，相比三元锂 (NMC) 安全性更高、循环寿命更长 (6000+ cycles)，能量密度较低 (≈160 Wh/kg)。澳洲大型 BESS 项目几乎全部采用 LFP。 |
| 构网型逆变器 | 见 Step 4 示例。 |
| AEMO 注册 | AEMO (Australian Energy Market Operator) — 澳洲国家电力市场运营商。新能源 / 储能项目并网前必须完成 AEMO 注册，含项目登记、技术接入测试、市场参与者授权三阶段，周期通常 6–12 个月。注册延迟是项目并网延期的主要原因之一。 |
| DA | DA (Development Application) — 澳大利亚州 / 市政府的开发许可申请。任何涉及土地用途变更、新建、改建的项目均需 DA 批准。审批周期因 council 和项目复杂度差异极大 (2 个月到 3 年+)，是房地产和基础设施项目的关键时间节点。 |
| FIRB | FIRB (Foreign Investment Review Board) — 澳洲联邦外资审批机构。中国投资者收购澳洲土地或股权超阈值 (商业土地约 \$310M、住宅土地任意金额) 需事先申请。审批周期约 30–90 天，附条件批准 (例如限制原住民地权地块) 较常见。 |
| FSR | FSR (Floor Space Ratio) — 建筑面积比 = 总建筑面积 / 用地面积。澳洲房地产开发的核心规划指标，决定项目可建多少。例如 FSR 4:1 表示 1 万 ㎡ 用地最多可建 4 万 ㎡ 建筑面积。 |
| 风机侧直流耦合 | 风机侧直流耦合 (Wind-side DC coupling) — 风电场内储能电池与风机通过直流母线直接连接，跳过 AC 转换。优点：减少能量损耗、降低成本；缺点：技术成熟度低于交流耦合，目前仅少数项目实施。 |
| BESS | BESS (Battery Energy Storage System) — 电池储能系统。指由电池模组 + PCS (Power Conversion System) + BMS + EMS 组成的完整储能装置。澳洲 BESS 项目规模从 10MWh 到 1000+MWh 不等。 |
| cap rate | Cap rate (Capitalization Rate) — 资本化率 = 年净营业收入 / 物业价值。商业地产估值核心指标，cap rate 越低代表估值越高 / 风险越低。澳洲核心商业地产 cap rate 通常 4.5%–6.5%。 |

### Step 6: Output

- **No separate chat message.** This skill works silently as part of a KB update.
- **HTML mutation**: footnote markers inserted in body sections, new entries appended to 附录 B.
- **Sorting**: 附录 B entries are ordered by first appearance in the KB (= footnote number order), not alphabetically.

## Important Notes

- **Conservative trigger**: don't annotate common business terms (revenue, profit, margin). Only acronyms, jurisdiction-specific regulatory terms, sector-specific technical terms, and structured-finance jargon.
- **One annotation per term per KB**: even if "LFP" appears 50 times in the document, only the first occurrence carries the marker.
- **Re-numbering safety**: if a previously annotated term is later deleted from the body, do NOT renumber existing footnotes — keep the historical numbering and mark the orphaned glossary entry with `(已不在正文中引用)` rather than deleting it (the term may reappear).
- **User-supplied terms**: if the user explicitly asks "什么是 [term]", add it to 附录 B even if it's not in the body (mark as `(用户提问)`).

---

### 📂 skills/comp-analysis/

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

---

## ═══ 三 尽职调查 ═══

---

### 📂 skills/dd-checklist/

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
- All output conforms to `STYLE_GUIDE.md`.
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

---

### 📂 skills/dd-claim-audit/

# Claim Audit & Cross-Verification

## Workflow

### Step 1: Identify Auditable Claims

Scan the knowledge base (L1) and project documents for statements that meet any of these criteria:
- **Quantitative claims** with financial impact (prices, areas, costs, revenues, returns)
- **Status claims** about approvals, permits, certifications
- **Performance claims** about technology, operations, track record
- **Market claims** about demand, competition, positioning
- **Timeline claims** about when things will happen
- **Uniqueness claims** about competitive advantages or scarcity

For each claim, extract:
- Exact original statement (verbatim or precise paraphrase)
- Source document and page/section
- Who made the claim (seller, advisor, government, internal)
- Financial materiality (how much does it matter if this is wrong)

### Step 2: Credibility Assessment

For each claim, assign a credibility rating:

| Rating | Definition | Action Required |
|--------|-----------|-----------------|
| **Verified** ✅ | Independently confirmed by authoritative source | None — record source |
| **Plausible** 🟢 | Consistent with available evidence, within industry norms | Note basis for plausibility |
| **Uncertain** 🟡 | Cannot be confirmed or denied with available information | Add to gap-tracking; note uncertainty in downstream analysis |
| **Questionable** 🟠 | Inconsistent with some evidence or outside normal ranges | Investigate further; flag in risk matrix |
| **Contradicted** 🔴 | Directly contradicted by another credible source | Escalate; document both sides; flag in risk matrix |

### Step 3: Cross-Verification Methods

Apply at least one verification method to each material claim:

**Method A: Document-to-Document Cross-Check**
- Compare the same data point across different project documents
- Example: GFA stated in pitch deck vs. DA approval vs. architect's area schedule

**Method B: Source-to-Source Verification**
- Compare seller/party statements against independent sources
- Example: Seller's claimed DA status vs. government planning portal

**Method C: Logical Consistency Check**
- Verify mathematical and logical relationships between data points
- Example: FSR × site area should equal stated GFA; unit price × units should equal total revenue

**Method D: Industry Benchmark Comparison**
- Compare key assumptions against industry norms

| Sector | Common Benchmarks |
|--------|-------------------|
| Real Estate | Construction cost per m², rental yield range, vacancy rate, development margin |
| Energy | LCOE, capacity factor, degradation rate, battery cycle life |
| Biosynthetics | Clinical success probability by phase, time-to-market, R&D cost per candidate |
| Technology | ARR growth rate, NRR, LTV/CAC ratio, gross margin |
| Trade/Industrial | Warehouse rental rate, occupancy ramp timeline, cold chain operating cost |

**Method E: Expert / Precedent Challenge**
- Would a sophisticated buyer accept this claim at face value?
- What would a buyer's advisor challenge in due diligence?
- Example: "20 years without battery replacement" → what DoD, cycle count, and degradation assumptions underpin this?

### Step 4: Contradiction Register

When contradictions are found, document both sides:

| Contradiction ID | Topic | Source A (Statement) | Source B (Statement) | Gap | Recommended Resolution |
|-----------------|-------|---------------------|---------------------|-----|----------------------|
| C-001 | Residential GFA | DPHI: 156,127 m² | Actual calculation: 87,300 m² | 68,827 m² | Request DPHI clarify calculation methodology |
| C-002 | Battery lifespan | Seller: 20 years no replacement | Industry norm: augmentation at year 10–12 | 8–10 years | Request warranty terms and degradation model |

### Step 5: Assumption Sensitivity Flags

For claims that pass credibility checks but rely on assumptions, flag the key assumptions and their sensitivity:

| Claim | Key Assumption | Base Case | Downside | Impact on Project Value |
|-------|---------------|-----------|----------|----------------------|
| Stage 1 revenue AUD 4.58M p.a. | 80% occupancy, ADR 800 | 80% / 800 | 60% / 600 | Revenue drops 44% → IRR impact -X% |
| BESS revenue from arbitrage | Avg spread $50/MWh | $50 | $30 | Revenue drops 40% → payback extends Y years |

Feed sensitivity flags into `sensitivity-analysis` skill for detailed modeling.

### Step 6: Output — Claim Audit Report

**Structure:**
1. **Executive Summary**: X claims audited, Y verified, Z flagged, W contradicted
2. **Audit Table**: All claims with credibility ratings, verification method used, evidence
3. **Contradiction Register**: All identified contradictions with both sources
4. **Assumption Sensitivity Flags**: Key assumptions and their impact ranges
5. **Recommended Adjustments**: For questionable/contradicted claims, suggest adjusted statements
6. **Outstanding Verification Items**: Claims that cannot be verified with current info → feed to `gap-tracking`

## Output Format

- **Chat**: Markdown — top contradictions and re-rated claims
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 相关 section 的 certainty 标签 (一~八 全部可能)
  - 九 关键风险与缓释
  - 十 待确认问题清单
- **Section details**:
  - 全 KB: 每条被审计声明的 certainty 标签 (✅/🟡/🔵/⚪) 重新打标
  - 九: 由审计发现的新增风险 (虚报、矛盾、关键假设错误)
  - 十: 待补证的具体声明列表
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- This skill is the **intellectual core** of the analysis framework. It's where analyst judgment matters most.
- Every contradiction found should generate entries in both `risk-matrix` and `gap-tracking`.
- The audit should be updated whenever new information arrives that affects previously audited claims.
- Be precise about what is being challenged — "the claim is X, the evidence suggests Y" — not vague skepticism.
- For cross-border projects, verify claims against BOTH jurisdictions' standards and norms.
- Seller responsiveness to verification requests is itself a signal — delays may indicate issues.

---

### 📂 skills/background-check/

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
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Background checks must respect privacy laws — use only publicly available information and lawful inquiry methods.
- For cross-border deals, check ALL relevant jurisdictions (the entity may be registered in one country but operate in another).
- SOE connections are not inherently negative but must be flagged for FIRB/regulatory analysis.
- Sanctions screening is non-negotiable for any cross-border transaction.
- Background check findings feed into `risk-matrix` (counterparty risk category).
- When adverse information is found, assess materiality before escalating — not every old lawsuit is relevant.
- Update the background check if new individuals or entities are introduced during the deal process.

---

### 📂 skills/risk-matrix/

# Risk Matrix

## Workflow

### Step 1: Risk Harvesting

Collect risk inputs from all upstream analysis layers:

| Source | Risk Type | Example |
|--------|-----------|---------|
| L1 Knowledge Base | Factual gaps that create uncertainty | Key approval status unknown |
| L2 Claim Audit | Contradicted or questionable claims | Seller's cost claim unsupported |
| L2 Claim Audit | Sensitive assumptions | Revenue depends on 80% occupancy assumption |
| DD Checklist | Red flags from diligence | Title encumbrance discovered |
| Background Check | Counterparty concerns | Director has insolvency history |
| Comp Analysis | Market positioning risk | Limited comps suggest thin market |

Additionally, scan for risks not surfaced by other layers (macro, political, force majeure).

### Step 2: Risk Categorization

Classify every risk into one of 8 standard categories:

| Category | Scope |
|----------|-------|
| **Policy & Regulatory** | Government policy changes, regulatory shifts, foreign investment rules |
| **Approval & Permitting** | DA/planning refusal, conditions, delays, appeals |
| **Market & Demand** | Price decline, demand shortfall, competition, cycle timing |
| **Capital & Financial** | Funding shortfall, interest rate, FX, cost overrun, liquidity |
| **Construction & Execution** | Delays, cost escalation, contractor failure, supply chain |
| **Legal & Compliance** | Title defect, litigation, environmental liability, tax exposure |
| **Counterparty & People** | Seller reliability, key person dependency, partner misalignment |
| **Environmental & Force Majeure** | Natural disaster, climate, contamination, pandemic |

**Sector-Specific Risk Additions:**

| Sector | Additional Risks |
|--------|-----------------|
| **Real Estate** | Heritage constraints, community opposition, infrastructure contribution escalation, strata defects |
| **Energy** | Grid connection failure (GPS rejection), curtailment, technology obsolescence, offtake counterparty default |
| **Biosynthetics** | Clinical trial failure, regulatory rejection, IP challenge, feedstock supply disruption |
| **Technology** | Technology disruption, data breach, customer churn, talent retention |
| **Trade** | Tariff changes, quarantine/inspection failure, cold chain breakdown, commodity price volatility |

### Step 3: Risk Assessment

For each risk, score:

**Likelihood:**
| Score | Label | Definition |
|-------|-------|-----------|
| 4 | Very Likely | > 70% probability |
| 3 | Likely | 40–70% |
| 2 | Possible | 15–40% |
| 1 | Unlikely | < 15% |

**Impact:**
| Score | Label | Definition |
|-------|-------|-----------|
| 4 | Fatal | Project becomes unviable |
| 3 | Severe | >20% value destruction or fundamental strategy change required |
| 2 | Significant | 5–20% value impact, manageable with adjustments |
| 1 | Minor | <5% impact, can be absorbed |

**Risk Score** = Likelihood × Impact (range 1–16)

| Score Range | Classification | Action |
|------------|----------------|--------|
| 12–16 | **Critical** | Must be resolved or mitigated before proceeding |
| 8–11 | **High** | Requires active management plan and deal term protection |
| 4–7 | **Medium** | Monitor and include in sensitivity analysis |
| 1–3 | **Low** | Accept and monitor |

### Step 4: Mitigation & Gap Assessment

For each risk, document:

| Field | Description |
|-------|-------------|
| **Risk ID** | R-001, R-002... |
| **Category** | One of 8 categories |
| **Description** | Specific risk scenario (not generic category name) |
| **Likelihood** | 1–4 |
| **Impact** | 1–4 |
| **Score** | L × I |
| **Current mitigation** | What is already in place |
| **Residual gap** | What additional mitigation is needed |
| **Mitigation owner** | Who is responsible |
| **Source** | Which analysis layer/finding generated this risk |
| **Update trigger** | What event would change this assessment |
| **Link to gap-tracking** | Gap ID if information gap exists |

### Step 5: Output — Risk Matrix

Report section contents:
- Full risk register (sortable by score, category, source)
- Risk heatmap (likelihood × impact grid with risk IDs plotted, rendered as HTML/SVG)
- Critical & High risks — detailed analysis
- Mitigation action plan
- Risk-source traceability (links to L2 findings, DD red flags, etc.)
- Top 5 risks summary for IC memo cross-reference
- Overall risk profile assessment (aggressive / moderate / conservative)

## Output Format

- **Chat**: Markdown — critical risks list + overall risk profile
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 九 关键风险与缓释
- **Section details**:
  - 九: 风险矩阵 (Likelihood × Impact)、每条 critical/high 风险的证据来源 + 当前 mitigation + 责任人
  - 红线风险显式标记 (一旦触发须停止推进)
  - 新发现的 mitigation 缺口同步到 十 待确认问题清单
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- The risk matrix is a **living document** — update when new information arrives or events occur.
- Every critical/high risk should have a corresponding entry in `gap-tracking` (if information gap) or a mitigation action plan (if actionable).
- Risk scores should be revisited when key decision nodes are resolved (e.g., GPS approval → approval risk score changes).
- For cross-border projects, include a dedicated "Cross-border / Regulatory" sub-section covering FIRB, FX, tax treaty, and repatriation risks.
- The risk matrix feeds directly into `ic-memo` (Section 4: Core Risks) and `sensitivity-analysis`.
- Do NOT list risks without actionable context — every risk needs "so what" (what it means for the deal).

---

## ═══ 四 投资回报 ═══

---

### 📂 skills/returns-analysis/

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
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Every assumption in the model MUST trace back to the knowledge base (L1) with a certainty tag.
- Where assumptions are "🟡 Party Statement" or "⚪ Unconfirmed", the model should highlight these cells.
- Tax modeling must be jurisdiction-specific — 土地增值税 (China) vs. CGT + GST (Australia) produce very different return profiles.
- For cross-border deals, model in BOTH local currency and RMB, with explicit FX assumption.
- The returns model feeds into `ic-memo` (Section 5: Valuation & Returns) and `sensitivity-analysis`.
- Do NOT present single-point IRR as "the" return — always show a range across scenarios.

---

### 📂 skills/sensitivity-analysis/

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

---

### 📂 skills/value-creation-plan/

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

---

## ═══ 五 决策输出 ═══

---

### 📂 skills/ic-memo/

# Investment Committee Memo

## Workflow

### Step 1: Gather Inputs

Pull from all upstream analysis outputs:
- L1 Knowledge Base → Project facts and structure
- L2 Claim Audit → Verified vs. questionable information
- L3 Risk Matrix → Critical and high risks
- L4 Comp Analysis → Valuation range and market positioning
- Returns Analysis → IRR, multiple, payback scenarios
- Sensitivity Analysis → Key drivers and break-even points
- Value Creation Plan → Post-acquisition strategy
- Background Check → Counterparty assessment
- Gap Tracking → Outstanding information items

### Step 2: IC Memo Structure

**Section 1: Executive Summary (one page)**
- Project name, location, sector
- Transaction type and indicative price
- **Core thesis**: Why this opportunity exists and why we should pursue it (2–3 sentences)
- **Headline returns**: Base case IRR, multiple, payback
- **Top 3 risks**: One line each
- **Recommendation**: Proceed / Proceed with conditions / Pass
- **Requested decision**: What approval is being sought (LOI authorization, capital commitment, etc.)

**Section 2: Project Overview (1–2 pages)**
- Asset description (from L1, condensed)
- Counterparty and transaction context
- Key facts table (site area, GFA, capacity, stage, price)
- Timeline: How did this deal reach us? What is the process?

**Section 3: Investment Thesis (1–2 pages)**
- **Why now**: Market timing, policy window, competitive dynamics
- **Why this asset**: Differentiation anchors from comp analysis (L4)
- **Why us**: What can this family office / investor group uniquely contribute
- **Value creation pathway**: Summary of value creation plan
- **Exit strategy**: How and when we plan to realize returns

**Section 4: Core Risks (1–2 pages)**
- Top 5 risks from risk matrix (L3), each with:
  - Risk description
  - Likelihood and impact
  - Mitigation plan
  - What happens if mitigation fails (worst case)
- Overall risk profile: Aggressive / Moderate / Conservative
- Key uncertainties that remain unresolved (from gap tracking L6)

**Section 5: Valuation & Returns (1–2 pages)**
- Valuation range (from comp analysis L4)
- Recommended entry price and negotiation strategy
- Returns summary table:

| Metric | Downside | Base | Upside |
|--------|----------|------|--------|
| Unlevered IRR | X% | Y% | Z% |
| Levered IRR | X% | Y% | Z% |
| Equity Multiple | X.Xx | Y.Yx | Z.Zx |
| Payback | X yrs | Y yrs | Z yrs |

- Key sensitivity: "Returns are most sensitive to A and B"
- Break-even: "Project survives up to X% decline in [key variable]"

**Section 6: Decision Options (1 page)**
Present 2–3 distinct paths, not just "do it" vs. "don't":

| Option | Description | Trigger Condition | Capital Required | Expected Return | Key Risk |
|--------|-------------|-------------------|-----------------|-----------------|----------|
| A: Full commitment | Acquire at asking price, proceed immediately | GPS approval confirmed | $X | IRR Y% | Execution risk |
| B: Conditional | Structured offer with milestone payments | Acceptable terms negotiable | $X (staged) | IRR Y% | Timeline risk |
| C: Pass / Monitor | Decline or defer with option to revisit | Risks outweigh returns at current price | $0 | N/A | Opportunity cost |

For each option: what we gain, what we risk, what we need.

**Section 7: Recommendation & Next Steps (half page)**
- **Recommended option**: Which option and why
- **Conditions**: What must be true for this recommendation to hold
- **Immediate next steps**: 3–5 specific actions with owners and deadlines
- **Open items**: Critical gaps that must be resolved before final commitment (from L6)

**Appendices (reference only):**
- A: Detailed knowledge base (L1 document)
- B: Claim audit findings (L2 report)
- C: Full risk matrix (L3)
- D: Comp analysis details (L4)
- E: Financial model (returns analysis)
- F: Background check summary

### Step 3: Quality Standards

The IC memo must meet these standards:
- **Total length**: 8–12 pages (excluding appendices). If it can't fit, the analysis isn't sharp enough.
- **Every claim must have a source**: No unsupported assertions
- **Certainty tags visible**: Key facts should carry their certainty tag (✅/🟡/🔵/⚪) so the reader knows what's verified vs. assumed
- **No hedge without substance**: "This could be risky" is not acceptable; "Risk R-003 (likelihood 3, impact 4): GPS rejection would delay project 6–12 months and reduce IRR by 3–5%" is.
- **Decision-ready**: A reader with no prior context should be able to understand the opportunity and make a decision after reading the memo.

### Step 4: Language and Tone

- Write for a business principal (Jimmy), not for an analyst
- Lead with conclusions, support with evidence
- Use numbers, not adjectives ("IRR of 15%" not "attractive returns")
- Acknowledge uncertainty explicitly rather than projecting false confidence
- For bilingual audiences: key terms in both Chinese and English where relevant

## Output Format

> ⚠ **The only skill that does NOT write to the KB.** `ic-memo` is the "frozen snapshot" delivered to the IC; the KB is the "living source of truth".

- **Chat**: Markdown — executive summary + explicit recommendation (推进 / 改条件推进 / 放弃 / 暂缓)
- **Word document**: `[AI] IC备忘录_<项目名>_<日期>.docx` (note `[AI]` prefix mandatory) saved to the project folder root. The Word document itself also carries an "AI 生成" footer on every page and a 1-paragraph AI-authorship disclosure on the title page.
- **Input**: reads the entire `[AI] <项目名>_知识网络.html` as primary input; the KB's content quality directly determines the memo's quality
- **Bilingual memos**: if the KB is in bilingual mode (overseas project), produce TWO Word files: `[AI] IC Memo_<Project>_<Date>.docx` (English) and `[AI] IC备忘录_<项目名>_<日期>.docx` (Chinese). Same content, two languages.
- **Generation**: invokes `anthropic-skills:docx` to produce the .docx file
- **Memo structure** (mapped from KB sections):
  - 执行摘要 ← KB 一 + 十一
  - 投资论点 ← KB 二 + 四 + 六
  - 交易结构 ← KB 三 + 五
  - 关键风险与缓释 ← KB 九
  - 回报概览 ← KB 七
  - 选项与建议 ← KB 十一
  - 附录: 信息缺口、未决事项、时间表 ← KB 十 + 八
- After memo generation, also append a `## IC备忘录已生成 vX.Y` entry to KB changelog (the KB itself is not modified)
- All Word formatting conforms to family-office IC standards
## Important Notes

- The IC memo is the **culmination** of all analysis layers. It should never be generated before L1–L4 are substantially complete.
- If critical gaps (blocking items from L6) remain unresolved, the memo should explicitly state "Decision is contingent on resolution of [gap]" rather than papering over the uncertainty.
- The memo is a **recommendation**, not a decision. The decision-maker (Jimmy / IC) makes the call.
- Version the memo — as information arrives and analysis updates, issue revised versions with change log.
- After a decision is made, the memo becomes the reference document for post-investment monitoring.
- For multi-target projects (e.g., Wollar vs. Moorabool), include a comparative section within the decision options, not separate memos.

---

## ═══ 六 持续追踪 ═══

---

### 📂 skills/gap-tracking/

# Gap Tracking

## Workflow

### Step 1: Gap Registration

Gaps can be created from any analysis layer. For each gap, register:

| Field | Description |
|-------|-------------|
| **Gap ID** | G-001, G-002... (project-unique) |
| **Description** | What specific information is missing (field-level precision) |
| **Source Layer** | Which analysis layer discovered this gap (L0–L5) |
| **Source Reference** | Specific finding that generated the gap (e.g., "L2 Claim Audit #3") |
| **Affected Layers** | Which downstream layers are blocked or degraded by this gap |
| **Urgency** | Blocking (cannot decide without it) / Precision (affects accuracy) / Enhancement (nice to have) |
| **Suggested Source** | Who or what can provide this information |
| **Owner** | Team member responsible for follow-up |
| **Status** | Not Started → Contacted → Received → Verified → Closed |
| **Created Date** | When the gap was first identified |
| **Target Date** | When the information is needed by |
| **Resolution Trigger** | What downstream analysis updates when this gap is filled |

### Step 2: Prioritization

Sort gaps by a combined priority score:

| Urgency | Definition | Action |
|---------|-----------|--------|
| **Blocking** | Decision cannot be made without this information | Escalate immediately; track daily |
| **Precision** | Analysis can proceed but conclusions have wider confidence intervals | Track weekly; note uncertainty in outputs |
| **Enhancement** | Would improve analysis but not essential for decision | Track monthly; pursue opportunistically |

Within each urgency tier, further sort by:
1. Number of affected downstream layers (more = higher priority)
2. Proximity to decision deadline
3. Difficulty of obtaining (easy wins first)

### Step 3: Status Tracking

Update gap status as information flows in:

```
Not Started → Contacted → Received → Verified → Closed
                                         ↓
                                   Unresolvable (mark and note impact)
```

When status changes to **Received**:
- Validate the information quality
- Update the relevant knowledge base dimension
- Trigger re-run of affected analysis layers

When status changes to **Unresolvable**:
- Document why it cannot be obtained
- Assess impact on decision quality
- Note in risk matrix (L3) and IC memo (L5)

### Step 4: Cross-Layer Gap Summary

Generate a view showing gaps by source and impact:

| Gap ID | Description | Source | Urgency | Affects | Status |
|--------|-------------|--------|---------|---------|--------|
| G-001 | DA "开工" 法定定义未确认 | L2 Audit | Blocking | L3, L5 | Contacted |
| G-002 | 卖方声称成本为第三方30%待验证 | L2 Audit | Precision | L3, L4, L5 | Not Started |
| G-003 | GPS 第二轮审查结果 | L0 Search | Blocking | L1–L5 | Monitoring |

### Step 5: Weekly Review Report

Generate a concise weekly status update:
- Total gaps: X (Y blocking, Z precision, W enhancement)
- Resolved this week: list
- New gaps this week: list
- Overdue items: list with escalation recommendation
- Next week priorities: top 3 blocking gaps to pursue

## Output Format

- **Chat**: Markdown — summary counts + top blocking gaps
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 十 待确认问题清单
- **Section details**:
  - 十: Active gaps 表 (按紧迫度排序)、已解决 gaps 审计轨迹、责任人/截止日期、blocker 标记
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Gaps are a **living registry** — they grow as analysis deepens and shrink as information arrives.
- Every gap in L2 (claim audit) should automatically generate a corresponding entry here.
- Every risk in L3 (risk matrix) that has a "gap" field populated should link back to an entry here.
- When a gap is filled, do NOT just close it — trigger the downstream analysis update first.
- Duplicate detection: before creating a new gap, check if an equivalent already exists.
- For cross-border projects, flag gaps that require jurisdiction-specific sources (e.g., FIRB status can only be confirmed by the applicant or their lawyer).

---

### 📂 skills/node-monitoring/

# Decision Node Monitoring

> **v0.4 change**: This skill writes rows into the **unified timeline table** in KB section 八 — it does NOT produce its own separate section or sub-blocks. Every decision node becomes one row tagged as either `推进中`, `外部依赖`, or `截止`. See `STYLE_GUIDE.md` "Unified Timeline" for the row schema. For multi-asset projects, each row also carries the `asset` attribute so users can filter the timeline by asset.

## Workflow

### Step 1: Identify Decision Nodes

Scan all analysis outputs for events that represent binary or branching outcomes:

| Source | Node Type | Example |
|--------|-----------|---------|
| L1 Knowledge Base (Timeline) | Scheduled events | DA approval hearing date, FIRB decision deadline |
| L3 Risk Matrix | Risk resolution events | GPS review result, rezoning outcome |
| L6 Gap Tracking | Information arrival events | Valuation report delivery, seller response |
| External environment | Macro / policy events | Interest rate decision, policy announcement |

### Step 2: Node Registration

For each node, register:

| Field | Description |
|-------|-------------|
| **Node ID** | N-001, N-002... |
| **Description** | What event or decision (specific, not vague) |
| **Expected date** | Earliest / most likely / latest |
| **Source / controlled by** | Who or what determines the outcome (government body, counterparty, market) |
| **Category** | Approval / Market / Policy / Counterparty / Technical / Macro |
| **Materiality** | How much does this affect the investment thesis |

### Step 3: Scenario Pre-Analysis

For each node, pre-define what happens under different outcomes:

**Template:**

```
Node N-001: GPS Second Round Review Result
Expected: By 2025-05-07
Controlled by: Transgrid / AEMO

Scenario A — Positive (favorable feedback, minor adjustments only):
  → Valuation impact: +15–25% (project moves to near-RTB status)
  → Strategy shift: Accelerate market sounding, target competitive bid process
  → Update triggers: L4 comp analysis (upgrade stage), L5 IC memo (proceed recommendation)

Scenario B — Mixed (significant technical modifications required):
  → Valuation impact: Neutral to -10% (delay 3–6 months)
  → Strategy shift: Conditional offer with milestone payment tied to GPS resolution
  → Update triggers: L3 risk matrix (technical risk upgrade), returns model (extend timeline)

Scenario C — Negative (fundamental issues, major redesign required):
  → Valuation impact: -30% or more
  → Strategy shift: Pause pursuit, monitor from distance, revisit in 6–12 months
  → Update triggers: L5 IC memo (revise to pass/defer), L3 risk matrix (critical risk)
```

### Step 4: Monitoring Method

Define how each node's resolution will be detected:

| Method | When to Use | Example |
|--------|------------|---------|
| **Auto-monitor (public source)** | Government portals, stock exchanges, public registers | Check NSW Planning Portal weekly for DA status changes |
| **Scheduled check-in** | Counterparty or advisor will notify | Call seller's advisor bi-weekly for GPS update |
| **Calendar trigger** | Known deadline or hearing date | Set reminder for FIRB 30-day clock expiry |
| **News monitoring** | Policy or macro events | Monitor RBA rate decisions, planning policy announcements |
| **Passive** | Low-priority or long-dated | Annual check on infrastructure completion status |

### Step 5: Cascade Rules

When a node is resolved, automatically:

1. **Record the outcome** with date and evidence
2. **Select the matching scenario branch**
3. **Trigger downstream updates**:
   - Update knowledge base (L1) with new fact
   - Re-run claim audit (L2) if outcome affects previously audited claims
   - Update risk matrix (L3) — re-score affected risks
   - Update comp analysis (L4) if market positioning changed
   - Update returns model if financial assumptions affected
   - Update IC memo (L5) recommendation if warranted
4. **Close the node** and archive in resolved log
5. **Notify stakeholders** of the outcome and its implications

### Step 6: Node Dashboard

Maintain a real-time view:

| Node ID | Description | Expected Date | Days Until | Materiality | Status | Monitoring |
|---------|-------------|---------------|-----------|-------------|--------|------------|
| N-001 | GPS review result | 2025-05-07 | 3 days | Critical | Awaiting | Bi-weekly call |
| N-002 | DPHI rezoning response | 2025-Q3 | ~90 days | High | Pending | Monthly check |
| N-003 | RBA rate decision | 2025-06-03 | 30 days | Medium | Scheduled | Auto-monitor |

### Step 7: Sector-Specific Common Nodes

**Real Estate:**
- DA / Planning Permit decision
- Rezoning / SEPP amendment gazettal
- FIRB approval (cross-border)
- Infrastructure completion (metro, road, station)
- Policy announcement (housing targets, affordable housing %, stamp duty)
- Pre-sale milestone (% sold threshold for construction finance)

**Energy:**
- GPS technical review outcome
- AEMO registration confirmation
- Connection agreement execution
- Environmental approval
- Offtake / PPA execution
- Government subsidy / incentive announcement

**Biosynthetics:**
- Clinical trial results (Phase 1/2/3 readout)
- Regulatory filing acceptance
- FDA/EMA/NMPA approval decision
- Patent grant / challenge outcome
- Partnership / licensing deal close

**Technology:**
- Product launch date
- Key customer contract renewal
- Funding round close
- Regulatory ruling (data privacy, antitrust)

**Trade / Industrial:**
- Import/export license renewal
- Tariff / trade policy change
- Key supplier contract renewal
- Quarantine / compliance inspection outcome

## Output Format

- **Chat**: Markdown — upcoming nodes (next 30 days) + any overdue
- **KB update**: writes to the following Project Knowledge Base section(s) of `[AI] <项目名>_知识网络.html`:
  - 八 项目时间轴（进展、依赖与外部窗口）
- **Section details**:
  - 八: 已发生事件、当前推进事项、外部依赖节点 (审批/市场窗口/对方决策)、不可逆事件提示
  - 每个节点带场景分支预案 (通过/部分通过/不通过)
  - 节点 resolution 后自动触发下游 section 更新 (例: 审批通过 → 二 资产构成更新)
- All KB writes go through `knowledge-base-generation` (single source of truth — no separate layer/section HTML files).
- All output conforms to `STYLE_GUIDE.md`.
## Important Notes

- Nodes are NOT the same as gaps. A gap is missing information; a node is a future event whose outcome is uncertain.
- Pre-analyzing scenarios is the key value — when the event happens, the team already knows what it means and what to do.
- Some nodes are **controllable** (e.g., submitting a FIRB application) and some are **uncontrollable** (e.g., RBA rate decision). Track both but manage differently.
- For cascading nodes (Node B only matters if Node A resolves positively), document the dependency chain.
- Node monitoring should be reviewed weekly in the project review cadence.
- When a critical node's expected date passes without resolution, escalate — silence is a signal.

---


## End of Reference Manual

For the visual specification (colors, typography, components, file naming, multi-asset rendering, bilingual mode, tooltip pattern, unified timeline, 11-section structure) refer to `STYLE_GUIDE.md`.

For installation and usage instructions, see `README.md`.
