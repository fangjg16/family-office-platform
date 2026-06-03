# 项目级知识网络

## 存储

| 层 | 路径 / 表 |
|----|-----------|
| **R2** | `projects/{projectId}/knowledge-network/current.html` |
| **R2 归档** | `projects/{projectId}/knowledge-network/v{n}.html` |
| **D1** | `project_knowledge_networks`（当前版本元数据） |
| **D1** | `project_knowledge_network_versions`（历史版本索引） |

对话消息里的 `knowledge_network_html` 仅为**该条助手消息的快照**（预览用）；**项目真相**始终是 R2 + `project_knowledge_networks`。

---

## 四条用户路径（逻辑说明）

### 1. 生成知识网络（首次）

**入口**：项目对话里发送含「知识网络 / 生成知识网络」等话术（`detectSkillIntent` → `knowledge_network`），或项目详情「生成知识网络」按钮（预填 `KNOWLEDGE_NETWORK_INITIAL_PROMPT`）。

**流程**：

1. Worker **P0 门禁**：`HERMES_*` + `JFO_INTERNAL_KEY` + `JFO_API_PUBLIC_BASE` 齐全，否则 503，不创建任务。
2. 创建 `agent_jobs`（`skill_intent = knowledge_network`），走 Hermes Runs。
3. Hermes 指令（文件回路）：
   - `GET .../knowledge-network/current?format=raw` → 404 表示尚无 KB，在容器内新建 `./kb/{projectId}/[AI]_xxx_知识网络.html`。
   - 执行 `knowledge-base-generation` + `kb-template.html` 写入工作文件。
   - **`PUT .../current?userId=&jobId=`** 回传（`jobId` 可省略，服务端绑到本任务）。
4. **P0 失败闭环**：任务结束时若 `project_knowledge_networks.last_job_id ≠ 本 jobId` → 任务 **failed**，对话显示失败原因；**不会**标 completed。
5. 成功：从 R2 读 HTML 写入助手消息，附「已同步至项目知识网络 vN」。

**模式**：默认视为首次/增量；无旧版时 GET 404 正常。

---

### 2. 项目详情里显示知识网络

**入口**：`ProjectDetailDrawer` → `ProjectKnowledgeNetworkSection`（Guest 不渲染、API 403）。

**流程**：

1. `GET /api/projects/{id}/knowledge-network?userId=`（浏览器，非 Hermes）。
2. Worker 校验 `canViewProjectKnowledgeNetwork`（非 guest）。
3. 读 D1 元数据 + R2 `current.html`，返回 `meta` + `html` + `versions[]`。
4. 前端 `KnowledgeNetworkPreview`：预览 / 新标签 / 下载；可选下拉查看归档 `v{n}`（`GET .../versions/:n`）。

**数据**：只读 R2 当前版；与谁生成的对话无关，**全员（同项目权限）看同一份**。

---

### 3. 修改知识网络（增量更新）

**入口**：项目详情「增量更新」，或对话里说「更新知识网络 / 增量更新 …」。

**流程**：

1. `detectKnowledgeNetworkUpdateMode(message)` → **`incremental`**（未命中全量关键词）。
2. 同上 Hermes 任务；指令要求：
   - **必须先** `GET ?format=raw` 拉到工作文件。
   - **只改**用户点名的 section，再 `PUT` 回传。
3. PUT 前 Worker 将旧 `current.html` 归档为 `v{n}.html`。
4. 成功条件同「生成」：`last_job_id` 必须等于本 `jobId`（PUT 可自动绑 jobId）。

**注意**：增量靠 Hermes 在工作文件上编辑；未改 section **可以**保留，但不是服务端 DOM diff 硬锁（P1 可做 section diff 门禁）。

---

### 4. 重新生成知识网络（全量重做）

**入口**：项目详情「全量重做」，或对话含「全量重做 / 重新生成 / 从零生成」等（`FULL_REGENERATE_RE`）。

**流程**：

1. `detectKnowledgeNetworkUpdateMode` → **`full`**。
2. Hermes 指令：**可跳过 GET 旧版**，按 `kb-template` 从零写工作文件，再 `PUT`。
3. 归档旧版、写入新版本号，项目详情展示最新 `current.html`。

与增量的差别仅在 Hermes 是否拉取旧文件、是否允许整页重写；**回传与验收机制相同**（必须 PUT + `last_job_id` 匹配）。

---

## Hermes 专用 API（Bearer `JFO_INTERNAL_KEY`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hermes/projects/{id}/knowledge-network/current` | JSON：`exists`, `html`, `meta` |
| GET | `.../current?format=raw` | 纯 HTML（curl `-o` 工作文件） |
| PUT | `.../current?userId=&jobId=&changelog=` | 写入 R2+D1；**jobId 可省略** → 绑到该项目该用户进行中的 KN 任务 |

## 用户 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/{id}/knowledge-network?userId=` | 项目详情 / 对话拉 meta+html |
| GET | `/api/projects/{id}/knowledge-network/versions/{v}?userId=` | 历史版本 HTML |

## P0 防呆（已实现）

1. **失败闭环**：KN 任务完成时无有效 PUT → `agent_jobs.status = failed`，并同步失败说明到对话。
2. **PUT 自动绑 jobId**：未带 `jobId` 时解析 `pending/running` 的 `knowledge_network` 任务；无法绑定 → PUT 400。
3. **启动前门禁**：缺 Hermes 或 `JFO_INTERNAL_KEY` / `JFO_API_PUBLIC_BASE` → 不创建任务，直接 503。

## 迁移

```bash
cd api-worker
npx wrangler d1 execute jfo-meta --remote --file=./migrations/0011_project_knowledge_networks.sql
npx wrangler d1 execute jfo-meta --remote --file=./migrations/0012_project_kn_versions.sql
npx wrangler deploy
```

## 历史数据

旧对话仅含 ` ```html `、从未 PUT：运行 admin backfill：

```bash
curl -X POST "https://jfo-api.jfo-api.workers.dev/api/admin/project-knowledge-network/backfill" \
  -H "Authorization: Bearer $JFO_INTERNAL_KEY"
```
