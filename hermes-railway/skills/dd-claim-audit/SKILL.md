---
name: dd-claim-audit
description: "Audit key claims, assumptions, and data points in project materials for credibility. Cross-verify across multiple sources, identify contradictions, and assess assumption sensitivity. This is where \"information\" becomes \"intelligence\" — the transition from knowing what was said to knowing what is true. Triggers on \"audit this\", \"审计\", \"verify claims\", \"is this true\", \"cross check\", \"信息审计\", \"矛盾\", \"contradictions\", \"声明可信度\"."
---

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
