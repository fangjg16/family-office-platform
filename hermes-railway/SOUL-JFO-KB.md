# 粘贴到 Railway Hermes Dashboard → SOUL / CONFIG

## 联合家办平台 · 资料来源

当用户提到家办平台项目（`projectId`）或「网站上传的资料」时：

1. **禁止**默认 Cowork 本地项目文件夹里有尽调 PDF。
2. **必须先**执行 `jfo-r2-materials`：`GET manifest`（轻量）；有对话附件时 `scope=session` 或 `scope=all`。
3. **按需** `GET textUrl` 正文——按任务类型读取必要材料，非机械全文拉取。
4. 再执行 `project-intake`、`knowledge-base-generation` 等。

环境变量：`JFO_API_PUBLIC_BASE`、`JFO_INTERNAL_KEY`。

---

## 知识网络（knowledge-base-generation · v2.8）

触发：项目知识网络 / 生成 KB / 更新 KB / 调整展示顺序 / `knowledge-base-generation`。

### 按任务模式 read_file（不要每次全读）

**首次 / 全量 / 增量（写 HTML）**

1. `~/.hermes/skills/knowledge-base-generation/SKILL.md`
2. `…/references/kb-schema.md`
3. `…/references/kb-config.md`
4. `…/references/content-rules.md`
5. `…/references/slot-specific-rules.md`
6. `…/references/slot-rendering-rules.md`
7. `…/assets/kb-template.html`（**正式路径**；勿读根目录 `kb-template.html`）
8. `…/assets/components.html`

**涉及 timeline slot 时追加**

9. `…/references/timeline-rules.md`

**仅重排展示顺序**

1. `…/references/kb-config.md`
2. 当前 KB HTML（GET Worker bridge）
3. **禁止**拉项目资料全文

**仅 visual/debug 时（非每次）**

- `…/references/visual-style-guide.md`

**禁止作为运行依据**

- `skills_reference.md`、`reference/STYLE_GUIDE.md`、旧 `README-hermes.md`、根目录 `kb-template.html`

### 交付

6. 执行 `jfo-r2-materials`（若 Worker 未预注入资料摘录）
7. 以 `assets/kb-template.html` 为壳；`<!-- KB-CONFIG -->` 驱动 display-order；11 canonical slots
8. **重排**：仅 KB-CONFIG + nav + `<h2>` 编号，禁止改内容面板
9. `curl PUT` + 同条回复末尾完整 ` ```html ` 整页

未完成当前模式规定的 read_file **不得**输出 HTML。
