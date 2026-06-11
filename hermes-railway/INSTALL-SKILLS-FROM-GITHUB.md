# 从 GitHub 安装 Hermes Skills（合域 v2.7 + 家办桥接）

源：**opportunistic-investments v2.7** → 同步到本仓库 `hermes-railway/`。

```text
hermes-railway/
├── skills/
│   ├── jfo-r2-materials/          # 家办 R2 资料桥（仅网站，勿覆盖）
│   ├── knowledge-base-generation/   # ★ 整目录：SKILL + kb-template + assets + references + KB-CONFIG
│   └── …（其余 15 个 skill + 可选 knowledge/）
├── reference/
│   ├── STYLE_GUIDE.md
│   ├── skills_reference.md
│   └── README-hermes.md           # Hermes 速读（非完整 plugin README）
├── install-jfo-skills-v27.sh        # Railway 容器一键安装（推荐）
├── install-jfo-skills-railway-curl-only.sh
└── SOUL-JFO-KB.md                   # 粘贴到 Dashboard → SOUL
```

**不要**把整包 `opportunistic-investments v2.7` 提交进 Git（体积、`.claude-plugin`、`commands/`）；只维护 `hermes-railway/`。

---

## 第 1 步：本机同步 v2.7 后 push

将 `heyu-opportunistic-investments/skills/*`、`STYLE_GUIDE.md`、`skills_reference.md` 复制到 `hermes-railway/`（**保留** `jfo-r2-materials`），然后：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform"
git add hermes-railway/ api-worker/src/knowledge-network-mode.ts api-worker/src/knowledge-network-intent.ts api-worker/src/hermes-knowledge-network.ts api-worker/src/chat-modes.ts src/lib/knowledge-network-prompts.ts src/lib/knowledge-network-intent.ts
git status
git commit -m "Sync Hermes skills to opportunistic v2.7 with KB-CONFIG and reorder mode"
git push origin main
```

验证 Raw（浏览器应显示原文，非 404）：

```text
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/kb-template.html
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/SKILL.md
```

`kb-template.html` 的 `<body>` 内应含 `<!-- KB-CONFIG` 占位块。

---

## 第 2 步：Railway SSH

**手把手**：见 **[docs/HERMES-RAILWAY-SSH-SETUP.md](../docs/HERMES-RAILWAY-SSH-SETUP.md)**。

```powershell
cd family-office-platform
railway.cmd link -p c6d187c9-e149-4e27-b576-8d0c763f0d85 -e production -s hermes-agent
railway.cmd ssh -s hermes-agent
```

---

## 第 3 步：容器内安装（推荐脚本）

**固定版本（避免 main 半更新）**：安装前可 `export JFO_SKILLS_RAW_BASE="https://raw.githubusercontent.com/fangjg16/family-office-platform/<git-sha>/hermes-railway"`（将 `<git-sha>` 换为已 push 的 commit）。

```bash
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-v27.sh" -o /tmp/install-jfo-skills-v27.sh
bash /tmp/install-jfo-skills-v27.sh
```

Railway 卷环境（无 hermes CLI 交互）可用：

```bash
export HERMES_HOME=/opt/data
export HERMES_SKILLS_DIR=/opt/data/.hermes/skills
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-railway-curl-only.sh" -o /tmp/install.sh
bash /tmp/install.sh
ln -sfn /opt/data/.hermes /root/.hermes   # 若 Hermes 读 ~/.hermes
```

手动确认 KB 目录：

```bash
ls -la ~/.hermes/skills/knowledge-base-generation/
# 须有：SKILL.md  kb-template.html  assets/components.html  references/STYLE_GUIDE.md  references/README-hermes.md
grep KB-CONFIG ~/.hermes/skills/knowledge-base-generation/SKILL.md | head -1
```

**禁止**对 `knowledge-base-generation` 只执行 `hermes skills install .../SKILL.md`（会丢失模板与 KB-CONFIG 说明）。

其余 16 个 skill 安装 `SKILL.md` + 可选 `knowledge/README.md`；**`jfo-r2-materials` 必须一起安装**。

装完 → **Restart Gateway** → 粘贴 `SOUL-JFO-KB.md`

---

## 第 4 步：SOUL（必做）

打开 `hermes-railway/SOUL-JFO-KB.md`，全文粘贴到 Railway Hermes **SOUL** 或 **CONFIG**。

Worker 在知识网络任务时会注入：必读五条路径 + KB-CONFIG 规则 + incremental/full/**reorder** 模式 + 文件 PUT 回路。

---

## 知识网络任务时的阅读顺序（v2.7）

| 顺序 | 文件 | 作用 |
|------|------|------|
| 1 | `references/README-hermes.md` | 家办流程速读、KB-CONFIG |
| 2 | `references/STYLE_GUIDE.md` | 版式与组件规范 |
| 3 | `SKILL.md` | canonical slots、KB-CONFIG、重排规则 |
| 4 | `kb-template.html` | HTML 壳 + KB-CONFIG 占位（勿改 JS/CSS） |
| 5 | `assets/components.html` | 时间轴、topic 等片段 |
| 6 | `jfo-r2-materials` | 网站资料 |
| 7 | 生成/重排 HTML → PUT + 回复 ` ```html ` |

---

## v2.7 要点

| 能力 | 说明 |
|------|------|
| KB-CONFIG | display-order、project-type（8 类）、rendering-mode、multi-asset、config-version、display-order-history |
| 展示顺序 | 由 KB-CONFIG 驱动；canonical slot key/锚点固定 |
| project-intake | 8 类 project-type；Factor A 分母 11 |
| 重排模式 | 仅改 KB-CONFIG + nav + 编号，不重写内容 |

---

## 注意

| 问题 | 处理 |
|------|------|
| Raw 404 | 未 push 或分支不是 `main` |
| 无 kb-template / 无 KB-CONFIG | 用了旧版「只装 SKILL.md」→ 跑 `install-jfo-skills-v27.sh` |
| Redeploy 后 skill 没了 | 无 Volume → Redeploy 后重跑安装脚本 |
| STYLE_GUIDE 找不到 | 确认 `references/STYLE_GUIDE.md` 在 KB skill 目录内 |
| Hermes 报 reference files don't exist | `ln -sfn /opt/data/.hermes /root/.hermes` |

---

## 与 Claude plugin 的关系

| 位置 | 用途 |
|------|------|
| 本机 `opportunistic-investments v2.7/` | Cowork 安装 plugin（含 `commands/`，**不**照搬为网站运行逻辑） |
| GitHub `hermes-railway/` | **Hermes 唯一安装源** |
| 家办网站 | Worker `chat-modes.ts` 做 intent routing + Hermes 桥接 |
