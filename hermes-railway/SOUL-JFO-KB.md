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

**首次 / 全量（structured-kb-data 主路径）**

1. `SKILL.md`
2. `references/kb-schema.md`（13 core slots + Appendix A–D）
3. `references/kb-config.md`
4. `references/content-rules.md`
5. `references/slot-specific-rules.md`
6. `references/slot-rendering-rules.md`
7. `references/maturity-scoring.md`
8. `references/timeline-rules.md`
9. `references/structured-kb-data-schema.md`
10. `examples-kb-data.json`（payload 形状与 Worker `SlotPayloadBySlot` 对齐）
11–17. `references/deep/*.md`（7 个）

**增量（单 slot structured-slot-patch 主路径）**

同上 core rules；**不读** `kb-template.html`（Worker 渲染）；按 slot 读 deep refs。

**仅重排展示顺序**

1. `references/kb-config.md`
2. `SKILL.md`
3. 当前 KB HTML（GET Worker bridge）
4. **禁止**拉项目资料全文、deep refs、components.html

**全量重做**：**禁止** `web_search`（除非用户明确要求「查外部资料」）。

### 交付协议

**首次 / 全量（默认）**

- 交付 **一个** fenced ` ```json ` 块，`type: structured-kb-data`
- **禁止**默认整页 ` ```html `、手写 nav / KB-CONFIG / Appendix D / revealAnchor
- **禁止**默认 `jfo_kb_put.sh`
- Worker 确定性渲染 → validate → upsert

**Fallback（仅 JSON 无法交付）**

- `jfo_kb_put.sh` curl PUT 整页 HTML，或
- 回复末尾附整页 ` ```html `

**单 slot 增量**

- 主路径：`structured-slot-patch` JSON
- Fallback：`slot-html-patch` / 整页 HTML

### PUT（fallback · 非 initial/full 默认）

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
- PUT 400：最多修正一次；仍失败则停止并报告 validation error。

**禁止**：legacy v2.8 anchors、`skills_reference.md`、根目录 `kb-template.html`、`knowledge-base-generation/`。

未完成当前模式规定的 read_file **不得**输出交付物。
