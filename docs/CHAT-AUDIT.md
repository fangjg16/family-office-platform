# 对话审计日志（chat_message_audit_log）

用户在前台删除消息时，会从 **`user_chat_messages`** 物理删除；全文（含 **AI 回复**）写入 **`chat_message_audit_log`**，供运维与后续 **Admin Portal** 查询。

---

## 一、表结构（D1 `jfo-meta`）

| 字段 | 说明 |
|------|------|
| `event` | `created`：消息首次入库；`deleted`：用户或系统删除前快照 |
| `role` | `user` / `assistant`（**assistant 即 AI 回复**） |
| `content` | 消息全文 |
| `knowledge_network_html` | 知识网络 HTML（若有） |
| `source` | `chat_sync` / `agent_job` / `conversation_delete` |

同一 `message_id` 最多各有一条 `created` 与 `deleted`（唯一索引）。

---

## 二、内部 API（Admin Portal / 脚本）

```http
GET https://jfo-api.jfo-api.workers.dev/api/admin/chat-audit?userId=jessica-hu&limit=50
Authorization: Bearer <JFO_INTERNAL_KEY>
```

查询参数（至少填一项）：

| 参数 | 说明 |
|------|------|
| `userId` | 账号 id，如 `jessica-hu` |
| `conversationId` | 会话 id，如 `proj-7c0f947a6a00-main` |
| `messageId` | 单条消息 id |
| `event` | `created` 或 `deleted` |
| `limit` | 1–200，默认 80 |

响应示例字段：`entries[].role`、`entries[].content`、`entries[].event`、`entries[].createdAt`。

PowerShell 示例：

```powershell
$key = "你的 JFO_INTERNAL_KEY"
$base = "https://jfo-api.jfo-api.workers.dev"
$uid = "jessica-hu"
$conv = "proj-7c0f947a6a00-main"
Invoke-RestMethod -Uri "$base/api/admin/chat-audit?userId=$uid&conversationId=$conv&limit=100" `
  -Headers @{ Authorization = "Bearer $key" }
```

---

## 三、D1 Console SQL 模板

Dashboard → D1 → **jfo-meta** → Console：

```sql
-- 某用户某会话：按时间看创建/删除（含 AI）
SELECT created_at, event, role, message_id,
       substr(content, 1, 120) AS preview
FROM chat_message_audit_log
WHERE user_id = 'jessica-hu'
  AND conversation_id = 'proj-7c0f947a6a00-main'
ORDER BY created_at;

-- 只看 AI 回复全文（某条 message_id）
SELECT event, role, content, knowledge_network_html, created_at
FROM chat_message_audit_log
WHERE user_id = 'jessica-hu' AND message_id = 'assistant-1780456856026'
ORDER BY created_at;

-- 最近被用户删除的消息
SELECT created_at, user_id, conversation_id, message_id, role,
       substr(content, 1, 200) AS preview
FROM chat_message_audit_log
WHERE event = 'deleted'
ORDER BY created_at DESC
LIMIT 30;
```

本机 wrangler：

```powershell
cd family-office-platform\api-worker
npx.cmd wrangler d1 execute jfo-meta --remote --command "SELECT ..."
```

---

## 四、与用户可见数据的关系

| 存储 | 用户前台 | 运维审计 |
|------|----------|----------|
| `user_chat_messages` | 显示来源 | 删后无此行 |
| `chat_message_audit_log` | 不展示 | **永久可查**（当前策略为只追加） |

迁移文件：`api-worker/migrations/0010_chat_message_audit_log.sql`。

**历史消息**：上线审计前的旧消息不会自动出现在审计表；需要时可单独做回填（步骤 5，暂未做）。

---

## 五、Admin Portal 对接建议

后续 Admin 页直接调用 **`GET /api/admin/chat-audit`**，展示 `entries` 列表；详情用 `content` 渲染 Markdown（注意权限仅 Admin）。

Worker 密钥：`wrangler secret put JFO_INTERNAL_KEY`（与 Hermes 桥接共用）。
