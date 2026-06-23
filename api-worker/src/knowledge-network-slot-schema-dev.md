# Slot Module Schema — 开发说明

> 代码入口：`knowledge-network-slot-module-schema.ts` · `knowledge-network-slot-normalizer.ts` · `knowledge-network-slot-schema-consistency.ts`  
> 原则：**Schema = 菜单，不是套餐。** 减少字段漂移与无意义 repair，不把系统做死。

---

## 1. 四类语义

| 类别 | 配置位置 | 含义 | 缺失时 | 是否 repair |
|------|----------|------|--------|-------------|
| **allowed** | `role: "allowed"` | Worker 知道如何 normalize / render；Hermes 可按项目资料选用 0–n 个 | 正常，不算失败 | 否 |
| **fallback** | `role: "fallback"` | 资料不足时的缺口路径（`operationalGaps`、`regulatoryGaps`、`gaps` callout 等） | 可完全不出现；出现时视为正常 gap 输出 | 否 |
| **coverageTarget** | 组件上的 `coverageTarget` | **Soft**：该组件若出现，`fact rows + gap rows` 合计占目标的 maturity 提示 | 未达目标只影响 score / `layers.pass` | **否**（不为覆盖率 repair） |
| **hard repair** | normalizer + 专项 hard rule | `unmapped_row_keys`、`invalid_component_type`、幻觉、断引用、`risk_rows_missing` 等 | 必须修 | **是**（minimal repair，一轮） |

**Empty row policy（normalizer）：** full-empty placeholder → drop + warning；有内容但列名无法映射 → hard repair。gap 标注行不算 empty。

---

## 2. 可选组件 Slot：`business-operations` 选择逻辑

**菜单（allowed）：** `journeyMap` · `revenueTree` · `flywheel` · `canvas` · `processFlow` · `customerBuyer` · `pricing` · `operatingBottlenecks` · `supplyChain` · `ecosystemMap`

**fallback：** `operationalGaps`（别名 `assumptions` / `assumptionMap`）· `gaps`

**Hermes 约定（prompt 提示，非 hard）：**

1. 根据项目资料选 **1–2 个最合适的主组件**（如贸易项目偏 `journeyMap`+`revenueTree`，平台项目偏 `flywheel`+`canvas`）。
2. **不要**为凑结构同时生成 journeyMap + revenueTree + flywheel + canvas。
3. 不适合的组件 **不要生成**（缺失 = 正常）。
4. 资料不足时写 **`operationalGaps` 或 `gaps`**，勿放空 row、勿编造事实。

**Worker 行为：** normalize 只处理出现的字段；未出现的 allowed 组件不检查、不 repair。

---

## 3. Gap-first 为什么是正常结果

| 场景 | 正常输出 | 不是失败的原因 |
|------|----------|----------------|
| 商业事实不足 | `operationalGaps` / 组件 `gaps` callout | 诚实标注缺口优于空表或幻觉 |
| 监管许可未核实 | `regulatoryGaps` 行 | gap-first 行满足监管 slot 表达需求 |
| 风险资料不足 | `riskRows` 中「待验证 / 缺资料」结构化行 | register 存在即可，不要求编造真实风险事件 |
| 回报无法量化 | `cashflowGaps` + gap-first `scenarios` | 禁止无输入写 IRR/MOIC |
| coverageTarget 未达 | `coverage_target` issue（soft） | target = fact + gap 合计；gap 行计入 coverage |

**Hard 与 soft 分界：** gap-first 输出走 fallback / allowed；只有 **假事实**（`fabricated_*`）、**空 register**（`risk_rows_missing`）、**无法映射的列名** 等才 hard repair。

**diligence `questionGroups`：** 须有问题 register，但 **不得为凑 `coverageTarget` 编造问题**；每条应是真实待核实事项或资料驱动的缺口。

---

## 4. 仍留在 Renderer 的规则（及原因）

以下 **故意不迁入 schema registry**，避免菜单变套餐、避免重复维护 row 细节：

| 留在 renderer | 示例 | 原因 |
|---------------|------|------|
| 表头与列顺序 | flywheel `step/mechanism/metric`；risk matrix 7 列 | 纯 HTML 展示，不影响 payload 语义 |
| 复合布局 | journeyMap stages×lanes 网格；BMC 9 格 | 排版逻辑，非数据契约 |
| `renderTableOrGap` | 组件无有效行时输出 gap label | 展示层兜底（normalizer 已 drop 空 row） |
| Legacy 读法 | `p.journey` · `valuationBox` | 兼容旧 payload；normalize 侧逐步吸收 |

**Schema 登记的是「顶层组件字段 + normalize 策略」；`ROW_SPECS` 登记的是「表 cell 列别名」。** Renderer 内联列是第三层展示细节，高频出错组件优先在 schema/normalizer 收束，其余保持内联。

**Consistency（轻量）：** `findUnknownComponentsInPayload` 仅审计「顶层 field 是否在 allowed 菜单内」。不检查 optional 缺失、不 enforce coverage、不升级 rule engine。

---

## 5. 明确不做（当前阶段）

- schema → prompt 全自动生成  
- renderer 内联列全量迁移  
- live / deploy 验收（除非另行安排）  
- 把 `coverageTarget` 或 allowed 缺失接入 repair  

---

## 6. 相关文件

| 文件 | 职责 |
|------|------|
| `knowledge-network-slot-module-schema.ts` | allowed / fallback 菜单 |
| `knowledge-network-slot-hard-rules.md` | safety / structure hard rules（与菜单正交） |
| `knowledge-network-slot-normalizer.ts` | 唯一 normalize 入口；empty drop；hard issue |
| `knowledge-network-slot-schema-consistency.ts` | unknown field 轻量审计 |
| `knowledge-network-row-columns.ts` | 列别名（`pickRowCell`），与菜单正交 |
| `knowledge-network-slot-batch-compact-prompt.ts` | 手工 canonical 组件名提示 |
| `knowledge-network-risks-gap-first.ts` | riskRows 专项 hard（register 非空，可 gap 行） |
