# 从 GitHub 安装 Hermes Skills（合域 v2.5 + 家办桥接）

源：**opportunistic-investments v2.5** → 同步到本仓库 `hermes-railway/`。

```text
hermes-railway/
├── skills/
│   ├── jfo-r2-materials/          # 家办 R2 资料桥（仅网站）
│   ├── knowledge-base-generation/   # ★ 整目录：SKILL + kb-template + assets + references
│   └── …（其余 15 个 skill + 可选 knowledge/）
├── reference/
│   ├── STYLE_GUIDE.md
│   ├── skills_reference.md
│   └── README-hermes.md           # Hermes 速读（非完整 plugin README）
├── install-jfo-skills-v25.sh        # Railway 容器一键安装
└── SOUL-JFO-KB.md                   # 粘贴到 Dashboard → SOUL
```

**不要**把整包 `opportunistic-investments v2.5` 提交进 Git（体积、`.bak`）；只维护 `hermes-railway/`。

---

## 第 1 步：本机同步 v2.5 后 push

修改 plugin 后，将 `heyu-opportunistic-investments/skills/*`、`STYLE_GUIDE.md`、`skills_reference.md` 复制到 `hermes-railway/`（或让助手用脚本同步），然后：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform"
git add hermes-railway/
git status
git commit -m "Sync Hermes skills to opportunistic v2.5 with full KB directory layout"
git push origin main
```

验证 Raw（浏览器应显示原文，非 404）：

```text
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/kb-template.html
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/references/STYLE_GUIDE.md
```

---

## 第 2 步：Railway SSH

**手把手（含搭建验收 + Dashboard 不破坏 8642）**：见 **[docs/HERMES-RAILWAY-SSH-SETUP.md](../docs/HERMES-RAILWAY-SSH-SETUP.md)**。

```powershell
cd family-office-platform
railway.cmd link -p c6d187c9-e149-4e27-b576-8d0c763f0d85 -e production -s hermes-agent
railway.cmd ssh -s hermes-agent
```

---

## 第 3 步：容器内安装（推荐脚本）

```bash
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-v25.sh" -o /tmp/install-jfo-skills-v25.sh
bash /tmp/install-jfo-skills-v25.sh
```

或手动确认 KB 目录：

```bash
ls -la ~/.hermes/skills/knowledge-base-generation/
# 须有：SKILL.md  kb-template.html  assets/components.html  references/STYLE_GUIDE.md  references/README-hermes.md
```

**禁止**对 `knowledge-base-generation` 只执行 `hermes skills install .../SKILL.md`（会丢失模板）。

其余 16 个 skill 可为单文件 `SKILL.md`；脚本会为每个 skill 拉取 `knowledge/README.md`（v2.5 学习笔记目录）。

装完 → **Restart Gateway** → `hermes skills list | grep knowledge-base`

---

## 第 4 步：SOUL（必做）

打开 `hermes-railway/SOUL-JFO-KB.md`，全文粘贴到 Railway Hermes **SOUL** 或 **CONFIG**。

与 Worker 配合：网站发「生成知识网络」时，Worker 也会在 instructions 里写入「执行前必读」五条路径 + 文件 PUT 回路。

---

## 知识网络任务时的阅读顺序（v2.5）

| 顺序 | 文件 | 作用 |
|------|------|------|
| 1 | `references/README-hermes.md` | 家办流程速读 |
| 2 | `references/STYLE_GUIDE.md` | 版式与组件规范 |
| 3 | `SKILL.md` | slot / 成熟度 / changelog |
| 4 | `kb-template.html` | HTML 壳（勿改 JS/CSS） |
| 5 | `assets/components.html` | 时间轴、topic 等片段 |
| 6 | `jfo-r2-materials` | 网站资料 |
| 7 | 生成 HTML → PUT + 回复 ` ```html ` |

---

## 注意

| 问题 | 处理 |
|------|------|
| Raw 404 | 未 push 或分支不是 `main` |
| 无 kb-template | 用了旧版「只装 SKILL.md」→ 跑 `install-jfo-skills-v25.sh` |
| Redeploy 后 skill 没了 | 无 Volume → Redeploy 后重跑安装脚本 |
| STYLE_GUIDE 找不到 | 确认 `references/STYLE_GUIDE.md` 在 KB skill 目录内 |

---

## 与 Claude plugin 的关系

| 位置 | 用途 |
|------|------|
| 本机 `opportunistic-investments v2.5/` | Cowork 安装 plugin（含 `commands/`） |
| GitHub `hermes-railway/` | **Hermes 唯一安装源** |
| 家办网站 | Worker 指挥 Hermes，不装 plugin |
