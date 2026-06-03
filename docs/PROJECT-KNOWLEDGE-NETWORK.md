# 项目级知识网络（R2 + D1）

## 存储

| 层 | 内容 |
|----|------|
| **R2** | `projects/{projectId}/knowledge-network/current.html` |
| **D1** | 表 `project_knowledge_networks`：版本、更新时间、更新人、最近 job、changelog |

对话与 `agent_jobs` 仍保留 `knowledge_network_html` 字段（单条消息/任务快照）；**项目详情与增量基线**以 R2 + D1 为准。

## API

`GET /api/projects/:projectId/knowledge-network?userId=`

- 非 Guest（Worker 侧 `janice-hi` 及项目 role `guest`）返回 `meta` + `html`
- Guest：`403`，`code: GUEST_FORBIDDEN`

## 写入时机

1. Hermes 异步任务 `completeAgentJob`，且 `skill_intent === knowledge_network'` 且解析到 HTML
2. 同步 `/api/chat` 快路径（若将来不走 Hermes）同样调用 `maybePersistProjectKnowledgeNetwork`

生成 Hermes 指令时，若已有 R2 版本，会注入「增量更新基线」HTML（截断约 72KB）。

## 删除

`deleteProjectCascade` 会删除 R2 对象与 D1 行。

## 迁移

```bash
cd api-worker
npx wrangler d1 execute jfo-meta --remote --file=./migrations/0011_project_knowledge_networks.sql
npx wrangler deploy
```

## 前端

- `ProjectDetailDrawer`：`detailTier !== "guest"` 时展示 `ProjectKnowledgeNetworkSection`
- Guest 不请求 API、不渲染区块
