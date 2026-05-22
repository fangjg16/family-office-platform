# 后台数据清理指南（R2 + D1）

演示环境的数据主要在 **Cloudflare** 两处：

| 存储 | 名称 | 内容 |
|------|------|------|
| **R2** | `jfo-files` | 上传的原始 PDF / 文本文件 |
| **D1** | `jfo-meta` | 文档索引、分块正文、对话同步 |

网页**没有**「一键清空」按钮，需用 **Dashboard** 或本机 **`wrangler`**（在 `api-worker` 目录执行）。

---

## 零、准备

```powershell
cd "你的路径\family-office-platform\api-worker"
npx.cmd wrangler login
```

演示账号 `userId` 可在 `src/workspace/workspace-users.ts` 里查（如 `admin`、`core-a` 等）。

---

## 一、只删某个账号的数据（推荐）

把下面 SQL 里的 `YOUR_USER_ID` 换成真实 id（与登录账号一致）。

### 1. 删除该账号上传的所有资料 + 分块

```sql
DELETE FROM chunks WHERE document_id IN (
  SELECT id FROM documents WHERE uploaded_by = 'YOUR_USER_ID'
);
DELETE FROM documents WHERE uploaded_by = 'YOUR_USER_ID';
```

### 2. 删除该账号云端对话记录

```sql
DELETE FROM user_chat_messages WHERE user_id = 'YOUR_USER_ID';
DELETE FROM user_conversations WHERE user_id = 'YOUR_USER_ID';
```

### 3. 执行（远程库）

```powershell
# 将 SQL 存为 cleanup-user.sql 后：
npx.cmd wrangler d1 execute jfo-meta --remote --file=./cleanup-user.sql
```

### 4. 删 R2 里该账号的文件（对象路径含 users/YOUR_USER_ID）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → 桶 **`jfo-files`**
2. 进入 `projects/` → 某项目 → `users/` → 对应账号文件夹
3. 勾选对象 → **Delete**

或删除整个前缀目录（若控制台支持批量删除）。

> **说明**：只删 D1 不删 R2 会留「孤儿文件」占空间；只删 R2 不删 D1 会导致列表里仍有记录但下载失败。建议 **D1 + R2 一起清**。

---

## 二、只删某个项目（如南宁 `nn-fresh-port`）

```sql
DELETE FROM chunks WHERE document_id IN (
  SELECT id FROM documents WHERE project_id = 'nn-fresh-port'
);
DELETE FROM documents WHERE project_id = 'nn-fresh-port';
DELETE FROM user_chat_messages WHERE conversation_id LIKE 'nn-fresh-port%';
DELETE FROM user_conversations WHERE project_id = 'nn-fresh-port';
```

R2：Dashboard 中删除前缀 `projects/nn-fresh-port/` 下全部对象。

---

## 三、清空所有上传资料（保留对话结构可选）

### 全部文档与分块

```sql
DELETE FROM chunks;
DELETE FROM documents;
```

### 全部云端对话

```sql
DELETE FROM user_chat_messages;
DELETE FROM user_conversations;
```

### R2 整桶清空

Dashboard → R2 → `jfo-files` → 全选删除（或删除桶内所有对象）。

⚠️ **不可恢复**，执行前请确认。

---

## 四、用 Dashboard 查看现状（不删）

### D1

Dashboard → **Workers & Pages** → **D1** → **`jfo-meta`** → **Console**，可运行：

```sql
SELECT uploaded_by, project_id, scope, filename, created_at
FROM documents ORDER BY created_at DESC LIMIT 30;

SELECT user_id, COUNT(*) AS n FROM user_conversations GROUP BY user_id;

SELECT user_id, COUNT(*) AS n FROM user_chat_messages GROUP BY user_id;
```

### R2

Dashboard → **R2** → **`jfo-files`** → 浏览 `projects/...` 目录体积与文件列表。

---

## 五、改版前的「无 uploaded_by」旧文件

若早期上传的记录 `uploaded_by` 为空，网页里**看不到**，但仍占 D1/R2：

```sql
-- 查看
SELECT id, project_id, filename, uploaded_by, created_at FROM documents WHERE uploaded_by IS NULL;

-- 删除
DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE uploaded_by IS NULL);
DELETE FROM documents WHERE uploaded_by IS NULL;
```

再在 R2 中手动删 `projects/{项目id}/package/` 或 `sessions/` 下**没有** `users/` 层级的旧路径对象。

---

## 六、本机浏览器缓存（不算后台）

换电脑不同步、想清本地演示状态时：

- 浏览器 → 清除本站点的 **本地数据 / localStorage**（`fo-chat-*` 开头 key）
- 或无痕窗口重新登录

这**不会**删除 Cloudflare 上的 R2/D1。

---

## 七、快速对照

| 你想… | 做法 |
|--------|------|
| 某账号重来 | 第一节 SQL + R2 删 `users/该账号/` |
| 某项目资料重来 | 第二节 |
| 演示环境全部重置 | 第三节 |
| 只清对话、保留文件 | 只执行 `user_chat_*` 的 DELETE |
| 只清文件、保留对话 | 只执行 `documents` / `chunks` + R2 |

---

## 八、以后可加的功能（尚未做）

- 网页「项目设置 → 清空资料库」
- `DELETE /api/projects/:id/files/:docId` 单文件删除

有需要可在产品里再加；当前以本文 **SQL + R2 控制台** 为准。
