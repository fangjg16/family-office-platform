# 合域 Opportunistic Investments · Hermes / 家办平台速读

> 完整说明见 plugin `README.md`。本文供 **Railway Hermes** 在生成知识网络前 `read_file`，控制在 2 分钟内读完。

## 版本

- Plugin：**v2.7**（heyu-opportunistic-investments）
- 家办网站资料：**非本地文件夹**，须先 `jfo-r2-materials`（curl Worker manifest + textUrl）

## 工作顺序（家办）

1. `jfo-r2-materials` — 拉取 `scope=package` 与（如有）`scope=session|all`
2. 按需 `project-intake` — 入驻/成熟度（新项目）；识别 **8 类 project-type**，写入 **KB-CONFIG**
3. `knowledge-base-generation` — 维护唯一 `[AI] <项目包名>_知识网络.html`
4. 其他 skill（尽调、风险、回报等）产出 **写入 KB**，不另建分散文档
5. `ic-memo` — **独立 Word**，不写入 KB

## AI 文件命名

- 知识网络：`[AI] <项目包名>_知识网络.html`（项目包名，非单个子标的名）
- IC 备忘录：`[AI] IC备忘录_<项目包名>_<日期>.docx`（海外可加英文版）

## KB 11 Canonical Slots（锚点固定，展示顺序由 KB-CONFIG 驱动）

slot key：`snapshot` · `assets` · `legal-relationships` · `business-model` · `capital-structure` · `comps` · `returns` · `timeline` · `risks` · `open-questions` · `decision-framework` · 附录 A/B

- **数据层**：11 个 slot 的 key、锚点 ID、skill→slot 映射 **永不变**
- **展示层**：`<!-- KB-CONFIG -->` 中的 `display-order` 决定 nav 顺序与章节编号（`project-intake` 新建时写入；用户可「重排章节」轻量更新）
- **四 vs 七**：`business-model` = 标的公司怎么赚钱；`returns` = 投资人回报（IRR/MOIC）
- **Factor A 分母**：始终 **11** 个 canonical slots
- **缺乏资料**：用 STYLE_GUIDE callout，按 **project-type** 给具体索取建议
- **多标的**：`multi-asset: true`；按子标的拆章节
- **海外**：`rendering-mode: bilingual`

## KB-CONFIG 必填字段

`display-order` · `project-type`（8 类）· `rendering-mode` · `multi-asset` · `config-version` · `display-order-history`

重排模式：仅更新 KB-CONFIG + nav + `<h2>` 编号，**不触碰内容面板**。

## 确定性标签

✅ 已核实 · 🟡 当事方声明（须归因）· 🔵 分析师推论（须归因）· ⚪ 待确认

## 与本目录其他文件

| 文件 | 用途 |
|------|------|
| `references/STYLE_GUIDE.md` | HTML/CSS/组件/引用/时间轴 — **KB 必读** |
| `kb-template.html` | 壳 + CSS + panel-switcher + KB-CONFIG 占位 — **禁止改 JS/CSS** |
| `assets/components.html` | 可拷贝组件片段 |
| `SKILL.md` | 本 skill 流程、KB-CONFIG、slot 规则 |

## 家办交付（非 Cowork 磁盘）

- 网站 Worker 要求：尽量 `curl PUT` 知识网络 API；同时回复末尾附完整 ` ```html ` 整页
- 勿只写「已保存到路径」而不附 HTML
