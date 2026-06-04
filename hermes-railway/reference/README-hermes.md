# 合域 Opportunistic Investments · Hermes / 家办平台速读

> 完整说明见 plugin `README.md`。本文供 **Railway Hermes** 在生成知识网络前 `read_file`，控制在 2 分钟内读完。

## 版本

- Plugin：**v2.5**（heyu-opportunistic-investments）
- 家办网站资料：**非本地文件夹**，须先 `jfo-r2-materials`（curl Worker manifest + textUrl）

## 工作顺序（家办）

1. `jfo-r2-materials` — 拉取 `scope=package` 与（如有）`scope=session|all`
2. 按需 `project-intake` — 入驻/成熟度（新项目）
3. `knowledge-base-generation` — 维护唯一 `[AI] <项目包名>_知识网络.html`
4. 其他 skill（尽调、风险、回报等）产出 **写入 KB**，不另建分散文档
5. `ic-memo` — **独立 Word**，不写入 KB

## AI 文件命名

- 知识网络：`[AI] <项目包名>_知识网络.html`（项目包名，非单个子标的名）
- IC 备忘录：`[AI] IC备忘录_<项目包名>_<日期>.docx`（海外可加英文版）

## KB 11 章节（槽位固定，编号动态）

一 项目快照 · 二 资产/平台能力 · 三 法律关系 · 四 业务模式 · 五 融资结构 · 六 可比 · 七 **投资人回报** · 八 时间轴 · 九 风险 · 十 待确认 · 十一 决策框架 · 附录 A 来源 · 附录 B 术语

- **四 vs 七**：四 = 标的公司怎么赚钱；七 = 投资人在这笔交易里赚多少（IRR/MOIC 等）
- **缺乏资料**：用 STYLE_GUIDE 的 callout，按 sector 给具体索取建议，勿省略章节
- **多标的**：按子标的拆 二/三/四/五/七/八/九，缺资料的子标的须显式标注
- **海外**：双语 KB + 语言切换（intake 判定 jurisdiction）

## 确定性标签

✅ 已核实 · 🟡 当事方声明（须归因）· 🔵 分析师推论（须归因）· ⚪ 待确认

## 与本目录其他文件

| 文件 | 用途 |
|------|------|
| `references/STYLE_GUIDE.md` | HTML/CSS/组件/引用/时间轴 — **KB 必读** |
| `kb-template.html` | 壳 + CSS + panel-switcher — **禁止改 JS/CSS** |
| `assets/components.html` | 可拷贝组件片段 |
| `SKILL.md` | 本 skill 流程与 slot 规则 |

## 家办交付（非 Cowork 磁盘）

- 网站 Worker 要求：尽量 `curl PUT` 知识网络 API；同时回复末尾附完整 ` ```html ` 整页
- 勿只写「已保存到路径」而不附 HTML
