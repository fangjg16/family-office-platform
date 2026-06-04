---
name: gap-tracking
description: "Register, prioritize, and track all information gaps discovered across the analysis lifecycle. Each gap is linked to its source layer, assigned an owner and urgency, and monitored until resolved. Resolution triggers downstream analysis updates. Use when gaps are identified in any analysis layer, when checking outstanding items, or during weekly project reviews. Triggers on \"what's missing\", \"缺口\", \"outstanding items\", \"what do we still need\", \"gap status\", \"信息缺口\"."
---

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


## 持续学习（Self-Evolution）

每次开始任务时，先读取 `knowledge/` 文件夹中已有的学习记录；每次完成任务后，把新学到的内容追加进去。

触发记录的条件：
- 遇到当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得重用的成功经验或模式
- 原有指令出现歧义或冲突

若认为核心指令需要改进，请主动告知用户并说明原因。
