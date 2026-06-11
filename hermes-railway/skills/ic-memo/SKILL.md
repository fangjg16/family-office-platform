---
name: ic-memo
description: "Generate a formal investment decision memorandum that synthesizes all analysis layers into a decision-ready document. Structured for a family office investment committee or principal decision-maker — clear thesis, quantified risk, defined options, explicit recommendation. Triggers on \"IC memo\", \"投资决策备忘录\", \"investment memo\", \"write up the deal\", \"decision memo\", \"prepare for IC\", \"总结一下这个项目\"."
---

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
