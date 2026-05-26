---
name: knowledge-base-generation
description: "Owns the project's single Project Knowledge Base (项目知识网络) HTML file. Creates, updates, and re-renders the 10-section KB document. Every other analysis skill writes into the KB through this skill. Triggers on \"generate knowledge base\", \"项目知识网络\", \"项目知识底座\", \"update KB\", \"refresh knowledge base\", \"structure this project\", \"organize what we know\", \"build project profile\", or automatically when any other skill produces new findings."
---

# Knowledge Base Generation (Project 知识网络)

This is the **central output skill** of the plugin. The plugin maintains exactly one HTML file per project: `[AI] <项目名>_知识网络.html` (note `[AI]` prefix — always present to distinguish from human-uploaded files). Every other skill (except `ic-memo`) writes through this skill.

### Rendering modes (set during project-intake, persist for life of KB)

| Mode | Trigger | Effect |
|------|---------|--------|
| **Single-asset / Multi-asset** | `project-intake` Step 2.4 | Multi-asset partitions sections 二/三/四/五/七/八/九 per asset (`<h3>` subsections like 二.1, 二.2). See `STYLE_GUIDE.md` "Multi-Asset Project Rendering". |
| **Chinese-only / Bilingual** | `project-intake` Step 2.2 jurisdiction | Bilingual renders zh + en parallel content + adds language toggle button in header. See `STYLE_GUIDE.md` "Bilingual Knowledge Base". |
| **Visual theme (Portable = DEFAULT)** | Default unless user explicitly asks for the plain grey theme | **Every KB renders in the Portable theme (米色背景 / 酒红 / Playfair) by default.** The look is produced by copying the complete stylesheet from `STYLE_GUIDE.md` "Portable Stylesheet — 复制即用" verbatim. Only drop to the default grey theme if the user explicitly requests it. |

These modes interact: a bilingual multi-asset project renders both per-asset subsections AND per-language content blocks. The modes are decided once at intake and applied to every subsequent skill output.

## The 11 Canonical Sections (fixed slots, dynamically numbered)

The KB has 11 canonical section *slots* plus 2 appendix slots. The slots are **fixed in identity and stable in order**; the visible Chinese numerals (一/二/三…) are **assigned at render time** based on which slots actually render. A slot that is completely empty is **hidden** — its anchor, its `<h2>`, its `<nav>` link, and its numeral are all omitted, and the surviving slots are renumbered consecutively starting from 一.

Slot table — stable order, stable anchor, stable role. Numerals shown here are the *fully-populated* fallback numbering (used only when every slot renders).

| Slot key | Section | Anchor | Primary writer skills |
|----------|---------|--------|----------------------|
| `snapshot` | 项目快照 | `#snapshot` | `project-intake`, `public-info-search` |
| `assets` | 资产构成 / 平台能力与资源（类型自适应：实物资产 vs 资源能力） | `#assets` | `public-info-search`, `dd-claim-audit` |
| `legal-relationships` | 法律结构与关键关系网 | `#legal-relationships` | `background-check`, `public-info-search` |
| `business-model` | 业务模式与收入假设 | `#business-model` | `public-info-search` |
| `capital-structure` | 融资结构与资本结构 | `#capital-structure` | `public-info-search` |
| `comps` | 市场对标与可比交易 | `#comps` | `comp-analysis` |
| `returns` | 投资回报与敏感性分析 | `#returns` | `returns-analysis`, `sensitivity-analysis` |
| `timeline` | 项目时间轴（进展、依赖与外部窗口） | `#timeline` | `node-monitoring`, `public-info-search` |
| `risks` | 关键风险与缓释 | `#risks` | `risk-matrix`, `dd-claim-audit` |
| `open-questions` | 待确认问题清单 | `#open-questions` | `gap-tracking`, `dd-checklist` |
| `decision-framework` | 决策框架 | `#decision-framework` | `value-creation-plan` + analyst synthesis |

> **Conceptual boundary between `business-model` and `returns`**: `business-model` describes the **target company's revenue model** (its customers, its pricing, its unit economics) — i.e. the business as a standalone entity. `returns` describes the **investor's expected returns on this specific deal** (IRR/MOIC under base/upside/downside, sensitivity to assumptions, breakeven). Investor-return numbers go to `returns` only, never to `business-model`. Customer/pricing data goes to `business-model` only, never to `returns`.

Plus two unnumbered appendix slots (also hideable when empty):
- **附录 A · 来源索引** (`#source-index`) — maintained by `document-reorganize`
- **附录 B · 术语表** (`#glossary`) — maintained by `term-annotator`

### Hide-and-renumber rule (the core "fixed format" guarantee)

A slot **renders** iff it has at least one piece of populated content (a populated subsection, a table row, a tagged data point, or a deliberately-recorded 缺乏资料 placeholder for *partial* populated content). A slot **hides** iff it would otherwise contain *only* a generic "no data" message and nothing else.

Hidden slots produce **no output at all** — no `<section>`, no `<h2>`, no `<nav>` link, no entry in the on-page TOC, no contribution to the visible numbering. The remaining rendered slots are then assigned Chinese numerals 一/二/三… **in stable slot order**, so numbering is always gap-free.

Example — if only `snapshot`, `assets`, `returns`, `risks`, `decision-framework` have data, the rendered output is:
- 一 项目快照 → `#snapshot`
- 二 资产构成 → `#assets`
- 三 投资回报与敏感性分析 → `#returns`
- 四 关键风险与缓释 → `#risks`
- 五 决策框架 → `#decision-framework`

Same project, after `public-info-search` adds business-model content → renumber automatically:
- 一 项目快照 → `#snapshot`
- 二 资产构成 → `#assets`
- 三 业务模式与收入假设 → `#business-model`
- 四 投资回报与敏感性分析 → `#returns`
- 五 关键风险与缓释 → `#risks`
- 六 决策框架 → `#decision-framework`

Anchors are stable (`#returns` is always `#returns`); only the displayed numeral changes. Any cross-section reference must use the slot key / anchor, never the numeral.

### Left section-nav (panel switcher) is generated, not hard-coded

The KB is **not** one long scrolling page. It renders as a **left-sidebar section switcher**: a fixed vertical column of buttons (`.kb-nav` / `.kb-nav-btn`, one per rendered slot + appendices) on the left, and a content area (`.kb-content`) on the right that shows **only the active panel** (`.kb-panel`) at a time. Clicking a button activates its panel and hides the rest.

- The button list is built **at render time from the render manifest in slot order** — never hard-coded. Each button carries `data-target="<anchor>"` matching its panel `id`; its `.kb-nav-num` shows the manifest `displayNumeral` (一/二/三… for slots, `A`/`B` for appendices). Hidden slots emit neither a button nor a panel.
- The **first rendered slot** gets `.active` on both its button and its panel (so something shows even without JS).
- Paste the vanilla-JS panel switcher (`<script>` near `</body>`) from `STYLE_GUIDE.md` "Left section-nav (portable variant) — panel switcher". It toggles `.active`, supports `#anchor` deep-links, and needs no library.
- The **masthead** and **`.kb-summary`** live in a dedicated first panel `#overview` (nav label「项目总览」) — **not** outside panels. They appear **only** on that tab; content slots (一…十一、附录) show their own panel body without repeating the header.
- The old top horizontal `.sticky-nav` is **deprecated** — do not emit it.

### Overview panel (`#overview`) — masthead + summary (once only)

Every KB renders a fixed **overview** panel as the **first** nav button and the **default active** panel on load. It contains only:
1. `.masthead` (title, meta, Factor A/B/C stat-row, language toggle if bilingual)
2. `.kb-summary` (auto-generated ≤200-字 digest)

Do **not** duplicate masthead or `.kb-summary` inside slot panels. Slot panels start directly with their `<h2 class="section-title">`.

```html
<section class="block kb-panel active" id="overview">
  <header class="masthead">…</header>
  <div class="kb-summary">…</div>
</section>
<section class="block kb-panel" id="snapshot">…</section>
```

Nav: first button `data-target="overview"`, label「项目总览」, `.kb-nav-num` may use `◎` (not a Chinese numeral — overview is outside the 11-slot manifest).

### Auto-summary card (≤200 字, inside `#overview` only)

The `.kb-summary` card sits **inside `#overview` only** (not above 项目快照 in every tab). It is an **auto-generated ≤200-字 Chinese overview** that captures the project's profile + investment logic in one paragraph: what the asset is, who the counterparty is, indicative size, the core thesis, and current stage/maturity. Regenerate it on every re-render so it tracks the latest state. Keep it factual and non-advisory; certainty tags are not required inside the summary (it is a digest, not a data source). HTML/CSS: see `STYLE_GUIDE.md` `.kb-summary`.

```html
<div class="kb-summary">
  <p class="kb-summary-label">项目概览 · 自动生成</p>
  <p>[≤200 字：资产/标的 + 所在地 + 交易对手 + 指引价/规模 + 投资逻辑一句话 + 当前阶段与成熟度]</p>
</div>
```

### Partial vs empty — how to decide

| State | What it means | What renders |
|-------|---------------|--------------|
| **Populated** | Slot has hard evidence on ≥1 sub-topic | Full slot renders; missing sub-topics inside get inline "—— 待补充" lines |
| **Stub** | Slot has at least one explicit "缺乏资料" callout written by a skill *because the skill examined the corpus and found nothing* | Slot renders with the 缺乏资料 callout — this is the "tell the user what to upload" value |
| **Empty (hidden)** | No skill has yet touched this slot at all | Slot is hidden entirely; numbering skips it |

The default for a fresh KB is **everything Empty (hidden) except `snapshot`**. As skills run, slots transition Empty → Stub or Empty → Populated. A slot can also fall back from Stub to Empty if `document-reorganize` later determines the original "缺乏资料" prompt was speculative (rare).

## Workflow

### Step 1: Determine Mode

| Mode | Trigger | Action |
|------|---------|--------|
| **Create** | No `[AI] <项目名>_知识网络.html` exists | Build the HTML scaffold and render only the slots that already have data (typically just `snapshot` after intake) |
| **Update** | KB exists, a skill produced new findings | Locate target slot(s), merge/replace contents, re-render the whole HTML (renumbering happens automatically) |
| **Re-audit** | User says "refresh KB" or completeness drift detected | Re-evaluate every slot's state against the latest source corpus; slots may transition between Empty / Stub / Populated |

### Step 1.5: Entity Resolution (实体归并) — HARD RULE

Before writing any content, normalize all entities across the *entire* uploaded corpus. **The same entity must never appear under different names in the KB.**

1. **Build an entity master table** (held in working memory / 附录, not necessarily rendered): one canonical name per real-world entity (company, fund, SPV, government body, advisor firm), with all observed aliases mapped to it. E.g. `项目公司` = "Stone Island Holdings Pty Ltd" = "SIH" = "the Bowen entity" → all render as the one canonical name.
2. **Resolve person↔entity representation.** When a person speaks/acts *for* an entity, identify and label the representation relationship. Render as `张三（卖方 Stone Island Holdings 代表）` on first mention, and tag claims by that person with the entity, not just the name (e.g. `🟡 卖方` when 张三 is the seller's rep). Maintain a person↔entity map so a person who represents multiple entities is disambiguated per context.
3. **All references point to the canonical name.** Tables, org charts, citations, certainty-tag attributions, and the glossary all use the canonical name. Aliases may appear once in parentheses on first mention for traceability, then never again.
4. This runs on **Create** and re-runs on **Re-audit** (a later upload may reveal that two names are the same entity, or split one). When `document-reorganize` assigns source IDs it uses the same entity master table so source attributions stay consistent.

This rule directly feeds the certainty-tag attribution rule (Step 5): "哪个当事方" must be a *canonical* entity, not a stray alias.

### Step 2: For Each Slot — Decide State

For every one of the 11 slots + 2 appendices, classify into one of three states (see "Hide-and-renumber rule" above for definitions):

| State | When | What appears in the HTML |
|-------|------|--------------------------|
| **Populated** | Hard evidence exists (figures, dates, named parties, documents) | Slot renders. Tables / callouts / bullets with inline certainty tags + source links. Missing sub-topics inside the slot render as inline "—— 待补充" lines (NOT as a separate full 缺乏资料 callout that would dominate the slot). |
| **Stub** | A skill has explicitly recorded that it looked and found nothing actionable in the corpus, AND the absence is informative to the user (i.e. it tells them what to upload) | Slot renders. Body is a single `<aside class="callout missing">` block — see template in Step 4. |
| **Empty (hidden)** | No skill has yet evaluated this slot, or `document-reorganize` has cleared a speculative stub | Slot is omitted entirely. No `<section>`, no `<h2>`, no nav entry, no numeral. Subsequent slots renumber up. |

After classifying every slot, build the **render manifest**: an ordered array of `{slotKey, state, displayNumeral}` covering only Populated + Stub slots. The display numeral is assigned by enumerating the manifest 一/二/三…. This manifest drives both `<section>` emission and sticky-nav generation.

### Step 3: Apply Section-Specific Content Templates

Each section has a required sub-structure. If a sub-block has no data, render it as 缺乏资料.

#### 一、项目快照
- 项目名 / 所在地 / 资产类型
- 交易对手主体（法人名称）
- Indicative price / range
- 项目当前阶段
- 一句话定性（"Bare lead" / "Early stage" / "Mid stage" / "Mature"）
- 信息完备度（Factor A %）/ 来源多样性（Factor B %）/ 综合（Overall %）

#### 二、资产构成 / 平台能力与资源（类型自适应）

> **类型自适应 slot.** 这一节根据项目类型在两种渲染形态间二选一：

| 项目类型 | 渲染形态 | 标题 |
|----------|----------|------|
| **实物资产型**（地产、储能、基础设施、单一标的收购） | 资产构成（实物资产视角） | 二、资产构成（投资标的剖析、规划审批状态） |
| **平台 / 贸易型**（易货贸易、配额转口、平台撮合、轻资产运营） | 平台能力与资源（资源/能力视角） | 二、平台能力与资源 |

判定规则：标的核心价值来自**可登记的实物/产权资产**（土地、建筑、设备、IP、可转让合同）→ 实物资产形态；标的核心价值来自**关系、资质、网络、运营能力等无形资源**而非单一可估值资产 → 平台能力形态。混合型（如自有冷链 + 配额）以"投资对价主要为何买单"为准；说不清时默认实物资产形态并在节首注明判定依据。

**形态 A — 实物资产（实物资产型）**
- 物理资产清单（土地 / 建筑 / 设备 / 知识产权 / 客户合同）
- 规模数据（面积、产能、装机量等）
- 当前状态（在建 / 运营 / 待建 / 闲置）
- 规划审批状态：
  - 已取得的批文（名称、文号、有效期、发证机构）
  - 在审批文（提交日期、预计完成、风险点）
  - 缺失但必需的批文

**形态 B — 平台能力与资源（平台/贸易型）**
- 政府关系 / 政策资源（口岸关系、配额审批通道、地方背书）—— 注明深度与可持续性
- 资质与配额（易货贸易资质、进出口许可、特许经营、牌照），含有效期与可转让性
- 物流 / 冷链 / 仓储能力（自有 vs 租用、覆盖区域、产能）
- 平台获客 / 撮合能力（流量、商户网络、复购、撮合规模）
- 团队与 know-how（关键人依赖、可替代性）
- 每条资源标注：自有 / 绑定关键人 / 第三方依赖，以及"投资后是否随交易转移"

> **边界**：宏观背景类信息（口岸概况、区域贸易政策、行业大势等）**不是**本节的"资产/资源"，也不归入 section 四。处理规则：① 若某条宏观数据是用于支撑某个资产/资源条目的，作为该行表格的来源注释内联呈现（`来源`列或行内 `<sup>` 引用）；② 若属于投资论点层面的宏观支撑，归入 section 十一 决策框架的论据。**Section 2 本身不设"宏观背景"子块**，不论实物资产形态还是平台能力形态均适用。本节只放**标的自身**掌握/可调用的能力与资源。

#### 三、法律结构与关键关系网
- 持股架构图（项目公司 → 中间层 → 实控人）
- 关键关系人：实控人、董事、关联方
- 律师 / 会计 / 估值机构
- 关联交易识别
- 跨境结构（SPV、BVI、VIE 等）

#### 四、业务模式与收入假设（含外部调研）
> Target-company analysis only. Investor returns belong in 七.

**业务模式可视化（三选一，优先顺序判断）** —— 按以下顺序逐条判断，第一个命中的即为选用形式：

| 优先级 | 判定条件 | 选用 | HTML 类 |
|--------|---------|------|---------|
| 1 | 存在 **≥2 条实质性变现/退出路径**，路径之间互为替代或并行（如：多通道贸易、多退出策略的地产、多产品线分销） | **Journey Map** | `.journey` |
| 2 | **单条线性流程**，重点是各环节的利润拆解与增值分析（如：农业/制造/加工贸易，原料→加工→分销→终端） | **流程增值图 Process Flow** | `.process-flow` |
| 3 | **单一闭环价值创造机制**，价值主张/客户/成本结构相对固定（如：稳定运营的单一标的资产） | **Business Model Canvas** | `.bmc` |

> **注意**：行业类型不是判定依据——地产项目可能是 Journey Map（多退出策略），贸易项目也可能是价值链图（单条固定供应链）。判断的核心是**路径是否分叉**和**流程是否线性**。

> 若上述三种均不适合（如平台网络效应型、多方生态系统型），可考虑飞轮图（Flywheel）、收入拆解树（Revenue Tree）、生态系统图（Ecosystem Map）等替代形式，但这些没有标准模板，需手工构建，慎用。

三种形式的 HTML+CSS 模板见 `STYLE_GUIDE.md` "Business-Model Visualization (Section 四)"。

**收入与运营假设**（不论选哪种图，下列数据都要在图下以文字/表格给出）：
- 收入来源拆分（按产品 / 客户 / 地理 / 阶段）
- 单位经济假设：定价、毛利率、收入周期、产能利用率
- 主要客户 / 租户 / 用户名单（具体名称、合同金额、剩余期限）
- 关键运营假设（occupancy、价格涨幅、续约率、流失率等）
- 收入合同的可持续性、续约风险

**外部调研 Topic（融入本节，不再用 Q-01/Q-02 编号）**：
- 先针对该业务模式定义一组要调研的 **topic**（如 贸易类：口岸政策与配额、对手国货源稳定性、汇兑/结算合规、物流冷链可达性；地产类：区域规划、可比成交、审批进度、需求侧）。
- 用户在后续对话中补充的问题**不再孤立编号**，而是**归类到对应 topic 下**，作为该 topic 的待答/已答条目。
- 为控制全文长度，每个 topic 用**可点击展开**的 `<details class="topic">`（默认折叠，summary 显示标题 + 语义状态）。模板见 `STYLE_GUIDE.md` `.topic`。

**topic-count 用语义状态，不用数字计数**：

| 状态 | 写法示例 |
|------|---------|
| 尚未开始调研 | `待调研` |
| 有部分发现但有缺口 | `部分解答 · 高` / `部分解答 · Blocker` |
| 已有明确研究结论 | `研究结论 · 暂缓` / `研究结论 · 可行` |
| 完全解答 | `已解答` |

**`.topic-q` 追问来源标注规则**（有出处就标，无则省略）：
- 有录音/会议记录，知道发言人 → `<strong>会议追问（Jimmy，录音 00:01:30）：</strong>`
- 有明确提问人但无时间戳 → `<strong>追问（Jessica）：</strong>`
- 对话中用户补充，无具体归因 → `<strong>用户追问：</strong>`
- 调研中自己发现的缺口，非追问 → `<strong>残余缺口：</strong>` 或 `<strong>待验证：</strong>`

```html
<details class="topic">
  <summary>口岸政策与配额可持续性 <span class="topic-count">部分解答 · Blocker</span></summary>
  <div class="topic-body">
    <p>[topic 现有发现，带 certainty tag + 来源]</p>
    <p class="topic-q"><strong>会议追问（Jimmy，录音 00:01:30）：</strong>配额政策若调整，平台是否有替代通道？<span class="topic-q-status">待项目方</span></p>
    <p class="topic-q"><strong>用户追问：</strong>易货资质有效期？<span class="topic-q-status">已答：2027 到期 <span class="tag tag-party">🟡 项目方</span></span></p>
    <p class="topic-q"><strong>残余缺口：</strong>年度总配额规模未公开，需政府关系或现场咨询。<span class="topic-q-status">待验证</span></p>
  </div>
</details>
```

#### 五、融资结构与资本结构
> Sources & uses + capital stack. Investor return targets belong in 七.

- 总投资额拆解（土地 / 建设 / 营运资金 / 储备）
- 资金来源（自有 / 股权 / 债务 / 政府补贴 / 优先股）
- 现有股东结构与历史融资轮次（轮次、估值、领投方）
- 拟议交易结构（收购 / 增资 / 合作开发 / SPV 安排）
- 债务条款（贷款方、利率、抵押安排、covenant、还款期）

#### 六、市场对标与可比交易
> 本节只放**与标的直接可比的主体或交易**——能用来支撑估值或定价的 peers 数据。不是泛调研，不是背景信息。

**判断一条数据是否属于本节的唯一标准**：它能否用来支撑对标的估值或定价？能 → 放这里；不能 → 不放。

**永远不进本节**（无论什么项目类型）：
- 宏观市场规模数据（行业大盘、贸易总量、区域 GDP、进出口统计等）
- 调研背景信息（政策环境、行业趋势、口岸概况）
- 与标的业务模式不同的案例（用来"凑数"的泛案例）

上述信息若有用，归入 section 四 外部调研对应 topic，或作为行内来源引用，不在本节出现。

**有对标时**，内容包括：
- 已识别可比主体/交易表（名称、日期、规模、对价、估值倍数、业务模式相似点）
- 行业基准（cap rate / EV/EBITDA / 单价 / 单位经济，视行业而定）
- 项目相对 peers 的差异化定位与估值参照区间

**无对标时**（找不到直接可比的主体或交易）：
- 保留 `callout.missing` Stub，**不要用宏观数据填充**
- Stub 内列出"补充哪些信息可以激活本节"（如：同类企业名单、可访谈渠道、付费数据库来源）
- `callout-hint` 最后一句明确写：`在此之前不强行填充宏观统计或背景调研数据。`

```html
<aside class="callout missing">
  <p class="callout-title">⚠ 缺乏资料 — [对标类型] 案例</p>
  <p>尚未识别可公开核实的直接可比主体或交易。待补充项：</p>
  <ul>
    <li>[具体缺什么：如同类企业名单、历史交易数据、行业报告来源]</li>
  </ul>
  <p class="callout-hint">有线索后可触发 comp-analysis；在此之前不强行填充宏观统计或背景调研数据。</p>
</aside>
```

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
> **三子块竖排时间轴** — 本节拆成三个 `<h3>` 子块，不要合并成一张统一大表。两类信息必须一眼可见：8.1/8.2 标「重要性」，8.3 标「影响程度」。

- **8.1 已发生关键事件** — **层级展开（年→月→日）**：默认按**年份**折叠，每年一行**年度进展总结**；点击年份展开**月份**进展；若某月有日度数据再展开到 `.tl-item` 日级条目。用嵌套 `<details>`（`.tl-tree` > `.tl-year` > `.tl-month` > `.tl-item`，模板见 `STYLE_GUIDE.md` "Timeline — 层级展开（年→月→日）"），最近年份默认 `open`。每条日级 `.tl-item` 仍带「重要性」badge（`badge-red 关键` / `badge-amber 重要` / `badge-blue 一般`）+ certainty tag + 来源。仅当已发生事件 ≤4 条时可退回扁平 `.timeline`。
- **8.2 当前正在推进的事项** — 同样 `.timeline`，`.tl-item.pending`（橙点），每条带「重要性」badge。
- **8.3 未来关键节点** — 用表格，列为 `节点 | 预计时间 | 影响程度 | 结果触发行动`。影响程度用 badge：`badge-red 极高` / `badge-amber 中高 / 中` / `badge-blue 里程碑`。"结果触发行动"列写明该节点正/负结果分别触发什么动作（对照 STYLE_GUIDE 模板）。

子块顶部各放一行小字说明该 badge 表示「重要性」还是「影响程度」。完整 HTML 模板见 `STYLE_GUIDE.md` "Timeline（Section 八）— 竖排三子块"。

Multi-asset projects：在每个子块内按 asset 分组（`.tl-item` 前缀资产名）或在 8.3 表加 `asset` 列。

`node-monitoring` 把事件喂进这三个子块（按已发生/推进中/未来归类）—— 不产出自己单独的表。

#### 九、关键风险与缓释

- 风险矩阵（Likelihood × Impact）
- 每条 critical/high 风险：来源证据、当前 mitigation、责任人
- 红线风险（一旦触发须停止推进）
- 来自 七 敏感性分析的极度敏感变量同步登记为风险

#### 十、待项目方补充的信息
> 本节收录**仍须项目方/对方团队提供的信息缺口**，按所属 section 分组列出。用户日常追问的已解答/研究中部分已归入 section 四 外部调研对应 topic；本节只放"现在还缺、需要对方来补"的项目。

**section-lead 固定写法**：
> 会议与公开研究中的已解答部分已写入 [四 · 外部调研主题]（按路径折叠）。本节仅列仍须 [项目方名称] / 团队提供的缺口，按板块归集。

**结构**：按所属 section 分组，每组一张表，列为：

| 待补充项 | 紧迫度 | 负责方 | 详见 |
|---------|-------|-------|-----|

- **紧迫度** 用 badge：`badge-red Blocker`（阻塞决策）/ `badge-amber 高` / `badge-blue 中`
- **详见** 列用锚链接指回对应 section（如 `<a href="#business-model">四 · 平台共性</a>`）
- 按紧迫度排序，Blocker 置顶
- 若所有缺口已解决，本节降为 Stub 或隐藏（按 hide-and-renumber 规则）

```html
<p class="section-lead">会议与公开研究中的<strong>已解答部分</strong>已写入 <a href="#business-model">四 · 外部调研主题</a>（按路径折叠）。本节仅列仍须 [项目方] / 团队提供的缺口，按板块归集。</p>

<h3>[板块名，如：业务模式 · 配额与路径]</h3>
<table>
  <thead><tr><th>待补充项</th><th>紧迫度</th><th>负责方</th><th>详见</th></tr></thead>
  <tbody>
    <tr>
      <td>[具体缺什么]</td>
      <td><span class="badge badge-red">Blocker</span></td>
      <td>[负责人 / 渠道]</td>
      <td><a href="#[anchor]">[section编号 · topic名]</a></td>
    </tr>
  </tbody>
</table>

<h3>[板块名，如：主体、合作方与融资]</h3>
<table>
  <thead><tr><th>待补充项</th><th>紧迫度</th><th>负责方</th><th>详见</th></tr></thead>
  <tbody>
    <tr>
      <td>[具体缺什么]</td>
      <td><span class="badge badge-amber">高</span></td>
      <td>[负责人]</td>
      <td><a href="#[anchor]">[section编号]</a></td>
    </tr>
  </tbody>
</table>
```

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
| 🟡 当事方声明 | Claimed by a party (seller / project co / advisor); not independently confirmed | Default for most data from a CIM or seller deck — **MUST name the party** |
| 🔵 分析师推论 | Derived by analysis, not stated explicitly anywhere | Mark conclusions/projections/estimates — **MUST name the analysis source (AI vs human)** |
| ⚪ 待确认 | Mentioned but unverified, or partial information | Flag for follow-up |

**Attribution is mandatory for 🟡 and 🔵 (a bare dot is no longer acceptable):**

- 🟡 **当事方声明 → name *which* party** (use the canonical entity name from Step 1.5 Entity Resolution): `🟡 卖方` / `🟡 项目方` / `🟡 顾问 (XX 律所)` / `🟡 经纪`. Markup: `<span class="tag tag-party">🟡 <span class="tag-src">卖方</span></span>`.
- 🔵 **分析师推论 → name the analysis source: AI or internal human analyst**: `🔵 AI推论` / `🔵 内部分析师`（可加首字母）。Markup: `<span class="tag tag-analyst">🔵 <span class="tag-src">AI推论</span></span>`.
- ✅ / ⚪ need no attribution. For extra context that would crowd the pill, use the `.tag-attrib` italic suffix outside the tag (e.g. `(CIM p.12)`). Full markup spec: `STYLE_GUIDE.md` "Tags and badges (portable)".

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

After every update, recompute Factor A and Factor B. Update the header. If overall maturity crosses a tier boundary (Early → Mid → Mature), surface a notice in the chat response.

**Factor A** = mean completeness score across **all 11 canonical slots** (denominator is always 11, regardless of how many slots are currently rendered). Empty (hidden) slots score 0; Stub slots score per the stub's own self-rating (typically 5–15% — they're "we know what's missing" not "we have content"); Populated slots score per their internal sub-block coverage. This preserves the prompt to fill gaps — hiding a slot makes the document look tighter, but the maturity score still penalizes the absence.

**Factor B** = source diversity from 附录 A, unchanged. If 附录 A is itself hidden (no sources yet), Factor B is 0.

For multi-asset projects, Factor A is computed per-asset per-slot first, averaged within slot (across assets), then averaged across the full 11-slot canonical denominator. The header MUST surface the per-asset breakdown — never collapse to a single number.

### Step 10: KB Header & Shell Construction

The whole body is wrapped in the `.kb-shell` panel-switcher layout (see "Left section-nav (panel switcher)" above): `<div class="kb-shell"><nav class="kb-nav">…buttons…</nav><main class="kb-content">…panels only…</main></div>`. Emit **`#overview` first** (masthead + `.kb-summary`, default `.active`), then one `.kb-panel` per rendered slot/appendix. Each content slot renders as `<section class="block kb-panel" id="…">` with **no** masthead inside. Only `#overview`'s nav button and panel get `.active` on initial load. Paste the panel-switcher `<script>` before `</body>`.

The header itself is the `.masthead` two-column block defined in `STYLE_GUIDE.md` "### Masthead": left = title block, right = `.masthead-meta` data column, below = 3-colour `.stat-row`. Copy that structure; fill the project's values.

```html
<header class="masthead">
  <div class="masthead-split">
    <div class="masthead-main">
      <div class="masthead-badges">
        <span class="conf-badge">Confidential Investment Memorandum</span>
        <span class="ai-badge">🤖 AI 生成</span>
        <!-- Bilingual only: language toggle goes here -->
      </div>
      <h1><!-- 项目名 · 项目知识网络 --></h1>
      <p class="masthead-subtitle"><!-- English line · Knowledge Network · v1.0 --></p>
      <p class="masthead-lead"><!-- 一句话项目定位：地点 · 指引价 · 资金需求 · 卖方 · 阶段 --></p>
    </div>
    <aside class="masthead-meta" aria-label="文档元数据">
      <dl>
        <div class="meta-row"><dt>Version</dt><dd>v1.0</dd></div>
        <div class="meta-row"><dt>Date_stamp</dt><dd>2026-05-20</dd></div>
        <div class="meta-row"><dt>Deal_stage</dt><dd><span class="stage-pill">Mid-Stage</span></dd></div>
        <div class="meta-row"><dt>Report_status</dt><dd>卖方挂牌 · 待核实</dd></div>
      </dl>
    </aside>
  </div>
  <div class="stat-row">
    <div class="stat-item stat-item-a"><div class="stat-label">Factor A · 完备度</div><div class="stat-value">61%</div><p class="stat-note">11 slot 全渲染</p></div>
    <div class="stat-item stat-item-b"><div class="stat-label">Factor B · 来源多样性</div><div class="stat-value">54%</div><p class="stat-note">来源类型</p></div>
    <div class="stat-item stat-item-c"><div class="stat-label">综合成熟度</div><div class="stat-value">58%</div><p class="stat-note">Mid Stage</p></div>
  </div>
</header>
```

Rules:
- **`ai-badge` 始终显示**（白底描边），无论语言切换。`conf-badge` 是酒红实心。
- **`meta-row` 的 `dt` 文本不要手动加冒号或末尾「·」** —— 大写与字距由 CSS 控制，多加字符会渲染出 `REPORT_STATUS·` 这类多余符号。`Deal_stage` 的 `dd` 用黑色 `stage-pill`，其余 `dd` 为纯文本。
- **三个 stat 块固定语义**：`stat-item-a`=Factor A（浅米）/ `stat-item-b`=Factor B（中酒红）/ `stat-item-c`=综合成熟度（深酒红）。
- **多资产**：把 per-asset breakdown（如 `Wollar 62% · Moorabool 8%`）放进 Factor A 的 `stat-note`，不另起一块。
- **双语**：语言切换按钮放进 `.masthead-badges` 内，右对齐；只在 bilingual 模式渲染。
- 免责声明（"本文档非投资建议…"）放在页面底部 `.footer`，不再单列 `kb-disclosure` 段。

## Output Format



- **Chat**: Brief markdown — what changed in this update, which sections moved, new maturity scores, suggested next action
- **HTML file**: `[AI] <项目名>_知识网络.html` (note `[AI]` prefix is mandatory) — full re-render of the 11 sections + 2 appendices + header + changelog
- **Location**: Saved to the project folder root (same folder the user opened in Cowork)
- **CSS — copy, do NOT rewrite (this is the #1 cause of "KB came out with no colours/background")**: When **creating** a KB, copy the entire `<style>` block AND the three font `<link>` tags from `STYLE_GUIDE.md` section "Portable Stylesheet — 复制即用" *verbatim* into `<head>`. Do not paraphrase the token list into your own CSS, do not omit the block, do not invent class names. The HTML body you generate uses exactly the classes defined in that block (`.kb-shell`/`.kb-nav`/`.kb-nav-btn`/`.kb-content`/`.kb-panel`, `.kb-summary`, `.masthead`, `.section-title`, `.section-num`, `.tag-*`/`.tag-src`/`.tag-attrib`, `.badge-*`, `.callout.*`, `.scenario-cards`, `.org-chart`, `.timeline`/`.tl-item`, `.tl-tree`/`.tl-year`/`.tl-month`, `.bmc`, `.journey`, `.topic`, `.glossary-grid`, `.adv-grid`, `.valuation-box`, `.footer`, `.changelog`). When **updating** an existing KB, never strip or shrink the existing `<style>` block — edit only the content between sections.
- **Panel-switcher JS — also copy verbatim**: paste the vanilla-JS `<script>` from `STYLE_GUIDE.md` "Left section-nav" just before `</body>`. Without it the left buttons won't switch panels and (since `.kb-panel{display:none}`) only the first panel would ever show.
- **Self-check before saving**: confirm the saved file contains (1) `body{...background:var(--paper)...}` and at least one `--burgundy` rule, (2) a `.kb-shell` wrapper with `.kb-nav` buttons + `.kb-panel` sections, (3) exactly one `.kb-panel.active` on `#overview` + matching `.kb-nav-btn.active` on load, (4) the panel-switcher `<script>`, (5) masthead + `.kb-summary` **only** inside `#overview` (not repeated in slot panels). If any is missing, fix before returning.
- All other visual rules in `STYLE_GUIDE.md`

## Important Notes

- **Single source of truth**: All non-IC outputs go here. Do NOT create separate "layer" HTML files. Do NOT spread project information across multiple documents.
- **Hide-and-renumber, don't pad**: Empty slots are hidden, not filled with generic "暂无资料" placeholders. A 缺乏资料 callout is reserved for slots a skill has *actually examined* and found informative absences in — those are Stubs and they DO render. The distinction matters: a fresh KB right after intake should look short and clean, not bloated with eleven "to be filled" boxes.
- **Specific prompts, not generic**: A Stub 缺乏资料 callout that says "需要更多资料" is useless and disqualifies the slot from being a Stub at all (downgrade it to Empty). Real Stubs name file types, source parties, and what they would unlock.
- **Anchors and slot keys are stable; numerals are not**: When one skill needs to reference content in another slot, link to the anchor (`#returns`) or use the slot key, never the numeral ("第七节") — the numeral floats as the manifest changes.
- **Certainty tagging is non-negotiable, and 🟡/🔵 must be attributed**: An untagged fact is worse than no fact. 🟡 must name the party, 🔵 must name AI vs internal analyst. If unsure, mark ⚪ 待确认.
- **Atomic updates**: When a skill writes to multiple slots in one turn, do all writes + one version bump + one changelog entry + one re-render, not multiple bumps.
- **Maturity penalizes hiding**: Factor A's denominator is always 11. Hiding an empty slot doesn't game the score — only adding content does.
- **The KB feeds `ic-memo`**: When `/ic-memo` is invoked, it reads this HTML as primary input. A high-quality KB → high-quality memo with minimal extra work.
- **Auto-update on every conversation**: Any new info from the user in chat (even a casual "对了忘了说，项目方已经拿到 FIRB 批准了") must be classified into the right slot(s) and trigger an update, which may transition a slot from Empty → Populated and trigger renumbering.
