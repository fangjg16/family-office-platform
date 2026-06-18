# 粘贴到 Railway Hermes Dashboard → SOUL / CONFIG

## 联合家办平台 · 资料来源

当用户提到家办平台项目（`projectId`）或「网站上传的资料」时：

1. **禁止**默认 Cowork 本地项目文件夹里有尽调 PDF。
2. **必须先**执行 `jfo-r2-materials`：`GET manifest`（轻量）；有对话附件时 `scope=session` 或 `scope=all`。
3. **按需** `GET textUrl` 正文——按任务类型读取必要材料，非机械全文拉取。
4. 再执行 `project-intake`、`opportunistic-investments-hermes` 等。

环境变量：`JFO_API_PUBLIC_BASE`、`JFO_INTERNAL_KEY`。

**Canonical KB skill 路径**：`/opt/data/skills/opportunistic-investments-hermes/`（**禁止** `~/.hermes/skills` 或 `/opt/data/home/.hermes/skills`）。

---

## 知识网络（opportunistic-investments-hermes · Hermes v2.92 / schema v2.91）

触发：项目知识网络 / 生成 KB / 更新 KB / 调整展示顺序。

**禁止** `skill_view knowledge-base-generation`（legacy v2.8 已迁至 `knowledge-base-generation_deprecated`）。

### 按任务模式 read_file

路径前缀：`/opt/data/skills/opportunistic-investments-hermes/`

**首次 / 全量 / 增量（写 HTML）**

1. `SKILL.md`
2. `references/kb-schema.md`（13 core slots + Appendix A–D）
3. `references/kb-config.md`
4. `references/content-rules.md`
5. `references/slot-specific-rules.md`
6. `references/slot-rendering-rules.md`
7. `references/maturity-scoring.md`
8. `references/timeline-rules.md`（触及 timeline-milestones 时）
9. `assets/kb-template.html`
10–16. `references/deep/*.md`（initial/full 7 个；incremental 按 slot；reorder 不读）

**仅重排展示顺序**

1. `references/kb-config.md`
2. `SKILL.md`
3. 当前 KB HTML（GET Worker bridge）
4. **禁止**拉项目资料全文、deep refs、components.html

**全量重做**：**禁止** `web_search`（除非用户明确要求「查外部资料」）。

### KB-CONFIG（PUT 与 Worker 校验统一）

- 必须使用 **HTML 注释行格式**（与 `assets/kb-template.html` 一致）：
  ```
  <!-- KB-CONFIG
  schema-version: 2.91
  display-order: snapshot, ...
  -->
  ```
- **禁止**仅用 JSON `<script>` 承载 schema-version。

### PUT（文件 API 主链路）

**禁止**自行拼 curl/python PUT。必须使用：

```bash
bash /opt/data/skills/opportunistic-investments-hermes/scripts/jfo_kb_put.sh \
  --file ./kb/<projectId>/工作文件.html \
  --api-base "$JFO_API_PUBLIC_BASE" \
  --project-id "<projectId>" \
  --user-id "<userId>" \
  --job-id "<jobId>" \
  --mode full
```

- PUT 成功（输出 `PUT OK`）：回复仅 3–8 行摘要，**不附**整页 HTML。
- PUT 400：最多修正一次；仍失败则停止并报告 validation error，可附 ` ```html ` fallback。

**禁止**：legacy v2.8 anchors、`skills_reference.md`、根目录 `kb-template.html`、`knowledge-base-generation/`。

未完成当前模式规定的 read_file **不得**输出 HTML。
