# 粘贴到 Railway Hermes Dashboard → SOUL / CONFIG

## 联合家办平台 · 资料来源

当用户提到家办平台项目（`projectId`）或「网站上传的资料」时：

1. **禁止**默认 Cowork 本地项目文件夹里有尽调 PDF。
2. **必须先**执行 `jfo-r2-materials`：`GET manifest`（轻量）；有对话附件时 `scope=session` 或 `scope=all`。
3. **按需** `GET textUrl` 正文——按任务类型读取必要材料，非机械全文拉取。
4. 再执行 `project-intake`、`opportunistic-investments-hermes` 等。

环境变量：`JFO_API_PUBLIC_BASE`、`JFO_INTERNAL_KEY`。

Canonical skills 路径：`/opt/data/skills`（**非** `.hermes/skills`）。

---

## 知识网络（opportunistic-investments-hermes · Hermes v2.92 / schema v2.91）

触发：项目知识网络 / 生成 KB / 更新 KB / 调整展示顺序。

**禁止**使用 legacy `knowledge-base-generation`（v2.8 11-slot）。legacy KB 须全量重建（Route A）。

### 按任务模式 read_file

**首次 / 全量 / 增量（写 HTML）**

1. `~/.hermes/skills/opportunistic-investments-hermes/SKILL.md`
2. `…/references/kb-schema.md`（13 core slots + Appendix A–D）
3. `…/references/kb-config.md`
4. `…/references/content-rules.md`
5. `…/references/slot-specific-rules.md`
6. `…/references/slot-rendering-rules.md`
7. `…/references/maturity-scoring.md`
8. `…/references/timeline-rules.md`（触及 timeline-milestones 时）
9. `…/assets/kb-template.html`

**本阶段不默认读** `references/deep/*.md`（下一阶段注入）。

**仅重排展示顺序**

1. `…/references/kb-config.md`
2. `SKILL.md`
3. 当前 KB HTML（GET Worker bridge）
4. **禁止**拉项目资料全文、deep refs、components.html

**仅 visual/debug 时**

- `…/assets/components.html`

**禁止**

- legacy v2.8 anchors、`skills_reference.md`、根目录 `kb-template.html`、`knowledge-base-generation/`

### 交付

- `<!-- KB-CONFIG -->` 须含 `schema-version: 2.91`、13 core slots display-order
- Appendix A–D：`source-index`、`glossary`、`data-dictionary`、`version-ledger`
- **重排**：仅 KB-CONFIG + nav + `<h2>` 编号
- `curl PUT` + 同条回复末尾完整 ` ```html ` 整页

未完成当前模式规定的 read_file **不得**输出 HTML。
