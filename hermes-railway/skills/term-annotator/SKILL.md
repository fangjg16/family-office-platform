---
name: term-annotator
description: "Detect technical and专有名词 in the Project Knowledge Base (储能 LFP / 构网型逆变器 / DA / FSR / FIRB / AEMO / BESS / SPV / VIE / cap rate / ROFR etc.), insert footnote markers on first occurrence, and maintain the glossary table (附录 B) at the bottom of the KB HTML. Auto-invoked by knowledge-base-generation after every section update. Triggers on \"add glossary\", \"add footnote\", \"专有名词\", \"glossary\", \"术语表\", \"explain LFP\", \"什么是 DA\"."
---

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
