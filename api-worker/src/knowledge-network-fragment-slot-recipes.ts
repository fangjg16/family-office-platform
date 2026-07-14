import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { SLOT_DEFAULT_TITLES } from "./knowledge-network-slot-render";

/** Codex render_kb_html.py + slot-rendering-rules 提炼的 per-slot HTML 食谱（源头对齐，非末端校验） */

const JOURNEY_SKELETON = `<div class="journey-wrap"><div class="journey" style="--journey-cols:4">
<div class="journey-corner"></div>
<div class="journey-stage">阶段一</div><div class="journey-stage">阶段二</div><div class="journey-stage">阶段三</div><div class="journey-stage">阶段四</div>
<div class="journey-lane-label">路径 A</div>
<div class="journey-node">节点</div><div class="journey-node">节点</div><div class="journey-node">节点</div><div class="journey-node">节点</div>
</div></div>`;

const BUSINESS_OPERATIONS_RECIPE = `
### business-operations · 业务模式与运营假设（Codex 主路径）

**两步选择（先读懂商业模式，再选组件）**：
1. **判断模式形态**：多路径变现？单线运营链？稳定单点 BMC？收入按产品线/客户/地区拆分？飞轮？多边平台？
2. **选最贴切的单一主可视化**（\`render_kb_html.py\` 用 elif 互斥，整页只保留一个主区）：
   - 多路径 → \`journey-wrap\`
   - 单线链 → \`process-flow\`
   - 稳定单点 → \`bmc\`
   - 收入拆分叙事 → revenue-tree **表**
   - 自增强循环 → flywheel 表
   - 多边平台 → ecosystem 表

**禁止**把 Revenue Tree 当页面标题或整页 gap 列表；缺口写在验证表 gap 列或 \`callout missing\`，主区仍保留 journey/BMC **骨架**。

主可视化之后 **必须** 跟四张验证表（表头同 sample-output）：
1. 应用/产品场景 · 价值主张 · 证据/缺口
2. 客户/受众/付费方 · 需求 · 获客/渠道 · 验证状态
3. 收入来源 · 定价/费率 · 成本/履约 · 单位经济/KPI
4. 待验证假设 · 为什么关键 · 验证方式

**journey-wrap 骨架**：
\`\`\`html
${JOURNEY_SKELETON}
\`\`\`
`;

const RISKS_HTML_SKELETON = `<table class="risk-matrix-table"><thead><tr><th>级别</th><th>风险</th><th>原因/触发</th><th>影响</th><th>证据</th><th>缓释/负责人/状态</th></tr></thead><tbody><tr><td><span class="risk-level risk-level-high">高</span></td><td>…</td><td>…</td><td>…</td><td><sup class="cite-ref"><a href="#source-A-2">[A-2]</a></sup></td><td>…</td></tr></tbody></table>`;

const TIMELINE_HTML_SKELETON = `<p class="section-sub">PROJECT TIMELINE · 仅记录项目自身节点</p>
<h3>8.1 已发生关键事件</h3><div class="timeline"><div class="tl-item"><span class="tl-date">2026-06-12</span><span class="tl-text"><strong>节点</strong> 描述</span></div></div>
<h3>8.2 正在推进</h3><div class="timeline"><div class="tl-item timeline-ongoing"><span class="tl-date">进行中</span><span class="tl-text">…</span></div></div>
<h3>8.3 未来关键节点</h3><div class="timeline"><div class="tl-item timeline-deadline"><span class="tl-date">T+7</span><span class="tl-text">…</span></div></div>`;

const VALUATION_HTML_SKELETON = `<div class="valuation-grid">
<div class="valuation-box"><div class="valuation-label">投资额</div><div class="valuation-value">待定</div><div class="valuation-note">无融资方案</div></div>
</div>
<div class="scenario-grid">
<div class="scenario-cards">
<div class="scenario-card down"><div class="sc-label">Downside</div><div class="sc-irr">待测算</div><div class="sc-detail">…</div></div>
<div class="scenario-card base"><div class="sc-label">Base</div><div class="sc-irr">待测算</div><div class="sc-detail">…</div></div>
<div class="scenario-card up"><div class="sc-label">Upside</div><div class="sc-irr">待测算</div><div class="sc-detail">…</div></div>
</div></div>`;

const LEGAL_TABLE_SKELETON = `<table><thead><tr><th>主体/权利</th><th>角色/归属</th><th>限制/负担</th><th>证据/缺口</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td><td>…</td></tr></tbody></table>`;
const DECISION_HTML_SKELETON = `<aside class="callout info"><div class="callout-title">条件式建议</div><p>…</p></aside>
<table><thead><tr><th>投资论点</th><th>证据</th><th>前置条件</th><th>反证/风险</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td><td>…</td></tr></tbody></table>
<aside class="callout warning"><div class="callout-title">IC Readiness</div><p>…</p></aside>`;

const DILIGENCE_OQ_SKELETON = `<p class="section-sub">OPEN QUESTIONS · 按优先级排序</p>
<details class="oq-group" open><summary><span class="oq-title">P1 · 必须确认</span><span class="oq-count">1 项</span></summary><ol class="oq-list"><li class="oq-item"><span class="oq-num">①</span>示例问题<span class="oq-action"> —— 影响：…；责任方：…；下一步：…</span></li></ol></details>
<details class="oq-group" open><summary><span class="oq-title">P2 · 建议确认</span><span class="oq-count">1 项</span></summary><ol class="oq-list"><li class="oq-item"><span class="oq-num">②</span>…</li></ol></details>`;

const SLOT_RECIPES: Partial<Record<CanonicalKbSlot, string>> = {
  snapshot: `
### snapshot · 项目快照
- \`aside.callout.info\` → \`callout-title\`「一句话判断」+ 1 段 ≤80 字定位（可引用 #source-）
- 可选 metric-cards / 关键数字表；勿灌 PDF 原文`,
  "target-overview": `
### target-overview · 标的概况
- 标准四列表：资产/权利/能力 · 定义与范围 · 可投资性 · 关键证据/缺口`,
  "industry-market": `
### industry-market · 行业与市场
- 主题/事实/投资含义/来源 表；行业史放此处，非 timeline
- 上传资料薄时读 \`references/deep/public-info-search.md\` 补公开背景；新公开来源用 \`sourceProposals\`（type 含「公开」→ Worker 分配 A-N）`,
  "business-operations": BUSINESS_OPERATIONS_RECIPE,
  "resource-network": `
### resource-network · 资源网络
- 主体/资源 · 关系与作用 · 强度/可验证性 · 依赖与风险
- 渠道/政府路径/关键人见 \`public-info-search\`；勿与 legal-ownership 重复权属事实`,
  "legal-ownership": `
### legal-ownership · 法律权属
- 主体/权利表 + 关系链表（从/到/状态/风险）；见 \`compliance-check\` / dd-claim-audit deep ref
\`\`\`html
${LEGAL_TABLE_SKELETON}
\`\`\``,
  "regulatory-compliance": `
### regulatory-compliance · 监管合规
- 监管/规则 · 适用原因 · 状态/许可 · 红线/下一步（合规矩阵表）`,
  "comps-benchmark": `
### comps-benchmark · 市场对标
- 可比对象 · 可比逻辑 · 指标/倍数 · 可借鉴/差异；公开可比用 \`sourceProposals\` 登记 A-N`,
  "valuation-returns": `
### valuation-returns · 投资回报
- \`valuation-grid\` + \`scenario-cards\`（Downside/Base/Upside）+ 假设/敏感性表；勿编造 IRR
\`\`\`html
${VALUATION_HTML_SKELETON}
\`\`\``,
  "diligence-gaps": `
### diligence-gaps · 尽调缺口
- **必须**用可折叠 \`<details class="oq-group">\` + \`<summary><span class="oq-title">…</span><span class="oq-count">N 项</span></summary>\` + \`<ol class="oq-list">\`（与 Codex \`render_kb_html.py\` / \`sample-output.html\` 对齐）
- **禁止** \`<div class="oq-group"><h3>\` 或内嵌问题表（kb-template CSS 只认 \`summary\` 子元素）
- 每条 \`li.oq-item\`：\`span.oq-num\`（①②③）+ 问题 + \`span.oq-action\`（影响/责任方/下一步/引用）
\`\`\`html
${DILIGENCE_OQ_SKELETON}
\`\`\``,
  "risks-mitigation": `
### risks-mitigation · 关键风险
- \`table.risk-matrix-table\` + 停推条件表；严重度用 \`span.risk-level risk-level-high\` 等（禁止 emoji）
\`\`\`html
${RISKS_HTML_SKELETON}
\`\`\``,
  "timeline-milestones": `
### timeline-milestones · 项目时间轴
- 必读 \`references/timeline-rules.md\`；仅项目节点，不放行业史
- h3 固定为 **8.1 / 8.2 / 8.3**（非 slot 序号）；\`div.timeline\` + \`tl-item\`
\`\`\`html
${TIMELINE_HTML_SKELETON}
\`\`\``,
  "decision-framework": `
### decision-framework · 决策框架
- \`callout.info\` 建议 + 论点/选项/增值杠杆/下一步表 + \`callout.warning\` IC Readiness
\`\`\`html
${DECISION_HTML_SKELETON}
\`\`\``,
};

export function buildFragmentSlotRenderingRecipe(slot: CanonicalKbSlot): string {
  const d = SLOT_DEFAULT_TITLES[slot];
  const body = SLOT_RECIPES[slot] ?? "";
  return `- **${slot}**（${d.num} · ${d.title}）${body}`;
}

export function buildFragmentBatchRenderingRecipes(slots: readonly CanonicalKbSlot[]): string {
  const lines = [
    "",
    "【本批 Slot 渲染食谱 · 与 Codex render_kb_html.py + slot-rendering-rules 对齐】",
    FRAGMENT_CODEX_ESSENTIALS,
    "按下列结构 **直接写 HTML**；读 \`assets/components.html\` + \`sample-output.html\` 对照 class 名。",
  ];
  for (const slot of slots) {
    lines.push(buildFragmentSlotRenderingRecipe(slot));
  }
  return lines.join("\n");
}

export const FRAGMENT_CODEX_ESSENTIALS = `
**全批 HTML 约定（Codex · 生成时遵守，Worker 不重写）**
- \`<h2 class="section-title"><span class="section-num">一…十三</span>标题</h2>\` — 中文序号，禁止阿拉伯 1/2/3
- Factor A/B **由 Worker 计算写入 masthead**；slot 正文禁止自报 \`C · 22%\` / maturity 分数
- 标题禁止 emoji；警示用 \`callout\`，风险严重度用 \`span.risk-level\`
- 禁止整页 shell / KB-CONFIG / nav`;

export const BATCH0_OVERVIEW_META_INSTRUCTION = `
**batch 0 额外 JSON 字段 \`overviewMeta\`**（写入页面 masthead，非 slot fragment）：
- \`lead\`：masthead 副标题下 **一句话定位**（≤80 字，合成判断，勿贴 PDF 摘录）
- \`autoSummary\`：**项目概览** ≤200 字（合成：标的+阶段+资料边界；同 structured-kb-data \`meta.autoSummary\` / kb-template \`{{AUTO_SUMMARY}}\`）
- 可读 \`kb-config.md\` 判断 projectType；display-order 默认由 Worker shell 提供，勿在 fragment 写 KB-CONFIG
- **禁止**写「已索引 N 份资料」类元信息；Worker 不会替你生成概览。`;
