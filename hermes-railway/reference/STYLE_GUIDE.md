# Report Style Guide

description: Visual and typographic specification for the six Layer Report HTML documents. All skills that produce report output must conform to this guide. This file is the single source of truth for colors, typography, spacing, component patterns, and interaction behavior.

---

## Design Philosophy

Calm, clean, analytical, structured, typographic-driven.

These reports are internal investment research documents — not marketing material, not dashboards, not slide decks. Every visual decision serves information density and reading comfort. Nothing decorates; everything communicates.

**Reference points** (take the best, discard the rest):
- Claude Web UI — the restraint, the whitespace-to-content ratio, the font choices
- Notion dark mode — the structural clarity, but dialed back further
- Bridgewater Daily Observations / Economist Intelligence Unit — the density and seriousness of institutional research
- Academic typesetting (LaTeX / Tufte) — the hierarchy, the margin notes, the footnote discipline

**Anti-patterns** (never do these):
- Gradient backgrounds, glassmorphism, frosted blur
- Card-heavy layouts with rounded corners and drop shadows everywhere
- Bright accent colors, badges, pills, or status chips in saturated hues
- Marketing language, hero sections, call-to-action buttons
- Icon-heavy UI; decorative illustrations
- Animated transitions or scroll effects

---

## Color System

```
/* ── Base ── */
--bg-primary:       #FAFAFA;       /* page background — warm neutral, not pure white */
--bg-secondary:     #F2F2F3;       /* section background, alternating bands */
--bg-inset:         #EEEEF0;       /* inset boxes, code blocks, data tables */
--bg-hover:         #E8E8EA;       /* subtle hover state */

/* ── Text ── */
--text-primary:     #1F1F1F;       /* body text — deep charcoal, never pure black */
--text-secondary:   #6B7280;       /* captions, metadata, timestamps */
--text-tertiary:    #9CA3AF;       /* disabled, placeholder */
--text-inverse:     #FAFAFA;       /* text on dark backgrounds */

/* ── Accent ── */
--accent-primary:   #4A5568;       /* primary accent — muted blue-gray */
--accent-secondary: #6B7280;       /* secondary accent — neutral gray */
--accent-subtle:    #8B92A0;       /* links, interactive hints */

/* ── Semantic (low saturation, always) ── */
--verified:         #3D6B50;       /* ✅ verified fact — muted forest */
--verified-bg:      #F0F7F2;
--party-statement:  #8B7A2F;       /* 🟡 party statement — muted gold */
--party-statement-bg: #FAF8F0;
--analyst:          #4A5A7A;       /* 🔵 analyst inference — slate blue */
--analyst-bg:       #F0F3F8;
--unconfirmed:      #7A7A7A;       /* ⚪ unconfirmed — neutral gray */
--unconfirmed-bg:   #F5F5F5;
--risk-critical:    #8B3A3A;       /* red-brown, not fire-engine red */
--risk-critical-bg: #F8F0F0;
--risk-high:        #8B6B2F;       /* amber-brown */
--risk-high-bg:     #F8F5F0;
--risk-medium:      #5A6B4A;       /* olive */
--risk-low:         #6B7280;       /* gray */

/* ── Structure ── */
--border-light:     #E5E5E7;       /* table borders, dividers */
--border-medium:    #D1D5DB;       /* section separators */
--rule-accent:      #4A5568;       /* left-border accent on callout boxes */
```

**Rules:**
- No color has saturation above 40%.
- No pure black (#000000) anywhere.
- No pure white (#FFFFFF) as background — use #FAFAFA.
- Accent colors communicate meaning (certainty level, risk severity), never decoration.
- When in doubt, use more gray.

---

## Typography

```
/* ── Font Stack ── */
--font-body:        'Inter', 'SF Pro Text', -apple-system, system-ui, sans-serif;
--font-heading:     'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif;
--font-mono:        'JetBrains Mono', 'SF Mono', 'Consolas', monospace;

/* ── Scale ── */
--text-xs:          0.75rem;    /* 12px — footnotes, timestamps */
--text-sm:          0.8125rem;  /* 13px — captions, metadata */
--text-base:        0.9375rem;  /* 15px — body text */
--text-lg:          1.0625rem;  /* 17px — lead paragraphs */
--text-xl:          1.25rem;    /* 20px — H3 */
--text-2xl:         1.5rem;     /* 24px — H2 */
--text-3xl:         1.875rem;   /* 30px — H1 */
--text-4xl:         2.25rem;    /* 36px — report title */

/* ── Weight ── */
--weight-normal:    400;
--weight-medium:    500;
--weight-semibold:  600;

/* ── Line Height ── */
--leading-tight:    1.3;        /* headings */
--leading-normal:   1.65;       /* body text — generous for readability */
--leading-relaxed:  1.8;        /* long-form passages */

/* ── Letter Spacing ── */
--tracking-tight:   -0.01em;    /* headings */
--tracking-normal:  0;          /* body */
--tracking-wide:    0.05em;     /* ALL-CAPS labels, metadata */
```

**Rules:**
- Body text is 15px, not 14px (readability at information density).
- Line height for body is 1.65 — this is a reading document, not a UI.
- Headings use weight 600, never bold (700+).
- ALL-CAPS is reserved for structural labels only (e.g., "SECTION 3", "RISK MATRIX"), never for emphasis.
- No italic for emphasis — use weight 500 (medium) or the accent text color.
- Monospace font for: data values, IDs, code references, filenames.

---

## Layout & Spacing

```
/* ── Page ── */
--page-max-width:       860px;      /* optimal reading width */
--page-padding-x:       2.5rem;     /* side margins */
--page-padding-y:       3rem;       /* top/bottom */

/* ── Spacing Scale ── */
--space-1:    0.25rem;    /* 4px */
--space-2:    0.5rem;     /* 8px */
--space-3:    0.75rem;    /* 12px */
--space-4:    1rem;       /* 16px */
--space-6:    1.5rem;     /* 24px */
--space-8:    2rem;       /* 32px */
--space-12:   3rem;       /* 48px */
--space-16:   4rem;       /* 64px */
```

**Rules:**
- Maximum content width: 860px, centered. No full-bleed sections.
- Tables may extend to 960px if data requires it.
- Vertical rhythm: sections separated by `--space-12`, subsections by `--space-8`.
- No decorative whitespace — every gap serves hierarchy.

---

## Component Patterns

### Report Header

```html
<header class="report-header">
  <p class="report-meta">合域 AI · 联合家族办公室投资智库</p>
  <h1 class="report-title">尽职调查报告</h1>
  <p class="report-subtitle">Bakehouse Quarter · 悉尼 North Strathfield</p>
  <div class="report-info">
    <span>版本 1.2</span>
    <span>2026-05-18</span>
    <span>内部文件</span>
  </div>
</header>
```

Style: No background color. Title in `--text-4xl`, weight 600. Meta in `--text-sm`, `--text-secondary`, letter-spacing wide. Separated from content by a single 1px `--border-medium` rule.

### Section Headers

```html
<section>
  <div class="section-label">SECTION 3</div>
  <h2>背景调查</h2>
  <p class="section-lead">对交易对手及关键人员的身份、履历、司法记录进行系统核查。</p>
</section>
```

Style: Section label in `--text-xs`, `--text-tertiary`, ALL-CAPS, `--tracking-wide`. H2 in `--text-2xl`, weight 600. Lead paragraph in `--text-lg`, `--text-secondary`.

### Data Tables

```html
<table class="data-table">
  <thead>
    <tr>
      <th>字段</th>
      <th>国内</th>
      <th>海外</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="row-label">容积率</td>
      <td>2.5:1（规划条件）</td>
      <td>FSR 4:1（PRCUTS）</td>
    </tr>
  </tbody>
</table>
```

Style:
- No outer border. Inner borders `1px solid --border-light`.
- Header row: `--bg-secondary`, `--text-sm`, weight 500, `--text-secondary`.
- Body: `--text-base`, `--text-primary`.
- Row label (first column): weight 500.
- Alternating row backgrounds: `--bg-primary` / `--bg-secondary`.
- Cell padding: `--space-3` vertical, `--space-4` horizontal.
- No hover effects on table rows.

### Certainty Tags (inline)

```html
<span class="certainty verified">✅ 已核实</span>
<span class="certainty party">🟡 当事方声明</span>
<span class="certainty analyst">🔵 分析师推论</span>
<span class="certainty unconfirmed">⚪ 待确认</span>
```

Style: Inline, `--text-xs`, corresponding semantic color, no background — just text color. Tag appears immediately after the data point it qualifies.

### Callout Box (left-border accent)

```html
<aside class="callout">
  <p class="callout-title">关键发现</p>
  <p>DPHI 提案 FSR 仅 2.5:1，远低于 PRCUTS 规划的 4:1 和业主 Master Plan 的 4.62:1。</p>
</aside>
```

Style: 3px left border in `--rule-accent`. Background `--bg-secondary`. Padding `--space-4`. No rounded corners. Title in weight 500, `--text-sm`.

### Risk Severity Indicator

```html
<span class="risk critical">Critical</span>
<span class="risk high">High</span>
<span class="risk medium">Medium</span>
<span class="risk low">Low</span>
```

Style: `--text-xs`, corresponding risk color, no background fill — color text only. May appear inline or in table cells.

### Dual-Jurisdiction Comparison

```html
<div class="jurisdiction-compare">
  <div class="jurisdiction domestic">
    <p class="jurisdiction-label">🇨🇳 国内</p>
    <!-- content -->
  </div>
  <div class="jurisdiction overseas">
    <p class="jurisdiction-label">🌏 海外</p>
    <!-- content -->
  </div>
</div>
```

Style: Two-column grid. No background color difference — differentiated only by the label. Separated by a 1px vertical `--border-light` rule. Label in `--text-sm`, `--text-secondary`.

### Progress / Completeness

```html
<div class="completeness">
  <span class="completeness-label">信息完备度</span>
  <div class="completeness-bar">
    <div class="completeness-fill" style="width: 62%"></div>
  </div>
  <span class="completeness-value">62%</span>
</div>
```

Style: Bar height 4px. Fill color `--accent-primary`. Track color `--bg-inset`. No rounded ends.

---

## Output Architecture (Single Project Knowledge Base)

> **Major change in v0.2**: Instead of 6 separate layer reports, the plugin now maintains **a single living document per project** — the **Project Knowledge Base (项目知识网络)** — saved as `[AI] <项目名>_知识网络.html` in the project folder. All skills read from and write to sections of this single HTML file. The only exception is `ic-memo`, which exports a separate Microsoft Word document.

### The 11 canonical section slots (fixed slots, dynamic numbering)

The Project Knowledge Base has 11 canonical section *slots* plus 2 appendix slots, in a fixed order. The visible Chinese numerals (一/二/三…) are **assigned at render time** based on which slots actually render — empty slots are hidden and the surviving slots renumber consecutively. See `knowledge-base-generation/SKILL.md` "Hide-and-renumber rule" for the full algorithm. Slot keys and anchors are stable; only the numeral floats.

| # | Section (Chinese) | Anchor ID (HTML) | Skills that write here |
|---|-------------------|------------------|------------------------|
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

> **Critical conceptual distinction**: 四 is about **how the target company makes money** (its customers, pricing, unit economics) — it is target-company analysis. 七 is about **how the investor makes money on this deal** (IRR, MOIC, scenarios, sensitivity) — it is deal-economics analysis. Mixing the two corrupts both. `public-info-search` populates 四 from primary sources; `returns-analysis` populates 七 from modeling. Neither should leak into the other section.

Plus two appendices that are never numbered:
- **附录 A: 来源索引** (`#source-index`) — every document, URL, conversation cited anywhere in the KB. Maintained by `document-reorganize`.
- **附录 B: 术语表** (`#glossary`) — footnote definitions for every technical term flagged in the KB. Maintained by `term-annotator`.

### Lacking-information pattern (Stub slots only)

A 缺乏资料 callout is rendered only for **Stub** slots — slots a skill has actually examined and where the informative absence is worth flagging to the user. Truly empty slots (no skill has touched them yet, or only generic "no data") are hidden entirely, not padded with a callout. See `knowledge-base-generation/SKILL.md` Step 2 for the Populated / Stub / Empty classification. Example of a valid Stub:

```html
<section id="capital-structure">
  <div class="section-label">SECTION 五</div>
  <h2>融资结构与资本结构</h2>
  <aside class="callout missing">
    <p class="callout-title">⚠ 缺乏资料</p>
    <p>当前材料未提供具体投资额、股权对价或债务安排。需补充以下任一资料：</p>
    <ul>
      <li>卖方提供的 indicative pricing 或 term sheet 草案</li>
      <li>项目历史融资记录（轮次、估值、领投方）</li>
      <li>债务安排说明（贷款方、利率、还款期限）</li>
    </ul>
  </aside>
</section>
```

Style: callout with `--risk-medium` left border, `--bg-secondary` background, "⚠ 缺乏资料" title in `--text-sm` weight 500. The supplement prompt is bulleted, sector-aware.

### Auto-update behavior

When any skill produces new information, it must:
1. Identify which canonical slot(s) the new data belongs to (multiple slots allowed). Reference slots by slot key, not numeral.
2. Replace or merge with existing content in those slots. A slot may transition Empty → Stub, Empty → Populated, or Stub → Populated as a result.
3. If the slot was previously a Stub (缺乏资料 callout), replace the callout with the new content.
4. Add a row to the changelog at the bottom of the KB: `v1.x | 2026-MM-DD | <skill-name> | <slot key>: <one-line summary>`. Do not use the displayed numeral — it floats.
5. Re-render the entire HTML file. The render manifest (which slots are visible and what numeral each gets) is recomputed from scratch on every render — never patched in place.
6. Re-emit the left section-nav (`.kb-nav` buttons) and any internal cross-references from the render manifest. Hard-coded nav links are forbidden.

### Document version & header

The KB header carries a single version number that increments every time any section is updated:

```html
<header class="kb-header">
  <p class="kb-meta">合域 AI · 联合家族办公室投资智库</p>
  <h1 class="kb-title">项目知识网络</h1>
  <p class="kb-subtitle">Bakehouse Quarter · 悉尼 North Strathfield</p>
  <div class="kb-info">
    <span>v1.7</span>
    <span>2026-05-18 14:30</span>
    <span>信息完备度 62%</span>
    <span>内部文件</span>
  </div>
</header>
```

### IC Memo — separate Word doc

`ic-memo` is the only skill that does **not** write to the KB HTML. Instead it reads the entire KB as input and exports a separate `IC备忘录_<项目名>_<日期>.docx` for circulation to the investment committee. The KB is the "living source"; the IC memo is the "frozen snapshot for decision".

---

## Component: Glossary Footnote

Every専有名词 (technical term, regulatory abbreviation, industry-specific term, jargon) appearing in the KB must be linked to an entry in 附录 B: 术语表. Example terms that require annotation:
- 储能 / 电力: 构网型逆变器, LFP, 风机侧直流耦合, AEMO 注册, BESS, FCAS
- 房地产: DA (Development Application), FSR, GFA, FIRB, PRCUTS, RZ1
- 金融: term sheet, drag-along, ROFR, IRR, MOIC, waterfall
- 法律: SPV, BVI, VIE, 并购重组令

The first occurrence of each term in the KB body gets an inline footnote marker (e.g. `LFP<sup><a href="#term-lfp">¹²</a></sup>`). The marker links to 附录 B, where the term is defined in 1–2 sentences with optional source link.

```html
<!-- inline footnote marker -->
<p>项目计划部署 200MWh <span class="term">LFP<a href="#term-lfp" class="term-ref">¹²</a></span> 电池模组，采用 <span class="term">构网型逆变器<a href="#term-grid-forming" class="term-ref">¹³</a></span> ……</p>

<!-- in 附录 B -->
<dl class="glossary">
  <dt id="term-lfp">¹² LFP（磷酸铁锂电池）</dt>
  <dd>Lithium Iron Phosphate。储能项目主流电池化学体系，相比三元锂安全性更高、循环寿命更长，但能量密度较低。<a href="...">来源</a></dd>
  <dt id="term-grid-forming">¹³ 构网型逆变器（Grid-forming inverter）</dt>
  <dd>能主动提供电压、频率参考的逆变器，相比传统跟网型逆变器，在弱电网或离网场景下可独立建立稳定电网。</dd>
</dl>
```

Style: footnote markers in `--accent-subtle`, weight 400, font-size 0.7em, superscript. Glossary `<dl>` two-column, `<dt>` weight 500, `<dd>` `--text-secondary`.

---

## Interaction: Chat ↔ Knowledge Base

When a user triggers a skill in conversation (explicitly or via natural language):

1. **Chat response**: Return results as standard markdown — clean, conversational, directly useful.
2. **KB update**: Silently update the relevant sections of `[AI] <项目名>_知识网络.html`. If the section was a 缺乏资料 callout, replace it. Increment version + changelog entry.
3. **Term annotation**: If the new content introduces専有名词 not yet in 附录 B, automatically add glossary entries.
4. **No duplication concern**: The chat response and the KB section may have identical content. That's fine — the chat is for immediate consumption, the KB is for persistence and synthesis.
5. **Proactive prompts**: If a section is still 缺乏资料 after the skill completes, the chat response should end with a suggested next question or document to upload.

---

## File Naming Convention (AI-generated vs human-uploaded)

Every file produced by this plugin must be visually distinguishable from files the user uploaded. Use the `[AI]` bracket prefix universally:

| Artifact | Filename pattern |
|----------|------------------|
| Project Knowledge Base | `[AI] <项目名>_知识网络.html` |
| IC memo (Word) | `[AI] IC备忘录_<项目名>_<日期>.docx` |
| Any other generated artifact (charts, exports) | `[AI] <项目名>_<内容描述>_<日期>.<ext>` |

Rules:
- The `[AI]` bracket is in English (works across all locales/file systems).
- Bracket prefix sorts AI files together at the top of the folder.
- The KB header must also carry an explicit "AI 生成 / AI-generated" badge — never let the AI authorship status depend only on the filename, since some users will rename files.
- 附录 A · 来源索引 must tag each entry with `📄 用户上传` or `🤖 AI 生成`. Internal source-IDs use prefix `U-` (user) or `A-` (AI) so it's unambiguous in inline citations.

---

## Multi-Asset Project Rendering

Many investment opportunities contain **multiple sub-assets / targets** that must be analysed and decided as a package (e.g., a portfolio acquisition of two BESS sites, two adjacent land parcels, a multi-tower development). Per-asset information completeness is almost always asymmetric — one asset may be well-documented while another is barely-touched.

The KB must **never silently default to the better-documented asset**. Every asset-specific section partitions per asset, and missing-data assets get their own 缺乏资料 callout. Otherwise readers will misinterpret partial data as the complete picture.

### Detection

A project is multi-asset if `project-intake` Step 2 identifies ≥ 2 distinct sub-assets that share a single deal vehicle but have independent physical / contractual / approval characteristics.

Examples:
- Two BESS sites in one portfolio acquisition (e.g. Wollar + Moorabool)
- A multi-tower development (Tower A + Tower B + Tower C)
- A package of adjacent land parcels with different zoning
- A platform acquisition with multiple operating businesses

NOT multi-asset:
- A single project that happens to have multiple revenue lines
- One operating company with multiple branches under common management

### Section partitioning rule

When the project is multi-asset, the following sections **always render with per-asset subsections** (`<h3>` level), in stable asset order:
- 二 资产构成
- 三 法律结构与关键关系网 (if asset-level entity structure differs)
- 四 业务模式与收入假设
- 五 融资结构与资本结构 (if per-asset capital sourcing differs)
- 七 投资回报与敏感性分析
- 八 项目时间轴
- 九 关键风险与缓释 (some risks are deal-wide, some asset-specific — partition the asset-specific ones)

Sections that are deal-wide (not asset-partitioned): 一 项目快照 (deal-level), 六 市场对标 (industry-wide), 十 待确认问题清单 (cross-cutting), 十一 决策框架 (deal-level recommendation, with per-asset notes).

### Per-asset rendering template

```html
<section id="assets">
  <div class="section-label">SECTION 二</div>
  <h2>资产构成</h2>

  <div class="asset-block" data-asset="wollar">
    <h3>二.1 资产 A · Wollar BESS</h3>
    <p class="asset-meta">悉尼以西 280km · 500MW / 1000MWh · 已取得 DA</p>
    <!-- populated content -->
  </div>

  <div class="asset-block missing" data-asset="moorabool">
    <h3>二.2 资产 B · Moorabool BESS</h3>
    <aside class="callout missing">
      <p class="callout-title">⚠ Moorabool 暂无资料</p>
      <p>当前材料仅涵盖 Wollar 资产。Moorabool 在本节缺乏以下资料：</p>
      <ul>
        <li>场地选址与面积（卖方现场踏勘报告）</li>
        <li>规划审批进度（VIC 州 DA 状态）</li>
        <li>并网点与传输线接入方案</li>
      </ul>
      <p class="callout-hint">需要：向卖方追加资料请求；或公开搜索 Moorabool VIC AEMO 注册记录。</p>
    </aside>
  </div>
</section>
```

Style:
- `<h3>` asset titles use weight 500, `--text-lg`, with the deal-numbering prefix (二.1, 二.2).
- `.asset-meta` is a one-line dense subtitle in `--text-sm`, `--text-secondary` — gives orientation at a glance.
- `.asset-block.missing` has the same callout style as 缺乏资料, but its 缺乏资料 message names the asset explicitly ("Moorabool 暂无资料"), not just generic "缺乏资料".
- Asset order is stable across the whole KB — once 二.1 = Wollar, all per-asset subsections use the same ordering.

### Maturity scoring for multi-asset

Factor A is computed **per asset per section**, then averaged across assets to give the section score, then averaged across sections. The intake report and KB header must surface a **per-asset completeness breakdown**:

```
Overall maturity: 38%
├── Factor A (内容完备度): 35%   ← averaged across all assets × sections
│   ├── Wollar:    62%
│   └── Moorabool:  8%
└── Factor B (来源多样性): 42%
```

This makes asymmetry visible — without this view, a 35% mean could be reported as "early stage" when the truth is "Wollar is mid-stage, Moorabool is bare-lead".

---

## Bilingual Knowledge Base (overseas projects)

### When bilingual is required

`project-intake` Step 3 detects jurisdiction. If jurisdiction is **non-China** (overseas), the KB must render with both Chinese AND English content, plus a language toggle button. For domestic Chinese projects (jurisdiction = China mainland), Chinese only — no English version is generated.

### Default language

- Chinese is the default view, even for overseas projects (the primary readers are the family office investment team).
- Proper nouns (company names, project names, regulator names, geographic names) stay in their original language — e.g., "Wollar BESS" stays "Wollar BESS", not "沃拉电池储能项目", inside Chinese prose.
- Technical terms with established Chinese translations (e.g., 构网型逆变器) are translated; English-only acronyms (e.g., AEMO, FIRB) are kept in English.

### Language toggle component

Place a small, restrained toggle in the KB header, right-aligned:

```html
<div class="kb-lang-toggle">
  <button class="lang-btn active" data-lang="zh" aria-pressed="true">中文</button>
  <button class="lang-btn" data-lang="en" aria-pressed="false">English</button>
</div>
```

Style: two text-only buttons, `--text-sm`, separated by a 1px `--border-light` vertical rule. Active state: weight 500, `--text-primary`. Inactive: `--text-secondary`. No border on the buttons themselves. No animation on switch.

### Parallel content rule

Each translatable text block has both languages, marked with `lang` attribute:

```html
<aside class="callout">
  <div lang="zh">
    <p class="callout-title">关键发现</p>
    <p>DPHI 提案 FSR 仅 2.5:1，远低于业主 Master Plan 的 4.62:1。</p>
  </div>
  <div lang="en">
    <p class="callout-title">Key Finding</p>
    <p>DPHI's proposed FSR is only 2.5:1, far below the owner's Master Plan of 4.62:1.</p>
  </div>
</aside>
```

CSS / JS behavior (inline in the KB HTML, minimal):
```css
[lang="en"] { display: none; }
.kb-en-mode [lang="zh"] { display: none; }
.kb-en-mode [lang="en"] { display: block; }
```
```js
document.querySelectorAll('.lang-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    document.body.classList.toggle('kb-en-mode', btn.dataset.lang === 'en');
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === btn.dataset.lang);
      b.setAttribute('aria-pressed', b.dataset.lang === btn.dataset.lang);
    });
  })
);
```

### What does NOT need translation
- Source filenames in 附录 A (keep original)
- Proper nouns inline (already kept in original language)
- Numbers, dates, currencies (universal)
- Code, URLs

### Glossary in bilingual mode
`term-annotator` produces bilingual entries — both `<dt>` headword and `<dd>` definition have zh + en variants, controlled by the same language toggle.

---

## Tooltip-Enabled Citations and Glossary

Both **citations** `[x]` and **glossary term references** `*` must be:
1. **Clickable** — jump to the corresponding entry in 附录 A / 附录 B
2. **Hoverable** — show preview content as a hover popover, so readers don't have to navigate away

### Citation pattern

```html
<span class="cite-ref">
  <a href="#src-A-12">[12]</a>
  <span class="tooltip" role="tooltip">
    <span class="tooltip-title">🤖 AI 生成 · A-12</span>
    <span class="tooltip-source">DPHI Town Centres Strategy 2024.pdf, p.47</span>
    <span class="tooltip-preview">"…FSR for the precinct shall not exceed 2.5:1, subject to design excellence review…"</span>
  </span>
</span>
```

### Glossary term reference pattern

```html
<span class="term-ref">
  构网型逆变器<a href="#term-grid-forming" class="term-marker">*</a>
  <span class="tooltip" role="tooltip">
    <span class="tooltip-title">构网型逆变器 / Grid-forming inverter</span>
    <span class="tooltip-preview">能主动建立电网电压与频率参考的逆变器，相比跟网型逆变器，在弱电网或离网场景下可独立提供稳定电网。</span>
  </span>
</span>
```

### Style spec

```css
.cite-ref, .term-ref { position: relative; cursor: pointer; }
.cite-ref a, .term-marker {
  color: var(--accent-subtle);
  text-decoration: none;
  font-size: 0.75em;
  vertical-align: super;
}
.tooltip {
  display: none;
  position: absolute;
  bottom: 100%; left: 0;
  width: 320px;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  z-index: 100;
}
.cite-ref:hover .tooltip,
.term-ref:hover .tooltip,
.cite-ref:focus-within .tooltip,
.term-ref:focus-within .tooltip {
  display: block;
}
.tooltip-title {
  display: block;
  font-weight: 500;
  margin-bottom: var(--space-1);
  color: var(--text-primary);
}
.tooltip-source { display: block; color: var(--text-secondary); font-size: var(--text-xs); margin-bottom: var(--space-2); }
.tooltip-preview { display: block; color: var(--text-primary); }
```

Behavioral rules:
- Tooltip appears on hover AND on keyboard focus (`:focus-within`) — accessibility requirement.
- Tooltip body is plain text (1–3 lines for citations; 1 sentence for glossary). No images, no nested links.
- Citation tooltip ALWAYS shows the source identity (filename + page) and a verbatim excerpt where possible.
- Glossary tooltip ALWAYS shows the bilingual term head + 1-sentence definition.
- No animation on appear (per "Do Not animate" rule). Use plain display:none/block toggle.

### Marker character convention

- Citations: square-bracket numeric `[12]` (preserves the traditional academic look).
- Glossary first-occurrence marker: superscript asterisk `*` (compact, doesn't compete visually with citations).
- The historical superscript-number style for glossary (`¹³`) is **deprecated in v0.4** — switch to `*` to keep visual difference from citations and to support arbitrary glossary growth without numeric collision.

---

## Timeline (Section 八) — 竖排三子块

> **8.1 升级提示**：8.1 已发生事件**优先**用下文 "Timeline — 层级展开（年→月→日）" 的 `.tl-tree` 嵌套 `<details>` 形态（默认按年折叠 + 年度总结）。只有当全部已发生事件 ≤ 4 条、不值得分层时，才退回本节下面的扁平 `.timeline` 写法。8.2 / 8.3 不变。

Section 八 项目时间轴 拆成 **三个 `<h3>` 子块**，不要合并成统一大表。目标：两类信息一眼可见 —— **8.1 已发生 / 8.2 推进中** 标「重要性」（对本次投资判断的权重），**8.3 未来关键节点** 标「影响程度」+「结果触发行动」。

8.1 / 8.2 用左轨竖排 `.timeline` / `.tl-item`（8.2 用 `.tl-item.pending`，橙点）；8.3 用表格。class 均已在 "Portable Stylesheet — 复制即用" 中定义。

```html
<section class="block" id="timeline">
  <h2 class="section-title"><span class="section-num">八</span>项目时间轴 / Timeline</h2>
  <p class="section-sub">已发生事件 · 当前推进 · 未来关键节点</p>

  <h3>8.1 已发生关键事件</h3>
  <p style="font-size:.75rem;color:#888;margin-bottom:.5rem">右侧 badge 表示<strong>重要性</strong>（对本次投资判断的权重）</p>
  <div class="timeline">
    <div class="tl-item"><span class="tl-date">2023-08-23</span><span class="tl-text">取得 DA Preliminary Approval（文号 20220452）<span class="badge badge-red">关键</span> <span class="tag tag-verified">✅</span> <sup>[S-DA]</sup></span></div>
    <div class="tl-item"><span class="tl-date">2024-07-09</span><span class="tl-text">Lot 124 上设立抵押（对应存量债）<span class="badge badge-amber">重要</span> <span class="tag tag-verified">✅</span> <sup>[S-TIT]</sup></span></div>
  </div>

  <h3>8.2 当前正在推进的事项</h3>
  <p style="font-size:.75rem;color:#888;margin-bottom:.5rem">右侧 badge 表示<strong>重要性</strong></p>
  <div class="timeline">
    <div class="tl-item pending"><span class="tl-date">进行中</span><span class="tl-text">EOI 销售活动 + 投资人接触<span class="badge badge-red">关键</span> <span class="tag tag-party">🟡</span> <sup>[U-EM]</sup></span></div>
  </div>

  <h3>8.3 未来关键节点</h3>
  <p style="font-size:.75rem;color:#888;margin-bottom:.5rem">badge 表示该节点对项目的<strong>影响程度</strong>；末列为结果触发的行动</p>
  <table>
    <tr><th>节点</th><th>预计时间</th><th>影响程度</th><th>结果触发行动</th></tr>
    <tr class="highlight-row"><td><strong>入场结构与抵押优先级理清</strong></td><td>尽调早期</td><td><span class="badge badge-red">极高</span></td><td>正面→可推进；未清→暂停决策</td></tr>
    <tr><td>Stage 1 完成投产</td><td>18 月–2.5 年</td><td><span class="badge badge-amber">中高</span></td><td>现金流启动，支撑再融资</td></tr>
    <tr><td>大型外部窗口（如奥运 / 政策截止）</td><td>—</td><td><span class="badge badge-blue">里程碑</span></td><td>退出 / 再融资锚点</td></tr>
  </table>

  <div class="partial-line">—— 待补充：本节缺失的具体节点时点（LOI / TS / 审批截止等）</div>
</section>
```

### 子块内容规则

- **8.1 已发生 / 8.2 推进中**：每条 `.tl-item` 末尾依次是 ——「重要性」badge（`badge-red 关键` / `badge-amber 重要` / `badge-blue 一般`）+ certainty tag（✅/🟡/🔵/⚪）+ 来源 `<sup>`。8.2 用 `.tl-item.pending`。
- **8.3 未来关键节点**：表格列固定为 `节点 | 预计时间 | 影响程度 | 结果触发行动`。影响程度 badge：`badge-red 极高` / `badge-amber 中高`、`中` / `badge-blue 里程碑`。"结果触发行动"必须写正/负结果分别触发什么动作，不能只写"重要"。阻塞级节点用 `tr.highlight-row` 高亮。

### 排序与截断
- 8.1 按日期升序；8.2 无固定日期的锚在其开始时点；8.3 按预计时间升序。
- 8.1 已发生事件超过 10 条时，最早的折进 `<details>` 展开器。

### Multi-asset
多资产项目：在每个子块内按 asset 分组（`.tl-item` 文本前缀资产名），或给 8.3 表加 `asset` 列 + 顶部 filter 按钮。

`node-monitoring` 把事件按"已发生 / 推进中 / 未来"喂进对应子块 —— 不产出自己单独的表。


## Business-Model Visualization (Section 四) — Journey Map 或 Business Model Canvas

Slot `business-model` chooses **one** of two visual forms based on project type (selection rule lives in `knowledge-base-generation/SKILL.md` slot 四):

- **贸易 / 多路径类**（易货、配额、转口、多通道分销）→ **Journey Map**：横向阶段轴 + 多条平行路径泳道，每条路径像分支散开，直观表现"同一笔货可走多条变现路径"。
- **地产收购开发 / 单一标的资产类** → **Business Model Canvas**：经典 9 宫格。

两种组件都用米色酒红配色，class 已在 "Portable Stylesheet — 复制即用" 中定义。

### Business Model Canvas template (9-grid)

```html
<div class="bmc">
  <div class="bmc-cell bmc-kp"><h5>Key Partners 关键伙伴</h5><ul><li>地方政府 / 规划局</li><li>总包施工方</li></ul></div>
  <div class="bmc-cell bmc-ka"><h5>Key Activities 关键活动</h5><ul><li>报批报建</li><li>开发建设</li></ul></div>
  <div class="bmc-cell bmc-kr"><h5>Key Resources 关键资源</h5><ul><li>土地 / DA 批文</li><li>开发资金</li></ul></div>
  <div class="bmc-cell bmc-vp"><h5>Value Propositions 价值主张</h5><ul><li>稀缺近岸岛屿旅游资产</li><li>已获 DA 的开发权</li></ul></div>
  <div class="bmc-cell bmc-cr"><h5>Customer Relationships 客户关系</h5><ul><li>长租 / 会员</li></ul></div>
  <div class="bmc-cell bmc-ch"><h5>Channels 渠道</h5><ul><li>OTA / 直销</li></ul></div>
  <div class="bmc-cell bmc-cs"><h5>Customer Segments 客户细分</h5><ul><li>高端度假客</li><li>活动 / 婚庆</li></ul></div>
  <div class="bmc-cell bmc-cost"><h5>Cost Structure 成本结构</h5><ul><li>土地 + 建设 capex</li><li>运营 opex</li></ul></div>
  <div class="bmc-cell bmc-rev"><h5>Revenue Streams 收入来源</h5><ul><li>客房 / 餐饮</li><li>地块溢价退出</li></ul></div>
</div>
```

### Journey Map template (多路径分支)

```html
<div class="journey">
  <!-- stage axis -->
  <div class="journey-stages">
    <div class="journey-stage">货源采购</div>
    <div class="journey-stage">通关 / 配额</div>
    <div class="journey-stage">物流 / 仓储</div>
    <div class="journey-stage">变现</div>
  </div>
  <!-- path 1 -->
  <div class="journey-lane">
    <div class="journey-lane-label">路径 A · 易货</div>
    <div class="journey-node">国内工业品</div>
    <div class="journey-node">口岸易货配额</div>
    <div class="journey-node">冷链 / 集货</div>
    <div class="journey-node">换回农产品转销</div>
  </div>
  <!-- path 2 -->
  <div class="journey-lane">
    <div class="journey-lane-label">路径 B · 现汇</div>
    <div class="journey-node">同上货源</div>
    <div class="journey-node empty">—</div>
    <div class="journey-node">直发终端</div>
    <div class="journey-node">现汇结算</div>
  </div>
  <!-- add more .journey-lane blocks for additional branches -->
</div>
```

规则：阶段数 = `.journey-stage` 个数，每条 `.journey-lane` 的 `.journey-node` 个数必须与阶段数一致（某路径跳过的阶段用 `.journey-node.empty` 占位，保持对齐）。路径多于 3 条时整体横向滚动（`.journey` 已设 `overflow-x:auto`）。

## Timeline (Section 八) — 层级展开（年→月→日）

> **v0.5 upgrade**：8.1 已发生关键事件 由扁平竖排升级为 **可逐级展开的层级视图** —— 默认按**年份**折叠，每年一行**年度进展总结**；点击年份展开该年**月份**进展；若某月有日度更细数据，再展开到 `.tl-item` 日级条目。8.2 推进中 / 8.3 未来节点保持原形态（8.2 竖排 `.timeline.pending`、8.3 表格）。层级用嵌套 `<details>`（`.tl-year` > `.tl-month` > `.tl-item`），无需 JS，配色不变。

```html
<h3>8.1 已发生关键事件（按年展开）</h3>
<p style="font-size:.75rem;color:#888;margin-bottom:.5rem">默认折叠到年；展开看月，再展开看日。badge 表示<strong>重要性</strong></p>
<div class="tl-tree">
  <details class="tl-year" open>
    <summary>2024 <span class="tl-year-sum">取得 DA 批文、完成抵押登记，进入挂牌期</span></summary>
    <div class="tl-year-body">
      <details class="tl-month">
        <summary>07 月</summary>
        <div class="tl-month-body">
          <div class="timeline"><div class="tl-item">
            <span class="tl-date">2024-07-09</span>
            <span class="tl-text">Lot 124 设立抵押 <span class="badge badge-amber">重要</span>
              <span class="tag tag-verified">✅</span> <sup>[S-TIT]</sup></span>
          </div></div>
        </div>
      </details>
      <details class="tl-month">
        <summary>08 月 <span class="tl-year-sum">DA 预批</span></summary>
        <div class="tl-month-body">
          <div class="timeline"><div class="tl-item">
            <span class="tl-date">2024-08-23</span>
            <span class="tl-text">取得 DA Preliminary Approval（20220452）<span class="badge badge-red">关键</span>
              <span class="tag tag-verified">✅</span> <sup>[S-DA]</sup></span>
          </div></div>
        </div>
      </details>
    </div>
  </details>
  <details class="tl-year">
    <summary>2023 <span class="tl-year-sum">前期接洽与尽调启动</span></summary>
    <div class="tl-year-body">
      <details class="tl-month"><summary>11 月</summary>
        <div class="tl-month-body"><div class="timeline"><div class="tl-item">
          <span class="tl-date">2023-11</span><span class="tl-text">首次接触卖方
            <span class="badge badge-blue">一般</span> <span class="tag tag-party">🟡 <span class="tag-src">经纪</span></span></span>
        </div></div></div>
      </details>
    </div>
  </details>
</div>
```

规则：
- 最近年份默认 `open`，其余年份折叠。
- 年/月 summary 末尾的 `.tl-year-sum` 是该层一句话进展总结（年度必填，月度可选）。
- 没有日级数据时，月级 body 直接放该月的 `.tl-item`；连月份都无细分时，可只展开到年、在 `.tl-year-body` 直接放 `.timeline`。
- 每个 `.tl-item` 仍带「重要性」badge + certainty tag + 来源 `<sup>`，与旧版一致。

## Portable Visual Variant (米色 · 酒红 · Playfair)

The KB has two rendering themes that share the same component DOM, slot system, and dynamic-numbering logic:

- **Default theme** — neutral grays / Inter, defined in §Color System and §Typography above. Used for everything else.
- **Portable theme** — warm paper background, burgundy accent, Playfair Display headings. Used when the KB must be deliverable to external parties (IC, family principals, advisors) as a self-contained HTML file. Triggered by `project-intake` Step 2 setting `theme: portable`, or by the user phrase "做成 portable / 出一份 portable 版" anywhere.

Both themes obey the same Do-Not list at the end of this guide. The portable theme is *more typographic* but is not "richer" — same density, same hierarchy, same restraint.

### Portable Stylesheet — 复制即用（DO NOT rewrite）

> **This is the single source of the portable look.** When `knowledge-base-generation` creates a KB, it MUST copy this entire `<style>` block verbatim into `<head>` — do NOT paraphrase, re-derive, or hand-write your own CSS from the token list below. The token list and component notes that follow this block are **reference documentation only**; this block is the authoritative implementation. If colours/background are missing in a rendered KB, it is almost always because this block was not copied in.

Also copy these two `<link>` tags into `<head>` (Google Fonts, with built-in fallback so offline still renders):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
```

```html
<style>
:root{--paper:#f5f0e8;--ink:#2d241e;--ink-soft:#4a4540;--ink-faint:#888;--burgundy:#722f37;--serif:"Playfair Display","Noto Serif SC",Georgia,serif;--sans:"Inter","Noto Sans SC","PingFang SC",system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--sans);font-size:15px;line-height:1.65;color:var(--ink);background:var(--paper);background-image:url("https://www.transparenttextures.com/patterns/natural-paper.png");-webkit-font-smoothing:antialiased}
/* ── Left vertical section nav (replaces top sticky-nav) + content layout ── */
.kb-shell{display:grid;grid-template-columns:15.5rem minmax(0,1fr);gap:0;max-width:84rem;margin:0 auto;align-items:start}
.kb-nav{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;padding:2.5rem 1rem 2.5rem 2rem;background:rgba(114,47,55,.04);border-right:1px solid rgba(114,47,55,.14)}
.kb-nav-title{font-family:var(--serif);font-size:.95rem;font-style:italic;color:var(--burgundy);margin-bottom:1.1rem;line-height:1.3}
.kb-nav ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem}
.kb-nav-btn{display:flex;align-items:center;gap:.55rem;width:100%;text-align:left;font-family:var(--sans);font-size:.78rem;font-weight:600;line-height:1.3;color:var(--burgundy);background:transparent;border:1px solid rgba(114,47,55,.28);border-radius:4px;padding:.5rem .7rem;cursor:pointer;transition:background .12s,color .12s}
.kb-nav-btn:hover{background:rgba(114,47,55,.1)}
.kb-nav-btn .kb-nav-num{flex-shrink:0;width:1.4rem;height:1.4rem;border-radius:50%;border:1px solid rgba(114,47,55,.4);display:inline-flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700}
.kb-nav-btn.active{background:var(--burgundy);color:#fff;border-color:var(--burgundy)}
.kb-nav-btn.active .kb-nav-num{border-color:rgba(255,255,255,.55);color:#fff}
.kb-content{padding:4rem 2.5rem;min-width:0}
/* panel switching: only the active panel shows */
.kb-panel{display:none}
.kb-panel.active{display:block;animation:none}
.wrap{max-width:72rem;margin:0 auto;padding:4rem 2rem}
/* mobile: nav collapses to a top toggle + horizontal scroller */
.kb-nav-toggle{display:none}
@media(max-width:860px){
  .kb-shell{grid-template-columns:1fr}
  .kb-nav{position:static;height:auto;border-right:none;border-bottom:1px solid rgba(114,47,55,.14);padding:1rem 1.25rem}
  .kb-nav ul{flex-direction:row;flex-wrap:wrap;gap:.4rem}
  .kb-nav-btn{width:auto}
  .kb-content{padding:2.5rem 1.25rem}
}
/* ── Auto-summary card (above section 1) ── */
.kb-summary{background:#efe7da;border-left:4px solid var(--burgundy);border-radius:0 6px 6px 0;padding:1.25rem 1.5rem;margin:0 0 2.5rem}
.kb-summary .kb-summary-label{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgba(114,47,55,.7);margin-bottom:.45rem}
.kb-summary p{font-size:.92rem;line-height:1.7;color:var(--ink);margin:0}
/* ── Certainty tag attribution (party / analyst source labels) ── */
.tag .tag-src{font-weight:700}
.tag-attrib{font-size:.62rem;color:var(--ink-faint);font-style:italic;margin-left:.15rem}
/* ── Collapsible research topic (section 外部调研) ── */
.topic{border:1px solid rgba(114,47,55,.16);border-radius:6px;margin:.85rem 0;background:rgba(255,255,255,.4);overflow:hidden}
.topic>summary{list-style:none;cursor:pointer;padding:.85rem 1.1rem;display:flex;align-items:center;gap:.6rem;font-family:var(--serif);font-style:italic;font-size:1rem;color:var(--burgundy)}
.topic>summary::-webkit-details-marker{display:none}
.topic>summary::before{content:"▸";font-style:normal;font-size:.7rem;color:var(--burgundy);transition:transform .12s}
.topic[open]>summary::before{transform:rotate(90deg)}
.topic>summary .topic-count{margin-left:auto;font-family:var(--sans);font-style:normal;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-faint)}
.topic-body{padding:0 1.1rem 1rem 2.1rem}
.topic-body .topic-q{font-size:.85rem;color:var(--ink-soft);margin:.4rem 0;padding-left:.75rem;border-left:2px solid rgba(114,47,55,.2)}
.topic-q .topic-q-status{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-left:.4rem}
/* ── Business Model Canvas (9-grid) ── */
.bmc{display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:auto auto;gap:1px;background:rgba(114,47,55,.18);border:1px solid rgba(114,47,55,.18);margin:1.25rem 0}
.bmc-cell{background:var(--paper);padding:.85rem .9rem;min-height:6rem}
.bmc-cell h5{font-family:var(--sans);font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--burgundy);margin:0 0 .4rem}
.bmc-cell ul{margin:0 0 0 1rem;padding:0;font-size:.78rem;color:var(--ink-soft);line-height:1.5}
.bmc-cell li{margin-bottom:.2rem}
.bmc-kp{grid-row:1/2}.bmc-ka{grid-column:2/3;grid-row:1/2}.bmc-kr{grid-column:2/3;grid-row:2/3}
.bmc-vp{grid-column:3/4;grid-row:1/3;background:rgba(114,47,55,.06)}
.bmc-cr{grid-column:4/5;grid-row:1/2}.bmc-ch{grid-column:4/5;grid-row:2/3}
.bmc-cs{grid-column:5/6;grid-row:1/3}
.bmc-cost{grid-column:1/4;grid-row:3/4}.bmc-rev{grid-column:4/6;grid-row:3/4}
@media(max-width:760px){.bmc{grid-template-columns:1fr}.bmc-cell{grid-column:auto!important;grid-row:auto!important}}
/* ── Journey Map (horizontal stages + parallel path lanes) ── */
.journey{margin:1.25rem 0;overflow-x:auto}
.journey-stages{display:flex;gap:0;min-width:38rem}
.journey-stage{flex:1;text-align:center;font-family:var(--sans);font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--burgundy);padding:.45rem .3rem;border-bottom:2px solid var(--burgundy)}
.journey-lane{display:flex;gap:0;min-width:38rem;align-items:stretch;margin-top:.6rem}
.journey-lane-label{flex:0 0 7rem;font-size:.72rem;font-weight:700;color:var(--burgundy);display:flex;align-items:center;padding-right:.5rem}
.journey-node{flex:1;background:rgba(255,255,255,.5);border:1px solid rgba(114,47,55,.2);margin:.15rem;border-radius:5px;padding:.55rem .6rem;font-size:.74rem;color:var(--ink-soft);position:relative}
.journey-node.empty{background:transparent;border:1px dashed rgba(114,47,55,.15)}
.journey-path{position:relative;padding-left:1rem;margin:.3rem 0}
.journey-path::before{content:"";position:absolute;left:.25rem;top:.6rem;bottom:.6rem;width:2px;background:rgba(114,47,55,.2)}
/* ── Hierarchical (year→month→day) timeline ── */
.tl-tree{margin:1rem 0}
.tl-year{border:1px solid rgba(114,47,55,.16);border-radius:6px;margin:.6rem 0;background:rgba(255,255,255,.4);overflow:hidden}
.tl-year>summary{list-style:none;cursor:pointer;padding:.8rem 1.1rem;display:flex;align-items:center;gap:.7rem;font-family:var(--serif);font-size:1.1rem;color:var(--burgundy)}
.tl-year>summary::-webkit-details-marker{display:none}
.tl-year>summary::before{content:"▸";font-size:.7rem;transition:transform .12s}
.tl-year[open]>summary::before{transform:rotate(90deg)}
.tl-year-sum{margin-left:auto;font-family:var(--sans);font-size:.72rem;font-style:italic;color:var(--ink-soft);font-weight:400}
.tl-year-body{padding:.2rem 1.1rem 1rem 1.6rem}
.tl-month{border-left:2px solid rgba(114,47,55,.18);margin:.4rem 0 .4rem .3rem}
.tl-month>summary{list-style:none;cursor:pointer;padding:.45rem .8rem;font-size:.82rem;font-weight:700;color:var(--burgundy)}
.tl-month>summary::-webkit-details-marker{display:none}
.tl-month>summary::before{content:"▸";font-size:.6rem;margin-right:.4rem;display:inline-block;transition:transform .12s}
.tl-month[open]>summary::before{transform:rotate(90deg)}
.tl-month-body{padding:.1rem 0 .4rem 1.1rem}
.masthead{border-bottom:2px solid var(--burgundy);padding-bottom:3rem;margin-bottom:5rem}
.masthead-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(10.5rem,14rem);gap:2.5rem 3rem;align-items:start;margin-bottom:2rem}
@media(max-width:760px){.masthead-split{grid-template-columns:1fr;gap:1.75rem}.masthead-meta{max-width:16rem}}
.masthead-badges{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:1.1rem}
.conf-badge{display:inline-block;background:var(--burgundy);color:#fff;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.58rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:.32rem .6rem;border-radius:2px}
.ai-badge{display:inline-block;font-size:.58rem;color:var(--burgundy);border:1px solid rgba(114,47,55,.28);padding:2px 6px;border-radius:2px;font-weight:600;letter-spacing:.04em;background:rgba(255,255,255,.4)}
.masthead h1{font-family:var(--serif);font-size:clamp(1.85rem,4.2vw,3rem);color:var(--burgundy);line-height:1.12;margin-bottom:.65rem;max-width:28rem}
.masthead h1 .sub{font-size:clamp(1.25rem,3vw,2rem);opacity:.85;font-style:italic;font-weight:400;display:block;margin-top:.35rem}
.masthead-subtitle{font-size:.78rem;color:var(--ink-faint);font-weight:400;letter-spacing:.02em;line-height:1.45;margin-bottom:1.1rem;max-width:32rem}
.masthead-lead{font-size:.92rem;color:var(--ink-soft);font-weight:400;line-height:1.7;max-width:36rem}
.masthead-meta{margin:0;padding-top:.15rem}
.masthead-meta dl{margin:0}
.meta-row{display:grid;grid-template-columns:1fr auto;gap:.75rem 1.25rem;padding:.6rem 0;border-bottom:1px solid rgba(114,47,55,.12);align-items:center}
.meta-row:first-child{padding-top:0}
.meta-row:last-child{border-bottom:none;padding-bottom:0}
.meta-row dt{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.56rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#999;margin:0}
.meta-row dd{font-size:.78rem;font-weight:600;color:var(--ink);text-align:right;margin:0;white-space:nowrap}
.stage-pill{display:inline-block;background:#1a1a1a;color:#fff;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:.28rem .55rem;border-radius:2px}
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:2rem;background:rgba(114,47,55,.18)}
@media(max-width:800px){.stat-row{grid-template-columns:1fr}}
.stat-item{padding:1.25rem 1.35rem;border-left:none;min-height:6.5rem;display:flex;flex-direction:column;justify-content:center}
.stat-item-a{background:#e6ddd1;color:var(--ink)}
.stat-item-a .stat-label{color:rgba(45,36,30,.62)}
.stat-item-a .stat-value{color:var(--burgundy)}
.stat-item-a .stat-note{color:rgba(45,36,30,.58);font-style:italic}
.stat-item-b{background:#8f4a52;color:#fff}
.stat-item-b .stat-label{color:rgba(255,255,255,.78)}
.stat-item-b .stat-value{color:#fff}
.stat-item-b .stat-note{color:rgba(255,255,255,.82);font-style:normal}
.stat-item-c{background:var(--burgundy);color:#fff}
.stat-item-c .stat-label{color:rgba(255,255,255,.78)}
.stat-item-c .stat-value{color:#fff}
.stat-item-c .stat-note{color:rgba(255,255,255,.92);font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:.06em;font-size:.62rem}
.stat-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:.35rem}
.stat-value{font-family:var(--serif);font-size:clamp(2rem,4vw,2.75rem);font-weight:700;line-height:1;margin:.2rem 0 .55rem}
.stat-note{font-size:.65rem;margin:0}
.status-box{background:rgba(114,47,55,.05);border:1px solid rgba(114,47,55,.1);border-radius:6px;padding:1rem}
.pulse{width:10px;height:10px;border-radius:50%;background:#f59e0b;display:inline-block;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.block{margin-bottom:6rem}
.section-title{font-family:var(--serif);font-size:1.75rem;color:var(--burgundy);margin-bottom:1rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
.section-num{width:2rem;height:2rem;border-radius:50%;background:var(--burgundy);color:#fff;font-family:var(--sans);font-size:.75rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.section-sub{color:rgba(114,47,55,.6);font-weight:700;text-transform:uppercase;letter-spacing:.15em;font-size:.7rem;margin-bottom:2rem}
h3{font-family:var(--serif);font-size:1.15rem;font-style:italic;color:var(--burgundy);margin:2rem 0 1rem}
p{margin-bottom:.75rem;color:#4a4540}
table{width:100%;border-collapse:collapse;margin:1rem 0 1.5rem;font-size:.875rem}
table th{text-align:left;padding:12px 16px;border-top:2px solid var(--burgundy);border-bottom:1px solid var(--burgundy);font-family:var(--serif);font-weight:700;color:var(--burgundy);background:rgba(114,47,55,.05)}
table td{padding:12px 16px;border-bottom:1px solid rgba(114,47,55,.1);vertical-align:top}
tr.highlight-row td{background:rgba(114,47,55,.08)!important;font-weight:500}
.tag{font-size:.68rem;padding:1px 5px;border-radius:3px;white-space:nowrap}
.tag-verified{background:#e8f5e9;color:#2e7d32}.tag-party{background:#fef9e7;color:#8b6914}
.tag-analyst{background:#eef2f7;color:#3d5a80}.tag-unconfirmed{background:#f0eeea;color:#888}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.68rem;font-weight:600;border:1px solid rgba(114,47,55,.15)}
.badge-green{background:#eef6f0;color:#2d5a3d}.badge-amber{background:#faf6ef;color:#8b6914}
.badge-red{background:rgba(114,47,55,.1);color:var(--burgundy)}.badge-blue{background:#f0f3f7;color:#3d4a5c}
.callout{border-left:4px solid;padding:1rem 1.25rem;margin:1.25rem 0;border-radius:0 6px 6px 0}
.callout.info{border-color:#5a7a9a;background:#f0f4f8}.callout.info .callout-title{color:var(--burgundy);font-weight:700;margin-bottom:.5rem}
.callout.missing{border-color:#c45c26;background:#fef6ef}.callout.missing .callout-title{color:#a34b1e;font-weight:700;margin-bottom:.5rem}
.callout.warning{border-color:var(--burgundy);background:#fdf5f4}.callout.warning .callout-title{color:var(--burgundy);font-weight:700;margin-bottom:.5rem}
.callout.success{border-color:#4a6741;background:#f2f7f0}.callout.success .callout-title{color:#4a6741;font-weight:700;margin-bottom:.5rem}
.callout-hint{font-size:.75rem;color:#888;font-style:italic;margin-top:.5rem}.callout ul{margin:.5rem 0 0 1.25rem}.callout li{margin-bottom:.35rem;font-size:.875rem}
.scenario-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(114,47,55,.15);border:1px solid rgba(114,47,55,.15);margin:1.25rem 0}
@media(max-width:700px){.scenario-cards{grid-template-columns:1fr}}
.scenario-card{background:var(--paper);padding:1.25rem;text-align:center}
.scenario-card.base{background:rgba(114,47,55,.06);box-shadow:inset 0 3px 0 var(--burgundy)}
.scenario-card .sc-label{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:.5rem}
.scenario-card.base .sc-label{color:var(--burgundy)}
.scenario-card .sc-irr{font-family:var(--serif);font-size:2rem;font-weight:700;color:var(--burgundy)}
.scenario-card.down .sc-irr{color:#6b5344}.scenario-card.up .sc-irr{color:#4a6741}
.scenario-card .sc-detail{font-size:.75rem;color:#666;margin-top:.5rem;line-height:1.45}
.timeline{position:relative;padding-left:1.5rem;margin:1rem 0}.timeline::before{content:"";position:absolute;left:.2rem;top:0;bottom:0;width:2px;background:rgba(114,47,55,.15)}
.tl-item{position:relative;margin-bottom:1.1rem;padding-left:1.25rem}.tl-item::before{content:"";position:absolute;left:-1.35rem;top:.35rem;width:14px;height:14px;border-radius:50%;background:var(--burgundy);border:3px solid var(--paper)}
.tl-item.pending::before{background:#f59e0b}
.tl-date{font-size:.7rem;font-weight:700;color:var(--burgundy);text-transform:uppercase;display:inline-block;margin-right:.5rem}
.tl-text{font-size:.875rem;color:#4a4540}
.org-chart{background:rgba(255,255,255,.5);border:1px solid rgba(114,47,55,.1);padding:2rem;margin:1.5rem 0;border-radius:8px;text-align:center}
.org-node{border:2px solid var(--burgundy);padding:.85rem;background:#fff;display:inline-block;min-width:11rem;margin:.25rem;font-size:.85rem}
.org-node small{display:block;font-size:.6rem;text-transform:uppercase;font-weight:700;color:#888;margin-bottom:.25rem}
.org-node strong{font-family:var(--serif);color:var(--burgundy)}
.org-line{width:2px;height:1.5rem;background:var(--burgundy);margin:0 auto}
.org-branch{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem}
.adv-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0}
@media(max-width:600px){.adv-grid{grid-template-columns:1fr}}
.adv-grid .pros{background:#f0f7f1;padding:1rem;border-radius:6px}.adv-grid .cons{background:#fdf5f4;padding:1rem;border-radius:6px}
.adv-grid h4{font-family:var(--serif);color:var(--burgundy);margin-bottom:.5rem;font-size:.95rem}
.adv-grid ul{margin-left:1.25rem;font-size:.85rem}
.valuation-box{background:#fff;padding:1.5rem;border-top:2px solid var(--burgundy);margin:1rem 0;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.valuation-box .big{font-family:var(--serif);font-size:2.25rem;font-weight:700;color:var(--burgundy)}
.glossary-grid{display:grid;grid-template-columns:1fr 1fr;gap:.35rem 2rem;font-size:.8rem}
@media(max-width:600px){.glossary-grid{grid-template-columns:1fr}}
.glossary-row{display:flex;gap:1rem;border-bottom:1px solid #e0dcd5;padding:.45rem 0}
.glossary-row .term{font-weight:700;color:var(--burgundy);width:8rem;flex-shrink:0}
.glossary-row .def{color:#666}
.changelog{margin-top:4rem;padding-top:2rem;border-top:1px solid rgba(114,47,55,.2)}
.changelog h4{font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:#888;margin-bottom:.75rem}
.footer{text-align:center;padding:3rem 0 2rem;border-top:2px solid var(--burgundy);margin-top:2rem}
.footer .brand{font-family:var(--serif);font-size:1.75rem;color:var(--burgundy);font-style:italic;margin-bottom:1rem}
.footer p{font-size:.72rem;color:#999;line-height:1.6}
sup{font-size:.65em;color:var(--burgundy)}
.partial-line{font-size:.8rem;color:#a34b1e;font-style:italic;border-left:2px solid #c45c26;padding-left:.5rem;margin:.5rem 0}
</style>
```

> After copying the block above, the token list and per-component notes below remain as **reference** for anyone hand-tuning a one-off — but the default path is always: copy block → fill content. The 缺乏资料 / certainty / risk colours used by content live in this same block (`.callout.*`, `.tag-*`, `.badge-*`).



### Color tokens

```
/* ── Paper ── */
--paper:           #f5f0e8;       /* page background — warm cream */
--paper-texture:   url("https://www.transparenttextures.com/patterns/natural-paper.png");
                                  /* optional; fail closed to flat --paper if offline */
--ink:             #2d241e;       /* body text — warm dark brown, not black */
--ink-soft:        #4a4540;       /* secondary body */
--ink-faint:       #888888;       /* metadata, captions */

/* ── Accent ── */
--burgundy:        #722f37;       /* primary accent — all headings, rules, nav */
--burgundy-10:     rgba(114,47,55,.10);
--burgundy-05:     rgba(114,47,55,.05);
--burgundy-15:     rgba(114,47,55,.15);

/* ── Semantic (paper-theme variants of the standard certainty / risk colors) ── */
--tag-verified-bg: #e8f5e9;  --tag-verified-fg: #2e7d32;
--tag-party-bg:    #fef9e7;  --tag-party-fg:    #8b6914;
--tag-analyst-bg:  #eef2f7;  --tag-analyst-fg:  #3d5a80;
--tag-unconf-bg:   #f0eeea;  --tag-unconf-fg:   #888888;
--risk-crit:       #b91c1c;
--risk-high:       #c2410c;
--risk-med:        #ca8a04;
--risk-low:        #16a34a;
```

The portable theme is the only place where saturation may exceed 40% — strictly limited to the four certainty tag fills and the four risk fills, never for layout or accent. The 40% cap from §Color System still applies to everything else.

### Typography

```
--serif:  "Playfair Display", "Noto Serif SC", Georgia, serif;
--sans:   "Inter", "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
```

- All `<h1>`, `<h2>`, `<h3>` use `--serif`. The italic Playfair `<h3>` is the signature.
- Body text, tables, tags, badges, nav all use `--sans`.
- Fonts are loaded from Google Fonts CDN with a full local fallback chain. If offline, the document degrades cleanly to Georgia + system sans — do not block render on font load.

### Left section-nav (portable variant) — panel switcher

> **v0.5 change**: the KB is no longer one long scrolling page. It is a **left-sidebar section switcher** — a fixed vertical column of buttons (one per rendered slot, plus 附录), and a right-hand content area that shows **only the active panel** at a time. Clicking a button activates its panel and hides the others.

DOM structure (the whole body lives inside `.kb-shell`):

```html
<div class="kb-shell">
  <nav class="kb-nav" aria-label="板块导航">
    <p class="kb-nav-title">石头岛 · 项目知识网络</p>
    <ul>
      <!-- one <li> per rendered slot, generated from the render manifest -->
      <li><button class="kb-nav-btn active" data-target="snapshot"><span class="kb-nav-num">一</span>项目快照</button></li>
      <li><button class="kb-nav-btn" data-target="assets"><span class="kb-nav-num">二</span>资产构成</button></li>
      <!-- … one per manifest entry, in order … -->
      <li><button class="kb-nav-btn" data-target="source-index"><span class="kb-nav-num">A</span>来源索引</button></li>
    </ul>
  </nav>
  <main class="kb-content">
    <!-- masthead lives at the top of the content area (always visible above panels) -->
    <!-- kb-summary card -->
    <!-- one .kb-panel per rendered slot; the first rendered slot gets .active -->
    <section class="block kb-panel active" id="snapshot"> … </section>
    <section class="block kb-panel" id="assets"> … </section>
    <!-- … -->
  </main>
</div>
```

Dynamic-generation rule is unchanged: **the button list is built from the render manifest in slot order, never hard-coded.** Each `kb-nav-btn` carries `data-target="<anchor id>"` matching its panel's `id`. The numeral in `.kb-nav-num` is the manifest's `displayNumeral` (一/二/三… for slots, `A`/`B` for appendices). When a slot is hidden, both its button and its panel are omitted. The first rendered slot's button and panel both get `.active`.

Styling: selected button = burgundy solid fill, white text (`.kb-nav-btn.active`); unselected = burgundy outline on transparent, burgundy text, light hover fill. The nav is `position:sticky; top:0` full-height on desktop; under 860px it collapses to a wrapping horizontal button row at the top.

**Panel-switching JS** — paste this `<script>` once just before `</body>`. Vanilla JS, no library, no dependencies:

```html
<script>
(function(){
  var btns = document.querySelectorAll('.kb-nav-btn');
  var panels = document.querySelectorAll('.kb-panel');
  function show(id){
    panels.forEach(function(p){ p.classList.toggle('active', p.id === id); });
    btns.forEach(function(b){ b.classList.toggle('active', b.dataset.target === id); });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    document.querySelector('.kb-content').scrollTop = 0;
    window.scrollTo(0, 0);
  }
  btns.forEach(function(b){
    b.addEventListener('click', function(){ show(b.dataset.target); });
  });
  // deep-link support: open the panel named in the URL hash on load
  var hash = (location.hash || '').replace('#','');
  if (hash && document.getElementById(hash)) show(hash);
})();
</script>
```

Behavioral notes:
- Only one panel is visible at a time; the masthead + `.kb-summary` sit above the panel switcher and stay visible across all panels.
- Cross-section anchor links (`href="#returns"`) still work via the hash deep-link handler — clicking one opens the target panel instead of scrolling within a long page.
- If JS is disabled, the CSS `.kb-panel{display:none}` would hide everything; therefore the **first panel is also given `.active` in markup** so at least the snapshot renders without JS. (Acceptable degradation for a self-contained internal doc.)
- The 历史 top sticky-nav (`.sticky-nav` / `.sticky-nav-inner`) is **deprecated** — do not emit it. Its CSS has been removed from the portable stylesheet.

### Masthead

Two-column layout: left = title block (`conf-badge` + `ai-badge` 徽章行 → `<h1>` → `masthead-subtitle` → `masthead-lead`), right = `masthead-meta` 数据栏（`<dl>` 等距 `meta-row`，Version / Date_stamp / Deal_stage / Report_status）。两栏顶部对齐。下方是 3 列彩色 `stat-row`（A 浅米 → B 中酒红 → C 深酒红，1px 间隔线、等高块，无进度条）。

```html
<header class="masthead">
  <div class="masthead-split">
    <div class="masthead-main">
      <div class="masthead-badges">
        <span class="conf-badge">Confidential Investment Memorandum</span>
        <span class="ai-badge">🤖 AI 生成</span>
      </div>
      <h1>石头岛 Stone Island · 项目知识网络</h1>
      <p class="masthead-subtitle">Whitsundays Tourism Island · Knowledge Network · v1.0</p>
      <p class="masthead-lead">澳洲昆士兰 Bowen 近岸私人旅游岛屿收购 · 收购指引价 AUD $23M · 近期 Stage 1 资金需求 AUD $11.2M · 卖方 Jarrod (Jay Mac) · EOI 销售中</p>
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
    <div class="stat-item stat-item-a">
      <div class="stat-label">Factor A · 完备度</div>
      <div class="stat-value">61%</div>
      <p class="stat-note">11 slot 全渲染</p>
    </div>
    <div class="stat-item stat-item-b">
      <div class="stat-label">Factor B · 来源多样性</div>
      <div class="stat-value">54%</div>
      <p class="stat-note">卖方文件 + 政府批文 + 独立顾问报告</p>
    </div>
    <div class="stat-item stat-item-c">
      <div class="stat-label">综合成熟度</div>
      <div class="stat-value">58%</div>
      <p class="stat-note">Mid Stage</p>
    </div>
  </div>
</header>
```

规则要点：
- 徽章行：`conf-badge`（酒红实心 monospace）+ `ai-badge`（白底描边）。`ai-badge` 始终显示，与语言切换无关。
- `masthead-meta` 的 `dt` 用 monospace 小字（首字母大写如 `Version`，CSS `text-transform:uppercase` 自动转全大写）；`dd` 右对齐。`Deal_stage` 的值用黑色 `stage-pill`，其余 `dd` 用 `--ink` 文本。**`dt` 文本里不要手动加冒号或末尾的「·」** —— label 样式由 CSS 控制，多加字符会出现 `REPORT_STATUS·` 这类多余符号。
- `stat-row` 固定 3 列：`stat-item-a`（Factor A，浅米）/ `stat-item-b`（Factor B，中酒红）/ `stat-item-c`（综合成熟度，深酒红）。多资产项目把 per-asset breakdown 放进 `stat-note`。窄屏自动堆叠为 1 列。

### New components (portable)

These components have no equivalent in the default theme and must be declared in the portable stylesheet:

- **`.section-num`** — 2rem circular burgundy badge containing the dynamic numeral (一/二/三…), placed inside the `<h2>` as the first child. The numeral comes from the render manifest, not from authored markup.
- **`.scenario-cards`** (`#returns`) — 3-column grid (Downside / Base / Upside). The Base card uses `--burgundy-05` background and a 3px inset top border in `--burgundy`. IRR figure in `--serif` 2rem. Collapses to 1 column under 700px.
- **`.org-chart`** (`#legal-relationships`) — top-down org tree using `.org-node` (2px burgundy border, white background, `--serif` strong) joined by `.org-line` (2px burgundy vertical rule, optionally dashed for "indicative" links). `.org-branch` is a horizontal flex container for sibling nodes.
- **`.timeline`** + **`.tl-item`** — left-rail vertical timeline (separate from the §Unified Timeline table in slot `timeline`; this one is for inline mini-timelines embedded inside other slots). 2px rail in `--burgundy-15`, dots in solid `--burgundy` with a 3px `--paper` ring.
- **`.glossary-grid`** (附录 B) — 2-column responsive grid of `.glossary-row` items. Term in `--burgundy` weight 700 fixed width 5.5rem; definition in `--ink-soft`. Collapses to 1 column under 600px.
- **`.adv-grid`** — 2-column pros/cons or for/against grid. `.pros` background `#f0f7f1`, `.cons` background `#fdf5f4`. Used inside `#decision-framework` and occasionally `#risks`.
- **`.valuation-box`** — full-width white panel with 2px `--burgundy` top border for headline numbers (valuation range, MOIC headline, etc.). The big figure uses `--serif` 2.25rem.
- **`.kb-shell` / `.kb-nav` / `.kb-nav-btn` / `.kb-content` / `.kb-panel`** — the left-sidebar panel-switcher layout (see "Left section-nav" above). `.kb-panel` is `display:none` by default; `.kb-panel.active` shows. Buttons toggle `.active`.
- **`.kb-summary`** — the auto-generated ≤200-字 project overview card. Lives directly above section 一 (project snapshot), inside `.kb-content`, **outside** any `.kb-panel` so it stays visible across all panels. Cream fill (`#efe7da`) with a 4px `--burgundy` left border; small uppercase label + one paragraph.
- **`.bmc`** — Business Model Canvas, the classic 9-cell grid (Key Partners / Key Activities / Key Resources / Value Propositions / Customer Relationships / Channels / Customer Segments / Cost Structure / Revenue Streams). Used in slot `business-model` for 地产收购开发类 projects. 5-column × 3-row grid; Value Propositions spans both top rows centre; Cost/Revenue span the bottom row. Collapses to single column under 760px.
- **`.journey`** — Journey Map: a horizontal stage axis (`.journey-stages`) with one or more parallel path lanes (`.journey-lane`), each lane representing a route/branch with nodes per stage. Used in slot `business-model` for 贸易/多路径类 projects. Horizontally scrollable; `.journey-node.empty` marks a stage a given path skips.
- **`.topic`** — collapsible external-research topic (`<details>`). Burgundy italic summary with a rotating ▸ caret + a right-aligned count pill; body holds the topic's findings and any user-submitted questions (`.topic-q`). Replaces the old standalone Q-01/Q-02 list.
- **`.tl-tree` / `.tl-year` / `.tl-month`** — hierarchical year→month→day timeline using nested `<details>`. Default view = collapsed years each showing a one-line `.tl-year-sum` annual-progress summary; expanding a year reveals its months; expanding a month reveals day-level `.tl-item` rows. Burgundy carets, same paper/burgundy palette. This is the expandable upgrade of section 八's 8.1 sub-block.
- **`.tag-attrib`** — small italic attribution suffix appended to a certainty tag to name the *party* (for 🟡) or *analysis source* (for 🔵). E.g. `🟡 卖方` / `🔵 AI推论`. See "Tags and badges (portable)" below.

### Tables (portable)

Override the default `.data-table` style: header row uses `--burgundy-05` background, `--burgundy` color, `--serif` weight 700, top border 2px solid `--burgundy`, bottom border 1px solid `--burgundy`. Body rows separated by 1px `--burgundy-10`. `.highlight-row` background is `--burgundy-10` weight 500. No alternating bands.

### Tags and badges (portable)

The four `.tag-*` and four `.badge-*` patterns from the sample HTML map directly to the certainty / risk semantics already defined above:

- `.tag-verified` ↔ ✅ 已核实 ↔ `--tag-verified-*`
- `.tag-party`    ↔ 🟡 当事方声明 ↔ `--tag-party-*`
- `.tag-analyst`  ↔ 🔵 分析师推论 ↔ `--tag-analyst-*`
- `.tag-unconfirmed` ↔ ⚪ 待确认 ↔ `--tag-unconf-*`
- `.badge-green` / `.badge-amber` / `.badge-red` / `.badge-blue` ↔ status pills for approval state, priority, etc.

Tags are `font-size: .68rem`, 1×5px padding, 3px radius. They appear immediately after the data point, never separated by a line break.

**Attribution (mandatory for 🟡 and 🔵)** — a bare 🟡 or 🔵 is no longer enough; the tag must name *who*:

- 🟡 当事方声明 → name the **party** that made the claim, inside the tag:
  `<span class="tag tag-party">🟡 <span class="tag-src">卖方</span></span>` ·
  also `🟡 项目方` / `🟡 顾问 (XX 律所)` / `🟡 经纪`.
- 🔵 分析师推论 → name the **analysis source** — AI vs internal human analyst:
  `<span class="tag tag-analyst">🔵 <span class="tag-src">AI推论</span></span>` ·
  also `🔵 内部分析师` (optionally `🔵 内部分析师 (姓名首字母)`).
- ✅ and ⚪ need no attribution (✅ already implies cross-verification; ⚪ is by definition unowned).
- When extra context helps but would crowd the pill, use the `.tag-attrib` italic suffix *outside* the tag: `<span class="tag tag-party">🟡 卖方</span><span class="tag-attrib">(CIM p.12)</span>`.

### Footer + changelog (portable)

Changelog renders as a small table inside `.changelog` (top 1px border in `--burgundy-15`, `<h4>` label in `--text-xs` ALL-CAPS). Footer is a centered block with a 2px top `--burgundy` rule, the brand line in `--serif` italic, and a 1-line non-advisory disclaimer in `--ink-faint`. Both footer and changelog are part of the static frame — they are not slots and do not participate in hide-and-renumber.

### What stays unchanged from the default theme

The portable theme inherits — without modification — the slot system, hide-and-renumber rule, certainty taxonomy, citation tooltip behavior, glossary marker convention (`*`), the three-block vertical timeline structure, multi-asset partitioning rule, and bilingual toggle. Only the visual surface changes.

---

## Do Not

- Do not use color to convey information that isn't also conveyed by text (accessibility).
- Do not use more than 2 font weights on a single page (400 + 600; occasionally 500). Portable theme: Inter 400/500/700 for body + Playfair 700 for headings counts as 2 weight families, not 4 weights — still within the rule.
- Do not add decorative elements (icons, illustrations, dividers with flourishes).
- Do not use cards with shadows — use flat sections with border rules. Portable `.valuation-box` and `.org-node` use **borders only**, no `box-shadow` beyond a 1px subtle stroke for paper-on-paper separation.
- Do not animate anything. The `.pulse` dot in the masthead status is the **only** permitted animation, and only when status is genuinely "Active".
- Do not use a dark mode variant (these are print-friendly documents).
- Do not put marketing copy anywhere in a report.
- Do not hard-code the section numbering or the left section-nav button list. Both are derived from the render manifest at render time.
- Do not pad empty slots with placeholder callouts to make the document look "complete". An empty slot is hidden; a Stub renders only when a skill has actually found an informative absence.
