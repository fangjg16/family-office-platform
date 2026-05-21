# 第四步手把手：部署 Cloudflare Worker（Windows）

> 目标：得到一个网址，例如 `https://jfo-api.xxxxx.workers.dev`  
> 你的网页 https://fangjg16.github.io/family-office-platform/ 以后会请求这个地址。

**完成第四步最少需要：** 已建好 R2 桶 `jfo-files`、已建好 D1 数据库 `jfo-meta`（并复制了 Database ID）。

---

## 0. 打开终端

1. 在 Cursor 里按 **Ctrl + `** 打开终端，或 Win 搜索 **PowerShell**。
2. 进入目录（复制整行回车）：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform\api-worker"
```

看到路径末尾是 `api-worker` 就对了。

---

## 1. 安装依赖（只需一次）

若 PowerShell 报错「禁止运行脚本 / PSSecurityException」，用下面 **任选一种**（见本文末尾「Windows npm 报脚本禁止」）。

```powershell
npm install
```

或（推荐，不改编译策略）：

```powershell
npm.cmd install
```

等它跑完，没有红色 `ERR!` 即可。

---

## 2. 登录 Cloudflare（只需一次）

```powershell
npx wrangler login
```

- 会自动打开浏览器，用你创建 R2 的那个 Cloudflare 账号登录。
- 点 **Allow** 授权。
- 终端里出现 `Successfully logged in` 就成功。

---

## 3. 改 D1 的 Database ID（必做）

1. 打开 https://dash.cloudflare.com → **Workers & Pages** → **D1**。
2. 点数据库 **`jfo-meta`**。
3. 右侧或设置里找到 **Database ID**（一长串字母数字），点复制。

4. 用 Cursor 打开文件：  
   `family-office-platform/api-worker/wrangler.toml`

5. 把第 15 行：

```toml
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

改成（粘贴你自己的 ID，保留引号）：

```toml
database_id = "你复制的Database-ID"
```

6. 确认第 9 行桶名是 `jfo-files`（和你 R2 里建的桶名一致）。

7. **保存文件**（Ctrl+S）。

---

## 4. 初始化 D1 表结构（只需一次）

仍在 `api-worker` 目录执行：

```powershell
npx wrangler d1 execute jfo-meta --remote --file=./schema.sql
```

成功会看到类似 `Executed N commands`。

若报错 `database not found`：说明第 3 步 Database ID 填错或 D1 名字不是 `jfo-meta`。

---

## 5. 先部署 Worker（Hermes 还没好也可以）

```powershell
npx wrangler deploy
```

成功时终端最后几行类似：

```text
Published jfo-api (x.xx sec)
  https://jfo-api.XXXXXXXX.workers.dev
```

**把这个 https 地址整段复制下来**，后面要用。

### 自测是否上线

把下面网址里的域名换成你刚复制的（浏览器打开即可）：

```text
https://jfo-api.XXXXXXXX.workers.dev/api/health
```

应看到 JSON，里面有 `"ok": true`。

---

## 6. Hermes / 千问（可稍后再做）

Railway 上 Hermes 还没部署好时，**第 5 步已经算完成第四步**；只是聊天会提示 AI 不可用。

等 Railway 有地址后，在 `api-worker` 目录执行（每条会提示你粘贴内容）：

```powershell
npx wrangler secret put HERMES_BASE_URL
# 粘贴：https://你的应用.up.railway.app  （不要带 /v1）

npx wrangler secret put HERMES_API_KEY
# 粘贴：与 Hermes 里 API_SERVER_KEY 相同的一长串密码

npx wrangler secret put HERMES_MODEL
# 粘贴：qwen-plus  （或你在千问用的模型名）

npx wrangler secret put ALLOWED_ORIGIN
# 粘贴：https://fangjg16.github.io
```

每设完一个 secret，无需重新 deploy（会自动生效）。

本地调试可复制：

```powershell
copy .dev.vars.example .dev.vars
```

编辑 `.dev.vars` 填同样内容，然后：

```powershell
npx wrangler dev
```

---

## 7. 接到 GitHub 网页（第五步预告）

1. GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 新建：
   - `VITE_ENABLE_LIVE_CHAT` = `1`
   - `VITE_AI_CHAT_ENDPOINT` = `https://你的worker.workers.dev/api/chat`  
     （注意末尾是 **`/api/chat`**）
3. 推送 `main`，等 Actions 绿勾，再打开你的 GitHub Pages 测对话。

---

## Windows：`npm` 报「禁止运行脚本」

完整报错里常有 `npm.ps1`、`PSSecurityException`。

**办法 A（最简单）：** 命令改成带 `.cmd` 后缀：

```powershell
npm.cmd install
npx.cmd wrangler login
npx.cmd wrangler deploy
```

**办法 B：** 用「命令提示符 CMD」而不是 PowerShell：Win 搜索 `cmd`，再 `cd` 到 `api-worker` 目录，直接 `npm install`。

**办法 C（一劳永逸）：** 在 **管理员** PowerShell 执行一次：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

选 `Y`，然后关闭终端再开，即可继续用 `npm` / `npx`。

---

## 常见懵点

| 现象 | 怎么办 |
|------|--------|
| `npm.ps1` 禁止运行脚本 | 用 `npm.cmd` / `npx.cmd`，或改 ExecutionPolicy，见上一节 |
| 找不到 `wrangler` | 一定在 `api-worker` 目录下用 `npx wrangler`，不要全局装也行 |
| `REPLACE_WITH_YOUR_D1` 没改 | 第 3 步必改，否则 deploy 失败 |
| R2 桶名不一致 | `wrangler.toml` 里 `bucket_name` 必须和 Dashboard 里完全一致 |
| deploy 成功但 chat 502 | 正常，先完成 Railway Hermes + 第 6 步 secret |
| 不知道 Worker 地址 | 再看一遍 `npx wrangler deploy` 输出里的 `https://...workers.dev` |

---

## 你现在只需回复我两样东西（若还卡住）

1. `npx wrangler deploy` 的**最后 10 行**终端输出（可打码）  
2. 或浏览器打开 `/api/health` 时看到的内容  

我可以帮你看卡在哪一小步。
