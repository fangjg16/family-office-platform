# 部署清单（无域名版）

你的网站：

- 代码仓库：[fangjg16/family-office-platform](https://github.com/fangjg16/family-office-platform)
- 线上网页：**https://fangjg16.github.io/family-office-platform/**

AI 不能放在 GitHub Pages 上，需要 **Cloudflare（存文件 + API）** + **Railway（跑 Hermes + 千问）**。

---

## 你要注册的账号

| 序号 | 平台 | 用途 | 费用 |
|------|------|------|------|
| 1 | [GitHub](https://github.com) | 已有，发网页 | 免费 |
| 2 | [Cloudflare](https://dash.cloudflare.com) | R2 存 PDF、Worker 当 API | 免费档通常够 demo |
| 3 | [Railway](https://railway.app) | 24 小时运行 Hermes | 需绑卡，按用量 |
| 4 | [阿里云百炼 / DashScope](https://dashscope.aliyun.com) | 千问 API Key | 按 token 计费 |

**不需要买域名。** 会用：

- 网页：`https://fangjg16.github.io/family-office-platform/`
- API：`https://<你的名字>.workers.dev`（Cloudflare 自动给）

---

## 架构（记这一张图）

```text
浏览器打开 GitHub Pages
       ↓
Cloudflare Worker（/api/chat、/api/projects/.../files）
       ↓ 读 R2 + D1 里的项目资料
Railway 上的 Hermes Gateway（/v1/chat/completions）
       ↓
千问 DashScope API
```

---

## 第一步：千问 API Key（Hermes 用）

1. 登录 [DashScope 控制台](https://dashscope.aliyun.com/)（阿里云百炼）。
2. 创建 **API Key**，复制保存（只显示一次）。
3. 记下你要用的模型名，例如 `qwen-plus` 或 `qwen-turbo`（以控制台为准）。

国内 Key 常用兼容地址（写入 Railway 环境变量）：

```bash
DASHSCOPE_API_KEY=sk-你的密钥
# Hermes 若走 OpenAI 兼容模式，在 hermes-railway/.env.example 里有说明
```

官方说明：[Hermes Agent - Qwen Cloud](https://docs.qwencloud.com/token-plan/tools/hermes-agent)  
Hermes 提供商文档：[AI Providers](https://hermes-agent.nousresearch.com/docs/integrations/providers)

---

## 第二步：Cloudflare R2（存 PDF）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → 左侧 **R2**。
2. **Create bucket**，名称例如：`jfo-files`。
3. **Manage R2 API Tokens** → Create token → 权限选该 bucket 读写。
4. 保存：**Access Key ID**、**Secret Access Key**、**Account ID**。

---

## 第三步：Cloudflare D1（记文件目录）

1. **Workers & Pages** → **D1** → **Create** → 名称 `jfo-meta`。
2. 创建后复制 **Database ID**（后面 `wrangler.toml` 要用）。
3. 在本机执行（需先完成第四步安装 wrangler）：

```bash
cd family-office-platform/api-worker
npx wrangler d1 execute jfo-meta --remote --file=./schema.sql
```

---

## 第四步：部署 Cloudflare Worker（API）

> **觉得懵？** 请直接打开更细的图文步骤：[DEPLOY-STEP4-手把手.md](./DEPLOY-STEP4-手把手.md)（Windows / PowerShell 逐条命令）

### 4.1 本机准备

```bash
cd family-office-platform/api-worker
npm install
npx wrangler login
```

### 4.2 改配置

编辑 `api-worker/wrangler.toml`：

- `database_id` 改成你的 D1 Database ID
- 确认 R2 bucket 名是 `jfo-files`

### 4.3 配置密钥（不要提交到 GitHub）

```bash
cd family-office-platform/api-worker
copy .dev.vars.example .dev.vars
```

编辑 `.dev.vars`（本地测试用）：

```bash
# 推荐：与 Railway 里 DASHSCOPE_API_KEY 相同，Worker 直连千问（不依赖 Hermes 鉴权）
DASHSCOPE_API_KEY=sk-你的密钥
HERMES_MODEL=qwen-plus
ALLOWED_ORIGIN=https://fangjg16.github.io

# 可选：仅当不用 DASHSCOPE 时才走 Hermes
HERMES_BASE_URL=https://你的服务.up.railway.app
HERMES_API_KEY=与 Railway API_SERVER_KEY 完全一致
```

线上 Secrets（生产，**至少配置其一**）：

```bash
# 推荐（配置后 /api/health 显示 llmMode: dashscope）
npx wrangler secret put DASHSCOPE_API_KEY

# 可选：家办对话里说「查外部资料」等时走 Tavily 联网（/api/health 显示 tavilyConfigured: true）
npx wrangler secret put TAVILY_API_KEY

# 可选 Hermes 中继（HERMES_API_KEY 必须与 Railway API_SERVER_KEY 一字不差，否则 502 Unauthorized）
npx wrangler secret put HERMES_BASE_URL
npx wrangler secret put HERMES_API_KEY
```

`HERMES_MODEL`、`ALLOWED_ORIGIN` 已在 `wrangler.toml` 的 `[vars]`，勿再 `secret put` 同名变量。

### 4.4 部署

```bash
npx wrangler deploy
```

记下输出的地址，例如：`https://jfo-api.xxx.workers.dev`

自测：

```bash
curl https://jfo-api.xxx.workers.dev/api/health
```

---

## 第五步：Railway 部署 Hermes + 千问

详见仓库内 **`hermes-railway/README.md`**。

要点：

1. Railway 新建项目，部署方式选 Docker 或按 Hermes 官方文档安装。
2. 环境变量至少包括：
   - `API_SERVER_ENABLED=true`
   - `API_SERVER_KEY=`（随机长密码，与 Worker 里 `HERMES_API_KEY` 一致）
   - `DASHSCOPE_API_KEY=`（千问）
   - 模型 `base_url` 指向 DashScope 兼容接口（见 `hermes-railway/.env.example`）
3. 部署完成后得到 **Public URL**，填回 Worker 的 `HERMES_BASE_URL`（末尾不要多 `/v1`，Worker 会自动拼）。

**安全：** 不要把 Railway 地址和 Key 写进公开 GitHub 仓库。

---

## 第六步：让 GitHub Pages 连上 API

1. 打开 https://github.com/fangjg16/family-office-platform/settings/secrets/actions  
2. **New repository secret** 添加：

| Name | Value 示例 |
|------|------------|
| `VITE_ENABLE_LIVE_CHAT` | `1` |
| `VITE_AI_CHAT_ENDPOINT` | `https://jfo-api.xxx.workers.dev/api/chat` |

3. 修改 `.github/workflows/deploy-pages.yml` 已在仓库中支持读取上述 Secret（有值才注入）。
4. 推送 `main` 分支，等 Actions 跑完。
5. 打开 https://fangjg16.github.io/family-office-platform/ → 登录 → 进入项目对话测试。

未配置 Secret 时，网站仍走**演示剧本**，不影响现有演示。

---

## 第七步：上传项目资料（MVP）

1. **网页**：项目总览 → 卡片「查看详情」→ 侧栏 **「项目资料与附件」**（可上传、列表）。
2. **对话**：输入区回形针上传为 `scope=session` 临时文件。
3. **接口**：

```http
GET  https://你的worker.dev/api/projects/nn-fresh-port/files
POST https://你的worker.dev/api/projects/nn-fresh-port/files
Content-Type: multipart/form-data
file: （选择 .txt / .md，MVP 最易解析）
scope: package
```

4. `scope=session` + 表单字段 `conversationId=xxx` 表示对话里临时上传。
5. **PDF**：Worker 已用 `unpdf`（PDF.js）提取**可选中文字**的正文并分块入库；**扫描版/图片 PDF** 仍需 OCR 或另附 `.txt/.md`。单文件建议 &lt; 12MB。
6. **资料隔离**：**项目资料包**（`scope=package`）按 `projectId` **全项目共享**；**对话临时文件**（`scope=session`）按 `userId` + `conversationId` 隔离。对话列表与 Live 聊天记录同步到 D1（`GET/PUT /api/users/{userId}/chat-state`）。旧的无 `uploaded_by` 文件需重新上传。
7. **外部联网搜索（Tavily）**：与 Railway Hermes 独立，在 Worker 配置 `TAVILY_API_KEY`（可与 Railway 填同一 `tvly-` Key）。用户在家办对话里说 **「查外部资料」「联网搜索」「网上查」** 等时，Worker 先调 Tavily，再把结果与上传资料一并交给千问；回答中外部来源用 `[WEB:n]` + URL，上传资料仍用 `[ID:n]`。`/api/health` 应显示 `tavilyConfigured: true`。

---

## 费用粗算（demo）

- GitHub Pages：免费  
- Cloudflare Worker + R2 + D1：免费档一般够  
- Railway：主机约几美元/月起 + **千问 token 按量**（主要成本）

---

## 清理后台数据

上传文件、对话同步占用的 **R2 + D1** 如何自行删除，见 **[CLEANUP-DATA.md](./CLEANUP-DATA.md)**（按账号 / 按项目 / 全量清空）。

---

## 常见问题

**Q：点了发送没反应？**  
A：看浏览器 F12 → Network，是否请求了 `workers.dev`；是否 403（`ALLOWED_ORIGIN` 必须是 `https://fangjg16.github.io`）。

**Q：GitHub Pages 能直连 Hermes 吗？**  
A：不能，必须经 Worker；且 Hermes 不宜对公网裸奔。

**Q：没有域名影响吗？**  
A：不影响。`github.io` + `workers.dev` 即可。

---

## 你今天要做的勾选

- [ ] DashScope 拿到 API Key  
- [ ] Cloudflare 建好 R2 + D1  
- [ ] `api-worker` 执行 `wrangler deploy`  
- [ ] Worker 已配置 `DASHSCOPE_API_KEY`，或 Railway Hermes + `HERMES_API_KEY` 与 `API_SERVER_KEY` 一致
- [ ] （可选）Worker `TAVILY_API_KEY` 已配置，health 显示 `tavilyConfigured: true`  
- [ ] `curl .../api/health` 显示 `llmMode` 为 `dashscope` 或 `hermes`  
- [ ] GitHub Secrets 填 `VITE_ENABLE_LIVE_CHAT` 和 `VITE_AI_CHAT_ENDPOINT`  
- [ ] 推送 main，验证线上对话

需要改代码时可在 Cursor 里切 Agent 模式，说明「按 DEPLOY-CLOUDFLARE-QWEN 接好上传 UI」。
