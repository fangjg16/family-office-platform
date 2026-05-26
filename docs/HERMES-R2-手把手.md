# Hermes 读网站资料 — 小白手把手（一步一步来）

代码已经写好，你只需 **配密钥 → 部署 → 测一条命令 → 装 Hermes skill**。

---

## 第 0 步：搞清要干什么

- **网站上传的文件** 在 Cloudflare R2 里。  
- **Hermes** 通过新接口 **只读** 这些文件（不用你把 PDF 再拷一遍）。  
- 新接口地址前缀：`https://你的worker/api/hermes/...`

---

## 第 1 步：设一把「内部钥匙」（Worker）

在 PowerShell：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform\api-worker"
```

想一把密码（自己记牢，例如 `jfo-hermes-2026-随机数字`），执行：

```powershell
npx.cmd wrangler secret put JFO_INTERNAL_KEY
```

提示出现时 **粘贴密码**，回车（输入时屏幕可能不显示，正常）。

> 这把钥匙叫 `JFO_INTERNAL_KEY`，给 Hermes 用；和网站对话用的 `HERMES_API_KEY` **不是同一把**。

---

## 第 2 步：部署 Worker

仍在 `api-worker` 目录：

```powershell
npx.cmd wrangler deploy
```

等出现 `Deployed` 之类成功提示。

---

## 第 3 步：自检（确认接口活了）

把下面里的 `你的钥匙` 换成第 1 步设的密码：

```powershell
$base = "https://jfo-api.jfo-api.workers.dev"
$key = "你的钥匙"
$h = @{ Authorization = "Bearer $key" }

Invoke-RestMethod "$base/api/health"
```

应看到里有 `"hermesBridgeConfigured": true`（设了钥匙并 deploy 后）。

再测 Hermes 专用健康检查：

```powershell
Invoke-RestMethod "$base/api/hermes/health" -Headers $h
```

应返回 `ok: true`。

---

## 第 4 步：列你在网站上传的文件

把 `userId` 换成你登录网站的账号 id（演示环境常见 `jensen-fang`）：

```powershell
Invoke-RestMethod "$base/api/hermes/projects/nn-fresh-port/manifest?scope=package" -Headers $h
```

- **`files` 有内容**：成功，记下 `documentId` 和 `textUrl`（项目资料包**按项目共享**，不需 userId）。  
- **`files` 是空的**：请先在 **网站** 项目详情里上传 **项目资料包**（任意有权限成员均可）。

---

## 第 5 步：读某一个文件的正文（可选）

从第 4 步拿一个 `documentId`，例如 `abc-123`：

```powershell
Invoke-RestMethod "$base/api/hermes/projects/nn-fresh-port/documents/abc-123/text" -Headers $h
```

应返回很长一段 `text`（尽调 PDF 提取的正文）。

---

## 第 6 步：让 Hermes 会用（Railway）

1. 打开 Railway → Hermes 服务 → **Variables**，新增：  
   - `JFO_API_PUBLIC_BASE` = `https://jfo-api.jfo-api.workers.dev`  
   - `JFO_INTERNAL_KEY` = 与第 1 步 **完全相同**  
   - `JFO_DEFAULT_USER_ID` = 可选；仅拉 **对话临时文件** 时用，项目资料包已按项目共享  

2. 把本仓库里的文件夹复制到 Hermes（若你用本机 Hermes，路径是 `~/.hermes/skills/`）：  
   `hermes-railway/skills/jfo-r2-materials/`  

3. Dashboard → **SKILLS** → 启用 `jfo-r2-materials`。  

4. 在 **SOUL** 或 CONFIG 里加一句（见 `docs/HERMES-R2-READ.md` 里 SOUL 段落）。

5. **Redeploy** Railway。

---

## 第 7 步：在 Hermes 里说一句人话

在 **Hermes Dashboard → CHAT**（需 `HERMES_DASHBOARD_TUI=1`）里发，**不要**在家办网站对话里测 curl。

```text
请按 jfo-r2-materials：projectId=nn-fresh-port，拉取网站项目资料包全文（scope=package），然后执行 project-intake。
```

Agent 应先 curl/API 拉 manifest，再读 text，再跑 intake。

---

## 网站对话也要「齐全」（已支持）

家办 **项目对话** 会根据关键词自动切换模式（Worker `/api/chat`）：

| 你说的话里包含 | 模式 |
|----------------|------|
| intake、五维、尽调覆盖度、深度分析… | **深度尽调**：注入项目资料包几乎全部正文 |
| 知识网络、生成 HTML、更新 KB… | **知识网络**：同上 + 要求输出合域 Portable 主题 HTML |

示例（在 **网站** 项目页对话里发）：

```text
基于已上传尽调资料，做 project-intake 五维覆盖度检查（✅/⚠️/❌）。
```

```text
生成 [AI] 南宁东盟生鲜食品智慧港_知识网络.html，合域 Portable 主题，先含项目快照与已有资料板块。
```

回复若含 HTML，会出现 **「预览知识网络 HTML」** 按钮。

部署 Worker 后生效：`cd api-worker` → `npx.cmd wrangler deploy`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `Unauthorized` | Worker 与 Railway 的 `JFO_INTERNAL_KEY` 不一致，或 deploy 前没 secret |
| `hermesBridgeConfigured: false` | 没执行 `secret put JFO_INTERNAL_KEY` 或没 deploy |
| manifest 空 | 网站该项目未上传项目资料包 |
| PowerShell 不让跑 npx | 用 `npx.cmd` 代替 `npx` |
| Hermes `Arrearage` / 400 | 阿里云百炼账户欠费或额度用尽；充值后 Restart Gateway，或检查 `DASHSCOPE_API_KEY` |
| 网站说「无法 curl」 | 正常：网站不走终端；用深度/知识网络话术或 Hermes CHAT |

---

## 接口清单（给进阶参考）

详见 [HERMES-R2-READ.md](./HERMES-R2-READ.md)。
