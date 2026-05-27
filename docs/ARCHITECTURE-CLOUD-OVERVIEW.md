# 家办平台公域架构说明（云端为唯一真相）

> 导出时间：2026-05-27  
> 适用：GitHub Pages + Cloudflare Worker (D1/R2) + Railway Hermes + DashScope

---

## 一、系统长什么样

```text
浏览器 (GitHub Pages)
    ↓ 读写信、发消息、轮询任务
Cloudflare Worker (jfo-api)
    ├─ D1：项目、对话、agent_jobs
    ├─ R2：PDF/附件
    ├─ /api/chat、/api/agent-jobs、/api/users/.../chat-state
    └─ /api/hermes/*（Hermes 读 R2）
         ↓
Railway Hermes Gateway
    ├─ /v1/chat/completions（轻问）
    └─ /v1/runs（深度 + skills）
         ↓
DashScope 千问
```

| 组件 | 干什么 | 是否必须 |
|------|--------|----------|
| GitHub Pages | 静态前端 | 公网入口，合理 |
| Cloudflare Worker | API、CORS、拼资料、调 Hermes | 与 R2/D1 同生态，合理 |
| D1 | 项目元数据、每人对话、深度任务 | 云端真相 |
| R2 | 资料二进制 | 合理 |
| Railway Hermes | 长任务、多 skill | Worker 不适合跑 10 分钟 agent |
| DashScope | 千问；Hermes + Worker 降级 | 合理 |

**架构结论：** 静态站 + 边缘 API + 对象存储 + 重 Agent 分机，对小团队公网 demo **方向对**；短板在同步方式、登录、深度结果入库，不在「该不该上 Railway/Cloudflare」。

---

## 二、云端「真相」存在哪

| 数据 | 存储 | 谁写 | 同事能否看到 |
|------|------|------|----------------|
| 项目列表/阶段 | D1 `projects` | Worker | 项目维度共享 |
| 上传资料 | R2 + D1 索引 | Worker | `package`=按项目；`session`=按 userId+会话 |
| 对话列表+消息 | D1 `user_conversations` / `user_chat_messages` | 前端 `PUT /chat-state` | 同 **userId** |
| 深度任务结果 | D1 `agent_jobs` | Worker 后台 | 同 userId 可轮询；**不自动进聊天表** |

前端已 **只信云端**（commit `fe904bf`）：`loadChatStateForUser` / `persistChatStateForUser` 仅走 `/chat-state`，不再用 `localStorage` 当真相。

---

## 三、一次对话的流程

### 打开对话中心

1. `sessionStorage` 取当前 mock `userId`
2. `GET /api/users/{userId}/chat-state`
3. 若有 `pendingJobId` → 轮询 `GET /api/agent-jobs/{id}`

### 轻问

1. `POST /api/chat` → Worker 摘录资料 → Hermes/千问 → 同步返回答案
### 保存（增量，非全量 DELETE）

1. `PUT /chat-state` body：
   - `conversations`：upsert 会话元数据
   - `messagesByConversation`：**按会话**替换该会话下全部消息（不影响其它会话）
   - `deletedConversationIds`：显式删会话（级联删消息）
   - `deletedMessageIds`：`[{ conversationId, messageId }]` 显式删单条
2. 深度任务完成：Worker 直接 upsert `assistant-job-{jobId}` 到 D1，不依赖浏览器

### 深度（知识网络/尽调等）

1. `POST /api/chat` → 建 `agent_jobs` → `startHermesRun`（失败则 chat-fallback）
2. 返回 `async: true, jobId`；前端占位消息带 `pendingJobId`
3. Worker 后台等 Hermes；前端每 3s 轮询
4. 完成 → 更新内存 → 再 `PUT /chat-state`

### Hermes 读资料

- 上传 → R2
- Skill `jfo-r2-materials` → `GET /api/hermes/...`（**JFO_INTERNAL_KEY**，≠ HERMES_API_KEY）

---

## 四、运行问题（按严重程度）

### P0

| 问题 | 现象 | 根因 |
|------|------|------|
| PUT 全量替换 | 一次不完整保存删光该用户所有会话 | `chat-sync.ts` 先 DELETE 再 INSERT |
| 深度与聊天表脱节 | 任务完成但刷新后对话无答案 | 结果在 `agent_jobs`，进聊天靠前端再 PUT |
| 保存防抖 900ms | 发完立刻刷新/换机 | 可能尚未 PUT |
| 无真实登录 | 知道 userId 即可读写 chat-state | API 信任客户端传的 userId |

### P1 — Hermes

| 问题 | 自检 |
|------|------|
| Unauthorized | `HERMES_API_KEY` = Railway `API_SERVER_KEY` |
| Invalid URL | `HERMES_BASE_URL` 完整 `https://...` |
| Runs 不通 | `/api/health` → `hermesRunsOk` |
| 读不了 R2 | `JFO_INTERNAL_KEY` + `hermesBridgeConfigured` |

### P2 — 产品语义

- 同事要看同一份对话 → 必须选**同一 mock userId**
- 资料常项目级共享；聊天按 userId 隔离
- sessionStorage 登录 → 换浏览器要重选用户

### P3 — 运维

- D1 迁移需 `--remote`；`knowledge_network_html` 等列要齐
- CORS `ALLOWED_ORIGIN` 默认 GitHub Pages
- 三把密钥：`HERMES_API_KEY`、`JFO_INTERNAL_KEY`、`DASHSCOPE_API_KEY`

---

## 五、是否最优 & 建议优先级

**可继续用：** Pages + Worker + D1/R2 + Railway Hermes。

**更值得做的改进：**

1. chat-state 增量或 revision，去掉全量 DELETE+INSERT
2. `agent_jobs` 完成时 Worker 直接写 `user_chat_messages`
3. 关键节点立即 PUT，减少 900ms 防抖风险
4. 真登录（不信任任意 userId）
5. （可选）按项目/组织共享对话

---

## 六、日常自检

1. `GET /api/health` 看各项是否 OK
2. 发轻问 → `POST /api/chat` 200
3. 刷新 → `GET chat-state` 仍有消息
4. 另一浏览器**同一用户** → 侧栏一致
5. 深度任务 → `async:true` → 轮询 `agent-jobs` → 完成后刷新仍有内容与知识网络按钮

---

## 相关文件

| 区域 | 路径 |
|------|------|
| 对话 UI | `src/pages/workspace/ConversationCenter.tsx` |
| 云端读写 | `src/workspace/chat-persistence.ts` |
| Worker 聊天同步 | `api-worker/src/chat-sync.ts` |
| 深度任务 | `api-worker/src/agent-jobs.ts`, `index.ts` |
| 部署 | `docs/DEPLOY-CLOUDFLARE-QWEN.md`, `docs/HERMES-R2-手把手.md` |
