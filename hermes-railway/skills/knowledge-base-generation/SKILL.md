---
name: knowledge-base-generation
description: "Owns the project's single Project Knowledge Base (项目知识网络) HTML file. Creates, updates, and re-renders the 11-section KB document. Every other analysis skill writes into the KB through this skill. Triggers on \"generate knowledge base\", \"项目知识网络\", \"项目知识底座\", \"update KB\", \"refresh knowledge base\", \"structure this project\", \"organize what we know\", \"build project profile\", or automatically when any other skill produces new findings."
---

# 知识网络生成（Knowledge Base Generation）

本 skill 是 plugin 的**核心输出技能**，唯一维护 `[AI] <项目名>_知识网络.html`（`[AI]` 前缀必须存在）。除 `ic-memo` 外，所有 skill 均通过本 skill 写入 KB。

## 执行前必读（硬性规则）

每次开始任务前，必须按顺序读取以下文件；仅阅读本文件后直接执行视为不合规：

1. `skills/knowledge-base-generation/SKILL.md`（流程与治理规则）
2. `STYLE_GUIDE.md`（样式、组件语法、标签/引用规范）
3. `skills/knowledge-base-generation/assets/components.html`（可复制 HTML 组件模板）

若三者存在冲突，优先级为：`SKILL.md`（业务规则） > `STYLE_GUIDE.md`（样式/标记规范） > `components.html`（示例实现）。

## 最小执行清单（5 条）

1. 解析输入（Handoff 或用户新信息）并映射到 canonical slot，禁止按浮动编号处理。
2. 逐 slot 判定状态（已填充 / Stub / 空），生成 render manifest 并据此重排编号与导航。
3. 仅用模板允许的结构渲染（`kb-template.html` + `STYLE_GUIDE.md` + `components.html`），不得自创 class 或改动底层 JS/CSS。
4. 对每条事实补齐确定性标注与来源引用（🟡/🔵 必须归因，tooltip 含摘录）。
5. 一次性原子写入：重渲 + 版本号递增 + changelog 一行 + 成熟度重算（Factor A 分母始终 11）。

## 渲染模式（由 project-intake 确定，贯穿 KB 生命周期）

| 模式 | 触发条件 | 效果 |
|------|---------|------|
| 单/多标的 | `project-intake` 步骤 2.4 | 多标的模式下，资产专属章节按子标的拆分为 `<h3>` 子节 |
| 纯中文/双语 | `project-intake` 步骤 2.2（海外项目） | 双语模式渲染中英并列内容 + 语言切换按钮 |
| Portable 主题（默认） | 默认；用户明确要求时切换灰色主题 | 所有 KB 默认米色背景/酒红/Playfair 字体，从 `kb-template.html` 起点填充 |

## 11 个 Canonical Slot

**数据层（永不变）**：11 个 slot 的 key 名称、锚点 ID、以及每个 skill 写入哪个 slot 的映射关系——这是所有 skill 定位写入目标的索引，不可修改。

**展示层（项目启动时确定）**：slot 的显示顺序由 `project-intake` 根据项目类型确定，写入 KB 头部的 `<!-- KB-CONFIG -->` 块，之后每次渲染读取此配置驱动 nav 顺序和章节编号。用户可随时请求"调整展示顺序"触发轻量重排，无需重新 intake。

| Slot key | 章节名称 | 锚点 ID | 主要写入 skill |
|----------|---------|---------|--------------|
| `snapshot` | 项目快照 | `#snapshot` | `project-intake`, `public-info-search` |
| `assets` | 资产构成 / 平台能力与资源 | `#assets` | `public-info-search`, `dd-claim-audit` |
| `legal-relationships` | 法律结构与关键关系网 | `#legal-relationships` | `background-check`, `public-info-search` |
| `business-model` | 业务模式与收入假设 | `#business-model` | `public-info-search` |
| `capital-structure` | 融资结构与资本结构 | `#capital-structure` | `public-info-search` |
| `comps` | 市场对标与可比交易 | `#comps` | `comp-analysis` |
| `returns` | 投资回报与敏感性分析 | `#returns` | `returns-analysis`, `sensitivity-analysis` |
| `timeline` | 项目时间轴 | `#timeline` | `node-monitoring`, `public-info-search` |
| `risks` | 关键风险与缓释 | `#risks` | `risk-matrix`, `dd-claim-audit` |
| `open-questions` | 待确认问题清单 | `#open-questions` | `gap-tracking`, `dd-checklist` |
| `decision-framework` | 决策框架 | `#decision-framework` | `value-creation-plan` + 综合 |

附录 slot（可隐藏）：附录 A 来源索引 `#source-index`（`document-reorganize`）、附录 B 术语表 `#glossary`（`term-annotator`）。

**`business-model` 描述目标公司盈利模式；`returns` 描述投资人回报（IRR/MOIC）。两者严格分离。**

## KB-CONFIG（展示层配置）

KB HTML `<body>` 开头必须包含 KB-CONFIG 注释块。`knowledge-base-generation` 每次渲染前读取此块确定展示顺序；`project-intake` 在新建 KB 时写入；"reset display order"时仅更新此块 + nav + 章节编号，不触碰内容面板。

### 格式规范

```html
<!-- KB-CONFIG
display-order: snapshot, assets, legal-relationships, business-model, capital-structure, comps, returns, timeline, risks, open-questions, decision-framework
project-type: real-estate-dev
rendering-mode: chinese-only
multi-asset: false
config-version: 1
display-order-history:
  2026-06-09 | intake | 初始顺序，项目类型 real-estate-dev 默认
-->
```

字段说明：
- `display-order`：当前展示顺序，仅含已知 slot key（逗号分隔）；渲染时跳过内容为空的 slot
- `project-type`：8 类类型码之一（见 `project-intake` SKILL.md 的类型表）
- `rendering-mode`：`chinese-only` 或 `bilingual`
- `multi-asset`：`true` / `false`
- `config-version`：每次修改 display-order 时 +1
- `display-order-history`：追加式日志，每行格式 `日期 | 触发来源 | 简述`

### Reset Display Order（轻量更新，最小 token）

触发词：用户说"调整展示顺序"/"把 X 移到 Y 前面"/"重排章节"等。

执行三步，不询问、不重渲内容面板：

1. 读取 KB-CONFIG 中现有 `display-order`，按用户意图修改顺序
2. KB-CONFIG 末尾追加一行 `display-order-history`（格式：`日期 | reset | 用户说明`，无说明写"用户未说明原因"）；`config-version` +1
3. 全量更新 nav 按钮顺序 + 各 section `<h2>` 编号——**不触碰任何内容面板**

版本号：minor bump（x.y → x.y+1）。Chat 回复：一句话确认新顺序，例："已调整：快照 → 资产 → 回报 → …"

### 跨项目模式总结（用于优化默认顺序）

当用户说"分析调整记录优化默认顺序"时：扫描所有可访问路径下的 `[AI] *_知识网络.html`，提取每个 KB-CONFIG 的 `display-order-history`，按 `project-type` 分组归纳规律，输出优化建议供用户确认后写入本 SKILL.md 的各类型默认顺序。

## 隐藏与重新编号

Slot 渲染 ↔ 有实质内容。空 slot（无任何 skill 评估）完全不输出——无 `<section>` 无导航无编号。存活 slot 按 KB-CONFIG `display-order` 的顺序从一开始连续重新编号。

**跨章节引用硬性规则**：所有跨节引用必须使用 HTML 锚点形式，例如 `<a href="#returns">投资回报</a>`。**绝对禁止**使用"第七节"、"见上节"、"见下节"等浮动编号或位置描述——一旦 display-order 变更，此类引用立即失效且难以批量修正。违反此规则的写入视为不合规，须在写入前自行修正。

## KB 布局（面板切换器）

KB 是左侧边栏面板切换器，非长滚动文档。结构：`<div class="kb-shell"><nav class="kb-nav">…</nav><main class="kb-content">…</main></div>`。

- **`#overview` 面板**（默认 `.active`）：仅含 `.masthead` + `.kb-summary`（≤200 字自动摘要）。不在 slot 面板内重复 masthead。
- 导航按钮列在渲染时从 render manifest 动态生成，禁止硬编码。`#overview` 按钮标签「项目总览」，`.kb-nav-num` 用 `◎`。
- 面板切换 JS 已内置于 `kb-template.html`，不要修改。
- 详细 HTML/CSS 规范见 `STYLE_GUIDE.md` 与 `assets/components.html`。

## 交接协议（Handoff Block）

**本 skill 是 KB HTML 的唯一所有者。** 其他 skill 通过结构化交接块交付数据，禁止直接写入 HTML。

```
---KB-HANDOFF---
from-skill:   <skill 名称>
target-slots: [<slot-key-1>, <slot-key-2>]
update-mode:  merge | replace
version-bump: minor | major
findings:
  <slot-key-1>:
    <结构化内容>
  <slot-key-2>:
    <结构化内容>
new-sources:
  - id: A-N
    type: AI生成 | 用户上传
    title: <来源标题>
    url: <如适用>
    excerpt: <1–2 句原文摘录，≤200 字>
new-terms: [<term1>, <term2>]
---END-HANDOFF---
```

收到交接块后：解析 slot → 统计受影响数量 → 定向/全量重渲 → 追加 `new-sources` 到附录 A → 传 `new-terms` 给 `term-annotator` → 更新版本号 → 写入 HTML。

## 工作流程

### 步骤 1：确定执行模式

| 模式 | 触发 | 操作范围 |
|------|------|---------|
| 新建 | KB 文件不存在 | 始终全量 |
| 更新 | 收到交接块 | ≤3 slot 且 display-order 不变 → **定向**；否则全量 |
| 重审 | 用户说"刷新全文"或成熟度偏差 | 始终全量 |
| **重排** | 用户说"调整展示顺序"/"重排"/"把 X 移到 Y 前面" | **仅更新 KB-CONFIG + nav + 章节编号**，不触碰内容面板 |

**不要询问用户选哪种模式**，本 skill 自动判断。

### 步骤 1.5：实体归并（硬性规则）

写入前规范化所有实体名：建立实体主表（规范名←别名映射）。同一实体在 KB 全文中只用规范名。解析人↔实体代表关系，标注归因时用规范实体名。**新建和重审时均须运行。**

### 步骤 2：Slot 状态分类

| 状态 | 判定 | 输出 |
|------|------|------|
| **已填充** | ≥1 子题有实质证据 | 完整渲染；缺失子题用内联"——待补充" |
| **Stub** | skill 已检查并记录"无内容"，缺口对用户有价值 | 单个 `<aside class="callout missing">` |
| **空（隐藏）** | 无任何 skill 评估，或被清除 | 完全不输出 |

分类完成后建立 render manifest（`{slotKey, state, displayNumeral}`）驱动输出。

### 步骤 3：各章节内容要点

- **snapshot**：项目名/地点/资产类型、交易对手法人名、指引价、当前阶段、一句话成熟度、Factor A/B/%
- **assets（类型自适应）**：实物资产型 → 资产清单、规模数字、审批状态；平台/贸易型 → 政府关系、资质配额、物流能力、团队 know-how，每条注明自有/绑定/第三方
- **legal-relationships**：持股架构图、实控人、关键关系人、三方顾问、关联交易、跨境架构。*监管路径/牌照申请流程不属于本节（归入 business-model 外部调研）*
- **business-model**：先按 STYLE_GUIDE.md 选可视化形式（Journey Map / Process Flow / BMC 等），再列收入拆分、单位经济、主要客户、关键运营假设。外部调研 topic 用可折叠 `<details class="topic">`，状态标语义标签（待调研/部分解答/已解答）。*投资人回报数字归入 returns，不在本节*
- **capital-structure**：总投资额拆解、资金来源与用途、现有股权结构、拟议交易结构、债务条款
- **comps**：直接可比主体/交易（名称、规模、对价、倍数）；无对标时保留 callout.missing，不用宏观数据填充
- **returns**：三档情景（base/upside/downside）的 IRR/MOIC/Cash-on-Cash/Payback、关键假设（🟡/⚪ 高亮）、敏感性分析（Tornado + 双变量矩阵 + 盈亏平衡）
- **timeline**：三子块——8.1 已发生（年→月→日层级展开）、8.2 推进中、8.3 未来节点（表格含"影响程度"badge + "结果触发行动"列）。*只收录本项目实体的事件，行业历史归入 business-model 外部调研*
- **risks**：风险矩阵（Likelihood × Impact）、critical/high 风险明细（来源+mitigation+责任人）、红线风险
- **open-questions**：仍须项目方提供的缺口，按所属 section 分组表格，列：待补充项/紧迫度/负责方/详见
- **decision-framework**：投资论点（3–5条带证据）、投后增值杠杆、决策选项 trade-off、推荐意见、下一步清单

### 步骤 4：缺乏资料 Callout

见 `STYLE_GUIDE.md` `.callout.missing` 模板。提示列表必须**针对具体项目类型**，不能写"请补充更多资料"这类泛化文字。

### 步骤 5：确定性标注（每条数据必须标注）

| 标注 | 含义 |
|------|------|
| ✅ 已核实 | ≥2 个独立来源交叉核实，或权威来源 |
| 🟡 当事方声明 | 某当事方声称，未独立确认——**必须注明哪个当事方**（规范实体名） |
| 🔵 分析师推论 | 推导结论——**必须注明 AI推论 或 内部分析师** |
| ⚪ 待确认 | 已提及但未核实 |

🟡/🔵 不标归因不再被接受。HTML 语法见 `STYLE_GUIDE.md` "Tags and badges"。

### 步骤 6：来源链接

每段已填充内容必须链回来源（tooltip 格式，含 1–2 行原文摘录）。来源 ID：`U-N` 用户上传，`A-N` AI 生成。详见 `STYLE_GUIDE.md` "Tooltip-Enabled Citations"。

### 步骤 7：术语注释

渲染完成后扫描新引入技术术语，调用 `term-annotator` 在**首次出现处**插入 tooltip 标注，并写入附录 B。后续出现不加（避免 `*` 泛滥）。

### 步骤 8：版本号与 Changelog

| 触发 | 版本变化 |
|------|---------|
| 首次生成 | → v1.0 |
| 定向更新（≤3 slot，顺序不变） | x.y → x.(y+1) |
| 全量重渲（≥4 slot 或顺序变化）或用户要求刷新 | x.y → (x+1).0 |

每次在 HTML 底部追加一行 changelog：`vX.Y | 日期时间 | 来源 skill | 变更摘要`。

### 步骤 9：成熟度重算

- **Factor A** = 11 个 canonical slot 完备度均值（分母始终为 11，空 slot 得 0，Stub slot 5–15%）
- **Factor B** = 来源多样性（附录 A）
- 综合成熟度 = 0.6 × A + 0.4 × B
- 多标的：Factor A 先按子标的/slot 计算，显示每子标的分项分数，禁止合并为单一数字
- 跨越阶段边界时（Early→Mid→Mature）在 chat 提示用户

### 步骤 10：头部与骨架

从 `kb-template.html` 起点填充。**新建时**在 `<body>` 开头写入 KB-CONFIG 注释块（`project-intake` 已提供字段值）；**更新/重审时**先读取现有 KB-CONFIG 确定 display-order，再渲染。Header 使用 `STYLE_GUIDE.md` "Masthead" 两栏布局，三色 stat-row（Factor A 浅米 / Factor B 中酒红 / 综合成熟度 深酒红）。`ai-badge` 始终显示。`meta-row` 的 `dt` 文本不加冒号或末尾「·」。

## 输出格式

- **Chat**：更新了什么章节、哪些编号变化、新的成熟度分数、建议下一步
- **HTML 文件**：`[AI] <项目名>_知识网络.html`，保存到项目文件夹根目录
- **新建**：从 `kb-template.html` 填充占位符，不重写 CSS/JS
- **更新**：只编辑相关 `<section>` 面板内容，不触碰 `<style>` 块或底部 `<script>`
- **保存前自检**：① 只有 `#overview` 的按钮和面板有 `.active` ② masthead/summary 只在 `#overview` ③ 每个渲染 slot 有对应导航按钮 ④ `</body>` 前有 `<script>` 块

## 重要规则

- **单一数据源**：所有非 IC 输出均写入此文件，禁止创建独立"层级"HTML
- **隐藏而非填充**：空 slot 隐藏，不用泛化"暂无资料"占位符
- **确定性标注不可省略，🟡/🔵 必须归因**
- **原子性更新**：一轮对话的所有 slot 一次性写入，一次版本号递增，一行 changelog
- **章节名称由类型自适应规则决定**，AI 不得单方面更改 `<h2>` 标题。新增 canonical slot 外的章节须先在 chat 获用户确认
- **每次对话的任何新信息**（哪怕随口一句）必须分类到对应 slot 并触发更新

## 边界案例提醒

Plugin 安装后 skill 文件只读，Claude 无法自动写入经验。当遇到以下情况时，在**本次对话末尾**用固定格式提醒用户，由用户决定是否开启更新会话手动写入 SKILL.md：

- 当前指令未覆盖的特殊情况或边界案例
- 用户给出了纠正或更好的建议
- 发现值得复用的成功模式
- 原有指令存在歧义或冲突

提醒格式：
```
💡 建议写入 SKILL.md：[简短描述发现]
原因：[为什么值得复用]
```
