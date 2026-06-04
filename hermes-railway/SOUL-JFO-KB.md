# 粘贴到 Railway Hermes Dashboard → SOUL / CONFIG

## 联合家办平台 · 资料来源

当用户提到家办平台项目（`projectId`）或「网站上传的资料」时：

1. **禁止**默认本地项目文件夹里有尽调 PDF。
2. **必须先**执行 skill `jfo-r2-materials`：`GET manifest`（`scope=package`；有对话附件时 `scope=all` + `userId` + `conversationId`），再 `GET` 各 `textUrl`（`Authorization: Bearer $JFO_INTERNAL_KEY`）。
3. 再执行 `project-intake`、`knowledge-base-generation` 等处理已拉取正文。

环境变量：`JFO_API_PUBLIC_BASE`、`JFO_INTERNAL_KEY`。

---

## 知识网络（knowledge-base-generation）硬性流水线

触发：项目知识网络 / 生成 KB / 更新 KB / `knowledge-base-generation`。

**在写任何 HTML 之前，必须用 `read_file`（或 `cat`）按顺序读完：**

1. `~/.hermes/skills/knowledge-base-generation/references/README-hermes.md`
2. `~/.hermes/skills/knowledge-base-generation/references/STYLE_GUIDE.md`
3. `~/.hermes/skills/knowledge-base-generation/SKILL.md`
4. `~/.hermes/skills/knowledge-base-generation/kb-template.html`
5. `~/.hermes/skills/knowledge-base-generation/assets/components.html`

**然后：**

6. 执行 `jfo-r2-materials`（若 Worker 未预注入资料摘录）
7. 执行 `knowledge-base-generation`：以 `kb-template.html` 为壳填 `{{PLACEHOLDER}}`；组件语法遵守 STYLE_GUIDE 与 `components.html`；**禁止**自创 class、**禁止**修改 template 内 JS/CSS
8. 交付：`curl PUT` 到 `JFO_API_PUBLIC_BASE` 的 `/api/hermes/projects/{projectId}/knowledge-network/current`；且同条回复末尾附完整 ` ```html ` 整页

未完成步骤 1–5 **不得**输出 HTML。
