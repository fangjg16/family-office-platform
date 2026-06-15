# Hermes @ Railway：SSH 治本 + Dashboard（手把手）

> **搭建期验收**：家办对话里生成知识网络后，须看到 **「文件 API 回传」**。  
> 若只有 **「从回复提取 HTML」**，说明主链路（Hermes `curl PUT`）未通，不能当搭建完成。

### ⚠️ Start Command 固定写法（勿留空）

| 写法 | 结果（本环境已验证） |
|------|----------------------|
| **留空** | 进 Hermes TUI → `Input is not a terminal` → 退出 → **502 Application failed to respond** |
| `gateway run` | Railway 部署失败（找不到 `gateway` 可执行文件） |
| `entrypoint.sh gateway run` | s6 报错，502 |
| **`hermes gateway run`** | ✅ 8642 API 正常（家办用这个） |

**不要删掉 `hermes gateway run` 试留空。** Dashboard 打不开时也别留空，见第五节可选方案。

---

## 一、你需要准备什么

| 项 | 说明 |
|----|------|
| 电脑 | Windows，已能打开 PowerShell |
| Railway CLI | 本机已安装 `railway`（你用过 `railway.cmd` 即可） |
| 登录 | 浏览器已登录 [railway.app](https://railway.app) |
| 项目 | `exciting-optimism` → 服务 `hermes-agent` |

**不要改** 家办主链路：`HERMES_BASE_URL` 仍指向 `https://hermes-agent-production-02eb.up.railway.app`（8642）。

---

## 二、Railway SSH 怎么进（第一次也会）

### 2.1 在本机 PowerShell 里链接项目（只需做一次）

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform"
railway.cmd login
railway.cmd link -p c6d187c9-e149-4e27-b576-8d0c763f0d85 -e production -s hermes-agent
```

若提示你选择 workspace / project，选 **exciting-optimism** → **production** → **hermes-agent**。

### 2.2 进入容器（SSH）

```powershell
railway.cmd ssh -s hermes-agent
```

成功时，提示符会变成容器里的 shell（例如 `hermes@...$`），**不是**你本机的 `PS C:\...`。

### 2.3 在网页上复制 SSH 命令（可选）

1. 打开 [Railway](https://railway.app) → 项目 **exciting-optimism** → 服务 **hermes-agent**
2. 右上角或服务菜单里找 **Connect** / **SSH**
3. 点 **Copy SSH Command**，粘贴到 PowerShell 回车

### 2.4 退出 SSH

```bash
exit
```

---

## 三、容器内「治本」：skills + SOUL + 目录（复制粘贴）

> 以下命令 **在 SSH 进容器之后** 执行（一行一行复制，等上一条跑完再跑下一条）。

### 3.1 确认数据卷与身份

```bash
whoami
echo "HERMES_HOME=${HERMES_HOME:-/opt/data}"
ls -la /opt/data | head
```

Railway 卷一般挂在 **`/opt/data`**。

### 3.2 建目录（避免 Permission denied）

```bash
export HERMES_HOME=/opt/data
export HERMES_SKILLS_DIR=/opt/data/.hermes/skills
mkdir -p /opt/data/.hermes/skills /opt/data/kb /opt/data/logs
ls -la /opt/data/.hermes/skills
```

### 3.3 安装合域 skills（GitHub Raw）

**推荐（Railway，无交互、无安全扫描误拦）：**

```bash
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-railway-curl-only.sh" -o /tmp/install-curl-only.sh
HERMES_HOME=/opt/data HERMES_SKILLS_DIR=/opt/data/.hermes/skills bash /tmp/install-curl-only.sh
```

若你已在跑旧脚本 `install-jfo-skills-v25.sh` 且卡在 `Uninstall` / `Pick a category` / `BLOCKED exfiltration`：按 **Ctrl+C** 停掉，改跑上面 **curl-only** 脚本。

旧脚本 `install-jfo-skills-v25.sh` 会调用 `hermes skills install`，可能：

| 现象 | 原因 |
|------|------|
| `Uninstall 'xxx'?` | CLI 先卸旧 skill |
| `Pick a category` | CLI 问分类；**直接回车** |
| `jfo-r2-materials` **BLOCKED exfiltration** | 安全扫描把 SKILL 里的 `curl` 示例当成危险；**用 curl-only 脚本绕过** |
| `OK: hermes directory install` 但前面有 Fetch Error | CLI 误报成功，**仍以 curl-only 校验文件是否存在** |

验收（必须有这些文件）：

```bash
ls -la /opt/data/.hermes/skills/knowledge-base-generation/
ls -la /opt/data/.hermes/skills/knowledge-base-generation/references/
ls -la /opt/data/.hermes/skills/knowledge-base-generation/assets/
```

应看到：`SKILL.md`、`assets/kb-template.html`、`references/kb-schema.md`、`assets/components.html` 等；`grep revealAnchor assets/kb-template.html` 应有输出。

### 3.4 写入 SOUL（知识网络硬性规则）

```bash
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/SOUL-JFO-KB.md" -o /opt/data/SOUL.md
head -n 5 /opt/data/SOUL.md
```

若你环境用 `~/.hermes/SOUL.md`，再执行：

```bash
mkdir -p /opt/data/.hermes
cp /opt/data/SOUL.md /opt/data/.hermes/SOUL.md
```

### 3.5 确认 Railway 环境变量（在网页看，不在 SSH 里改密钥）

在 Railway → **hermes-agent** → **Variables** 中应有（值你自己保管，不要提交 Git）：

| 变量 | 用途 |
|------|------|
| `JFO_API_PUBLIC_BASE` | `https://jfo-api.jfo-api.workers.dev` |
| `JFO_INTERNAL_KEY` | 与 Worker `wrangler secret put JFO_INTERNAL_KEY` **相同** |
| `API_SERVER_KEY` | 与 Worker `HERMES_API_KEY` **相同** |
| `HERMES_YOLO_MODE` | `1`（减少 curl 安全审批卡住） |
| `HERMES_DASHBOARD` | `1` |
| `HERMES_DASHBOARD_INSECURE` | `1`（见下文 Dashboard） |

Worker 侧密钥 **不能查看明文**，只能：

1. 打开 `https://jfo-api.jfo-api.workers.dev/api/health`
2. 看 `hermesBridgeConfigured: true`（表示 Worker **已设** `JFO_INTERNAL_KEY`）
3. 若不确定是否一致：在本机 `api-worker` 目录执行 `npx wrangler secret put JFO_INTERNAL_KEY`，粘贴 **与 Railway 完全相同** 的一串，再 `npx wrangler deploy`

### 3.6 退出 SSH 并在 Railway 点 Restart

```bash
exit
```

Railway → **hermes-agent** → **Restart**（或等部署完成），**不要** Redeploy 新镜像除非你知道后果。

---

## 四、搭建期验收（家办网站）

1. 打开 `https://jfo-api.jfo-api.workers.dev/api/health`  
   - `hermesAuthOk: true`  
   - `hermesRunsOk: true`  
   - `hermesBridgeConfigured: true`
2. 打开 `https://hermes-agent-production-02eb.up.railway.app/health` → `status: ok`
3. 家办网站 → 项目 → **生成知识网络**
4. 成功标准：回复末尾为 **「已同步至项目知识网络 vN（文件 API 回传）」**  
   - 若仍是「从回复提取 HTML」→ 主链路未通，回到第三节重做或查 Railway 日志

---

## 五、看 Hermes Dashboard（次要需求，不破坏 8642 API）

### 5.1 原则

- **家办平台**只用 **8642** Gateway API，**不要**把 `HERMES_BASE_URL` 改成 Dashboard 地址。
- **不要**把 Start Command 改成单独的 `gateway run`（你这台 Railway 会部署失败）。
- **保持** 主进程为 `hermes gateway run`，另在后台启动 Dashboard。

### 5.2 推荐 Start Command（主 API + Dashboard 并存）

Railway → **hermes-agent** → **Settings** → **Deploy** → **Custom Start Command**，**整行**粘贴：

```bash
sh -c 'hermes dashboard --host 0.0.0.0 --port 9119 --insecure >> /opt/data/logs/dashboard.log 2>&1 & exec hermes gateway run'
```

同时确认 Variables：

```text
HERMES_DASHBOARD=1
HERMES_DASHBOARD_INSECURE=1
HERMES_DASHBOARD_PORT=9119
```

保存后等部署 **Success**，再打开：

```text
http://zephyr.proxy.rlwy.net:12180/
```

（你已有的 TCP 代理：`12180` → 容器 `9119`。）

### 5.3 若 Dashboard 仍打不开

1. SSH 进容器：`railway.cmd ssh -s hermes-agent`
2. 看日志：`tail -n 50 /opt/data/logs/dashboard.log`
3. 看 9119 是否在听：`ss -tlnp | grep 9119` 或 `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:9119/`
4. **不要** 为 Dashboard 改掉 `hermes gateway run`；家办预览仍用网站「预览知识网络 HTML」

### 5.4 回滚 Start Command

若新 Start Command 导致 Deploy 失败或 502：

1. Deployments → 回滚到上一版 **Success**
2. 或把 Start Command 改回：`hermes gateway run`
3. Restart 服务

---

## 六、路径 A / 路径 B 对照（给搭建的人看）

| 对话里看到 | 含义 | 搭建期 |
|------------|------|--------|
| **文件 API 回传** | Hermes `curl PUT` 成功，Worker 从 R2 读 HTML | ✅ 验收通过 |
| **从回复提取 HTML** + 说明「本次未 PUT…」 | Worker 兜底入库，Hermes 未 PUT | ❌ 继续 SSH 治本 |
| 知识网络交付失败 | 连兜底都没有 | ❌ 查 Hermes 502 / 日志 |

---

## 七、常见问题

| 现象 | 处理 |
|------|------|
| `railway ssh` 说 container not running | Railway 里 Restart，等绿再 SSH |
| `Permission denied` 写 kb | 用 `/opt/data/kb`，第三节 `mkdir` |
| skill 文件 not found | 重跑 `install-jfo-skills-v28.sh` 或 curl-only，检查 `HERMES_SKILLS_DIR` |
| `/api/v1/models` 404 | 测 `/v1/models` 和 `/health`，不是 `/api/v1/...` |
| 只想看图、不急 Dashboard | 家办对话「预览 / 新标签页」即可 |

---

## 八、改 Worker 文案后部署（可选）

若更新了 `api-worker` 里知识网络提示文案，在本机：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform\api-worker"
npx.cmd wrangler deploy
```

这样「从回复提取 HTML」时会显示准确说明，而不会再误写「建议配置密钥」（在已配 `JFO_INTERNAL_KEY` 时）。
