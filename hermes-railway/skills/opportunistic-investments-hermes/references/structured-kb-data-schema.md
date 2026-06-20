# structured-kb-data · Hermes 交付 schema（v2.91）

首次 / 全量 KB 的**主路径**：Hermes 只产出 JSON，Worker 确定性渲染整页 HTML。

**目标不是「13 个 slot 存在」**，而是 **通过 Worker Full Quality Contract 2.0**（内容质量评分：有效 row ≥ 65% 字段非空；空 row 不计分；`publishCoverage=100` 仅当全部 slot ≥85 且无空 row）。未达标时 Worker 返回 `repair_needed` 并触发**一次**自动 repair pass。

---

## Envelope

```json
{
  "type": "structured-kb-data",
  "schemaVersion": "2.91",
  "mode": "initial",
  "summary": "3–8 行摘要的短版",
  "config": { "displayOrder": ["snapshot", "..."], "projectType": "general" },
  "meta": { "title": "…", "autoSummary": "…" },
  "maturity": { "factorA": "42%", "factorB": "25%", "combined": "35%", "tier": "Early" },
  "slots": { "snapshot": { … }, …13 keys… },
  "sources": [{ "id": "U-1", "type": "…", "title": "…" }],
  "terms": [],
  "dataDictionary": []
}
```

---

## 禁止

- `versionLedger` / Appendix D HTML — Worker + D1 自动写入
- 整页 ` ```html `、`sectionHtml`、手写 nav / KB-CONFIG / revealAnchor
- **用 2–4 行薄表格糊弄完整 slot**（每 slot 须满足下方最低 coverage）
- 默认 `jfo_kb_put.sh`（仅 structured 完全无法交付时的 fallback）

---

## maturity（Hermes 可填占位，Worker 会重算）

- `factorA` / `factorB` / `combined` **不是最终评分**；Worker 按 Quality Contract + 来源多样性**确定性重算**并写入 header。
- 单一 BP / 项目方资料 → Factor B 上限约 **20–25%**，Combined 上限约 **45%**。
- 字母等级写 `tier` / stat-note；勿用虚高百分比「刷分」。

---

## sources

- `id` 不含 `source-` 前缀（如 `U-1`、`A-1`）
- **禁止 duplicate id**
- 所有 `evidenceSourceIds` 必须先出现在 `sources` 中

---

## 缺资料时如何写 gap

- 每个 slot 用 `gaps` / `unresolvedLegalIssues` / `missingResources` / `relevanceNotes` 等 **GapCallout** 数组：
  ```json
  { "text": "具体缺什么、为何重要", "confidence": "gap" }
  ```
- `confidence`: `"gap"` = 资料缺口；`"low"` = 有说法但低置信度。
- **禁止**用空字符串、空对象 `{}`、仅表头无有效 tbody 行占位 table
- **禁止**输出无业务含义的 row（≥65% 核心字段须非空）
- 不知道就写 **gaps callout**，不要填空对象或「待补充」占位 cell
- 无项目级 timeline 节点时，`timeline-milestones.gaps` 须说明「暂无已记录节点」。

---

## 13 Slot Quality Contract 2.0（Worker 强制校验）

每项为 **有效 row 数 + 分析/缺口**。空 row、填充率 <65% 的 row **不计分**。repair 消息会列出 `空/无效 row: slot.field[index]`。

**publishCoverage=100** 仅当：13 slot 均 ≥85 分 **且** 无 emptyRowIssues。

**Factor A（成熟度）**：单一 BP 来源上限约 **70%**；有空 row 时上限 **75%**；Combined 单一来源上限 **45%**。

### 一、snapshot（项目快照）

| 字段 | 要求 |
|------|------|
| `stage`, `status` | 必填 |
| `keyFacts` | **≥ 6 行**：须含项目名称、主体、成立/注册、核心技术、产品定位、阶段、融资状态、关键 gating issue |
| `oneLineJudgment` **或** `overview` | 一句话判断（≥20 字）或 overview 叙述段 |
| `gaps` | **≥ 1** callout：资料缺口清单 |

### 二、target-overview（标的概况）

| 字段 | 要求 |
|------|------|
| `assetSummary` | **≥ 3 项**（资产/权利/能力） |
| `keyClaims` **或** `businessSummary` | keyClaims ≥2 **或** businessSummary ≥2 段 |
| `gaps` | **≥ 1** |

### 三、industry-market（行业与市场）

| 字段 | 要求 |
|------|------|
| `marketDrivers` | **≥ 3 条** |
| `valueChain` | **≥ 2 行** |
| `policyContext` **或** `comparableSignals` | **≥ 1** |
| `gaps` | **≥ 1** |

### 四、business-operations（业务与运营）

| 字段 | 要求 |
|------|------|
| `journeyMap.stages` | **≥ 2**；建议含 `lanes`（Revenue Tree / 路径） |
| `revenueTree` **或** `flywheel` | revenueTree ≥2 **或** flywheel 叙述 |
| `customerBuyer` | **≥ 2 行** |
| `pricing` **或** `operatingBottlenecks` / `supplyChain` | **≥ 1** |

### 五、legal-ownership（法律与权属）

| 字段 | 要求 |
|------|------|
| `entities` / `ownershipClaims` | **≥ 2 项** |
| `contractRights` / `licenseRights` **或** `relationshipEdges` | **≥ 1** |
| `unresolvedLegalIssues` | **≥ 1** gap |

### 六、regulatory-compliance（监管合规）

| 字段 | 要求 |
|------|------|
| `jurisdictionRows` / `complianceRisks` | **≥ 2 条** |
| `licenseRequirements` / `approvalPath` | **≥ 1** |
| `gaps` | **≥ 1** |

### 七、resource-network（资源网络）

| 字段 | 要求 |
|------|------|
| `parties` / `resources` | **≥ 3 项** |
| `capabilities` / `dependencies` **或** `relationshipEdges` | **≥ 1** |
| `missingResources` | **≥ 1** |

### 八、comps-benchmark（可比与基准）

| 字段 | 要求 |
|------|------|
| `compsRows` | **≥ 2 条** |
| `transactionCases` / `benchmarkMetrics` | **≥ 1** |
| `relevanceNotes` | **≥ 1**（适用性/缺口） |

### 九、valuation-returns（估值与回报）

| 字段 | 要求 |
|------|------|
| `scenarios` | **≥ 3**：须含 Downside / Base / Upside |
| `sensitivityItems` | **≥ 2 条** |
| `investmentCashflow` / `returnDrivers` / `downsideCases` | **≥ 1** |
| `gaps` | **≥ 1** |

### 十、diligence-gaps（尽调缺口）

| 字段 | 要求 |
|------|------|
| `questionGroups` | **≥ 2 组**（含 P1/P2/P3 分组） |
| P1 或「最高」组 | **必须存在** |
| 问题总数 | **≥ 5 条**；每条含 question、whyItMatters、owner、requiredEvidence（如有） |

### 十一、risks-mitigation（风险与缓释）

| 字段 | 要求 |
|------|------|
| `riskRows` | **≥ 5 条** |
| 含 `mitigation`（≥6 字） | **≥ 3 条** |
| 每条 | level、risk、cause/impact、mitigation、evidenceSourceIds（如有） |

### 十二、timeline-milestones（项目时间轴）

| 字段 | 要求 |
|------|------|
| `occurred` / `inProgress` / `future` | 合计 **≥ 3 节点** |
| `occurred` | **≥ 1** |
| `inProgress` **或** `future` | **≥ 1** |
| 无节点时 | `gaps` 说明缺口 |

**仅项目自身节点**；行业/市场动态写 industry-market，勿写入 timeline。

### 十三、decision-framework（决策框架）

| 字段 | 要求 |
|------|------|
| `recommendation` | **≥ 15 字** |
| `decisionTable` | **≥ 2 行** |
| `nextActions` | **≥ 2 条** |
| `goNoGoConditions` / `triggers` | **≥ 1** |

---

## Worker 发布门槛（old / new）

1. **Quality Contract** 通过（主门槛；薄 JSON 在此被拦下）。
2. **Regression gate（85%）** 仅当**旧版 KB 也是 Worker structured 渲染**时启用：比较旧/新 JSON 的 `quality-coverage`（写入 KB-CONFIG），新版须 ≥ 旧版 × **0.85**。
3. 旧版为 Hermes 整页 HTML（无 `quality-coverage`）时 **不做 HTML 字符回归**，避免 Worker 紧凑渲染误杀好 JSON；但仍须通过 Quality Contract。

---

## 交付

1. 简体中文摘要 3–8 行
2. **一个** fenced ` ```json ` 块，`type` 必须为 `structured-kb-data`
3. 完整示例见 `examples-kb-data.json`（**rich fixture 风格**，非 thin 占位）

## Repair pass

Worker 若返回 `repair_needed`，会在**同一 job 内**再请求 Hermes **补 structured-kb-data JSON 一次**（勿写 HTML）。仍失败则保留旧 KB，不发布低质量版本。
