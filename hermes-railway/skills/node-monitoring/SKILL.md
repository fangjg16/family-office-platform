---
name: node-monitoring
description: "Track external events and decision points whose outcomes would materially change a project's valuation, risk profile, or investment strategy. Each node has pre-defined scenario branches and auto-triggers downstream analysis updates when resolved. Triggers on \"monitor\", \"节点监控\", \"what events matter\", \"decision nodes\", \"关键节点\", \"what are we waiting for\", \"外部事件追踪\"."
---

# Decision Node Monitoring

> **v2.8**：节点写入 KB 须经 `../knowledge-base-generation/references/timeline-rules.md` **eligibility gate**（`scope` / `timelineEligible` / `reason`）。仅 `timelineEligible=true` 的节点进入 slot `timeline`（三区块：已发生 / 正在推进 / 未来关键节点）。KB 结构见 `../knowledge-base-generation/references/kb-schema.md`。
> **Macro / policy / market nodes** do **not** default to `timeline`. They go to `risks` or `decision-framework` unless they become **this project's** external dependency, future gate, or deadline — then register with explicit project link and `timelineEligible: true`.

## Workflow

### Step 1: Identify Decision Nodes

Scan all analysis outputs for events that represent binary or branching outcomes:

| Source | Node Type | Example | Default KB route |
|--------|-----------|---------|------------------|
| L1 Knowledge Base (Timeline) | Scheduled **project** events | DA hearing for **this** site, FIRB deadline for **this** buyer | `timeline` (if `timelineEligible: true`) |
| L3 Risk Matrix | Risk resolution events | GPS review result for **this** connection | `timeline` when dated project gate |
| L6 Gap Tracking | Information arrival events | Valuation report delivery for **this** deal | Usually `open-questions` / `正在推进`; timeline only if milestone gates execution |
| External environment | Macro / policy / market | RBA rate decision, sector policy announcement | **`risks` or `decision-framework`** — not timeline unless tied to **this project's** gate |

### Eligibility gate (every node)

| Field | Description |
|-------|-------------|
| `scope` | `project` \| `target` \| `counterparty` \| `asset` \| `regulator` \| `market` \| `industry` \| `internal` |
| `timelineEligible` | `true` only for nodes that gate **this project's** execution, valuation, or IC decision |
| `reason` | Why it is or is not a project timeline node |
| `kbRoute` | `timeline` \| `risks` \| `decision-framework` \| `open-questions` |

**Examples:**

| Node | timelineEligible | kbRoute |
|------|------------------|---------|
| FIRB decision deadline for **this** acquisition | true | `timeline` → 未来关键节点 |
| RBA cash rate announcement (macro) | false | `risks` / `decision-framework` (financing sensitivity) |
| National housing policy headline | false | `decision-framework` thesis context |
| GPS review for **this** BESS project | true | `timeline` → 正在推进 or 未来关键节点 |

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
- **KB update** (via `knowledge-base-generation` handoff — no direct HTML):
  - `timeline`: only nodes with `timelineEligible: true` → map to 8.1 / 8.2 / 8.3
  - `risks`: macro/policy/market nodes that affect thesis but do not gate a dated project action
  - `decision-framework`: strategic implications and scenario branches for uncontrollable externals
- **Section details**:
  - 八: project execution nodes only — 已发生 / 正在推进 / 未来关键节点
  - Each **timeline** node: scenario branches (positive / mixed / negative) and cascade triggers
  - **Non-timeline** nodes: document monitoring method + impact in `risks` or `decision-framework`
- All KB writes go through `knowledge-base-generation` (single source of truth).
## Important Notes

- Nodes are NOT the same as gaps. A gap is missing information; a node is a future event whose outcome is uncertain.
- **Do not register macro/policy/market nodes in `timeline` by default** — pre-analyze scenarios in chat, then route per eligibility gate.
- Some nodes are **controllable** (e.g., submitting a FIRB application) and some are **uncontrollable** (e.g., RBA rate decision). Track both; uncontrollable externals usually land in `risks` / `decision-framework`.
- For cascading nodes (Node B only matters if Node A resolves positively), document the dependency chain.
- Node monitoring should be reviewed weekly in the project review cadence.
- When a critical node's expected date passes without resolution, escalate — silence is a signal.


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
