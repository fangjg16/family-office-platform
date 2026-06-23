# Slot Hard Rules — 安全 / 结构硬门禁

> 与 **菜单 schema**（`knowledge-network-slot-module-schema.ts`）正交。  
> 菜单回答「可以写什么」；本文档回答「什么必须修、什么会阻断 merge / publish」。  
> 开发说明见 `knowledge-network-slot-schema-dev.md`。

---

## 1. 原则

| 维度 | 菜单 schema | Hard rules（本文） |
|------|-------------|-------------------|
| 缺失 allowed 组件 | 正常 | **不** repair |
| coverageTarget 未达 | soft warning | **不** repair |
| gap-first / fallback 输出 | 正常 | **不** repair |
| 幻觉、无法映射、空 register、错误引用 | — | **必须** minimal repair |

**Hard rules 不是 allowed component 的 required 套餐。**

---

## 2. Slot 级 hard issue codes

代码入口：`knowledge-network-hard-issue-codes.ts` · `knowledge-network-publish-gate.ts`

| Code | 含义 | 典型触发 | 修复方向 |
|------|------|----------|----------|
| `payload_missing` | slot payload 非 object | 缺 `slots.{name}` 或值为 null | 补有效 JSON 对象 |
| `unmapped_row_keys` | table row 列名无法映射 | 自创英文列、拼写错误 | 改 canonical 中文列或 schema alias |
| `invalid_component_type` | 组件形态错误 | journeyMap 写成 array 等 | 按 schema kind 修正结构 |
| `risk_rows_missing` | risks 无 riskRows register | 完全缺表或全空 | 补 ≥1 条结构化行（可 gap-first） |
| `fabricated_risk` | 无证据的具体风险事件 | 编造诉讼/处罚细节 | 改待验证 + requiredEvidence |
| `fabricated_irr` | 无投资输入写量化回报 | 缺 term sheet 却写 IRR% | 改 cashflowGaps / 待建模 |
| `fabricated_license` | 无证据断言许可有效 | 「已取得/有效」许可 | 改待确认 + regulatoryGaps |
| `fabricated_comp` | 编造可比交易 | 虚构 EV/倍数成交 | 改 comparableGaps + note |
| `fabricated_partnership` | 编造合作关系 | 无证据的战略伙伴 | 改 resourceGaps |

专项实现：

- `knowledge-network-risks-gap-first.ts` — `risk_rows_missing` · `fabricated_risk`
- `knowledge-network-gap-first-quality.ts` — `fabricated_license`
- `knowledge-network-coverage-target.ts` — `fabricated_irr`
- `knowledge-network-slot-normalizer.ts` — `invalid_component_type` · `unmapped_row_keys`

---

## 3. 管线级 hard rules（非 slot issue code）

### JSON envelope 错误

- **位置**：`knowledge-network-slot-batch-extract.ts` · orchestrator merge
- **含义**：Hermes 回复不符合 `structured-slot-batch` 契约
- **示例**：无 JSON 代码块、多个代码块、`type` 错误、batchIndex 不匹配、slots 形态错误
- **修复**：返回单一 envelope；blocked 时加 `status` + `blockedReason`
- **注意**：envelope 错误 **≠** 缺某个 allowed 组件

### Source ref 错误

- **位置**：`knowledge-network-source-ref-resolve.ts` · `knowledge-network-slot-batch-orchestrator.ts`
- **含义**：payload 引用 registry 中不存在的 `source-U-*` / `source-A-*`
- **示例**：`证据/来源: "source-99"` 未在 sources / proposals 中登记
- **修复**：改已有 source id 或经 `sourceProposals` 提议新来源
- **注意**：缺 source 标注 **≠** 必须用某张表填满 slot

---

## 4. Soft 层（明确不是 hard）

以下只产生 `coverage_target` / `*_soft` issue 或 `softWarnings`，**不**触发 merge minimal repair：

- allowed 组件缺失（如无 journeyMap、无 customerBuyer）
- coverage target 未达（fact + gap 合计不足）
- gap-first 仅 operationalGaps / regulatoryGaps / cashflowGaps
- Evidence Maturity / structureCoverage 偏低

实现：`knowledge-network-slot-coverage.ts` · `knowledge-network-batch3-coverage.ts` · `evaluateHardPublishGate` 的 softWarnings 分支。

---

## 5. Repair 边界（当前阶段）

**会 repair（一轮 minimal）：**

- 上表 slot hard codes
- envelope / source ref（orchestrator 层）
- residual empty row / unmapped（normalizer 后仍残留）

**不会 repair：**

- coverage target / `layers.pass === false`（仅 soft）
- allowed 组件未选
- schema → prompt 自动生成缺失
- renderer 展示缺口

---

## 6. 相关文件

| 文件 | 职责 |
|------|------|
| `knowledge-network-slot-module-schema.ts` | allowed / fallback **菜单** |
| `knowledge-network-slot-hard-rules.md` | **本文** — safety / structure hard rules |
| `knowledge-network-slot-schema-dev.md` | 菜单语义与 gap-first 开发说明 |
| `knowledge-network-hard-issue-codes.ts` | hard code 枚举 |
| `knowledge-network-slot-normalizer.ts` | normalize + merge hard gate |
| `knowledge-network-slot-batch-minimal-repair.ts` | repair prompt（hard only） |
