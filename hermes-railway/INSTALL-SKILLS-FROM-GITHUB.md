# 从 GitHub 安装 Hermes Skills（合域 v2.8 + 家办桥接）

源：**opportunistic-investments v2.8** → 同步到本仓库 `hermes-railway/`。

```text
hermes-railway/
├── skills/
│   ├── jfo-r2-materials/          # 家办 R2 资料桥（仅网站，勿覆盖）
│   ├── knowledge-base-generation/   # ★ 整目录：SKILL + assets/kb-template + references + KB-CONFIG
│   └── …（其余 15 个 skill + 可选 knowledge/）
├── reference/                     # DEPRECATED v2.7 归档，勿引用
├── install-jfo-skills-v28.sh        # Railway 容器一键安装（推荐）
├── install-jfo-skills-railway-curl-only.sh
└── SOUL-JFO-KB.md                   # 粘贴到 Dashboard → SOUL
```

**不要**把整包 `opportunistic-investments` 提交进 Git；只维护 `hermes-railway/`。

---

## 第 1 步：push 后验证 Raw

验证 Raw（浏览器应显示原文，非 404）：

```text
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/assets/kb-template.html
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/SKILL.md
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/knowledge-base-generation/references/kb-schema.md
```

`assets/kb-template.html` 须含 `revealAnchor`；`<body>` 内应含 `<!-- KB-CONFIG` 占位块。

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
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-v28.sh" -o /tmp/install-jfo-skills-v28.sh
bash /tmp/install-jfo-skills-v28.sh
```

Railway 卷环境（无 hermes CLI 交互）**必须**用 curl-only，且装到 **`/opt/data/skills`**：

```bash
export HERMES_HOME=/opt/data
export HERMES_SKILLS_DIR=/opt/data/skills
curl -fsSL "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/install-jfo-skills-railway-curl-only.sh" -o /tmp/install.sh
bash /tmp/install.sh
```

**安装后自检（正式路径 `/opt/data/skills`，不是 `/opt/data/.hermes/skills`）：**

```bash
test -f /opt/data/skills/knowledge-base-generation/references/kb-schema.md
test -f /opt/data/skills/knowledge-base-generation/assets/kb-template.html
grep -q revealAnchor /opt/data/skills/knowledge-base-generation/assets/kb-template.html && echo SKILLS_SELF_CHECK_OK
```

若存在误装的 `/opt/data/.hermes/skills`，重命名为 `skills_deprecated_YYYYMMDD` 并见 [README_DEPRECATED-skills-path.md](./README_DEPRECATED-skills-path.md)。

手动确认 KB 目录（路径均为 `/opt/data/skills/...`）：

```bash
ls -la /opt/data/skills/knowledge-base-generation/
# 须有：SKILL.md  assets/kb-template.html  assets/components.html
#       references/kb-schema.md  kb-config.md  slot-specific-rules.md
#       slot-rendering-rules.md  timeline-rules.md
grep revealAnchor /opt/data/skills/knowledge-base-generation/assets/kb-template.html
```

**禁止**对 `knowledge-base-generation` 只执行 `hermes skills install .../SKILL.md`（会丢失模板与 references）。

其余 15 个 skill 安装 `SKILL.md` + 可选 `knowledge/README.md`；**`jfo-r2-materials` 必须一起安装**。

装完 → **Restart Gateway** → 粘贴 `SOUL-JFO-KB.md`

---

## 第 4 步：SOUL（必做）

打开 `hermes-railway/SOUL-JFO-KB.md`，全文粘贴到 Railway Hermes **SOUL** 或 **CONFIG**。

Worker 在知识网络任务时会按 **mode** 注入 required reads + KB-CONFIG 规则 + incremental/full/**reorder** 模式 + 文件 PUT 回路。

---

## 知识网络任务时的阅读顺序（v2.8，按 mode）

| Mode | 必读 |
|------|------|
| initial / full | kb-schema、kb-config、content-rules、slot-specific-rules、slot-rendering-rules、assets/kb-template.html、assets/components.html + jfo-r2-materials 主要资料 |
| incremental | 当前 KB HTML + 上述规则（按需 slot）+ 相关资料 textUrl |
| reorder | 当前 KB + kb-config（**不**拉项目资料全文） |
| timeline 相关 | + timeline-rules |
| visual/debug | visual-style-guide（可选） |

**勿用**：`reference/skills_reference.md`、根目录 `kb-template.html`、旧 `STYLE_GUIDE.md`、`README-hermes.md`

---

## v2.8 要点

| 能力 | 说明 |
|------|------|
| 正式模板 | `assets/kb-template.html`（含 revealAnchor） |
| KB-CONFIG | display-order、project-type（8 类）、rendering-mode、multi-asset、config-version、display-order-history |
| 11 canonical slots | 见 `references/kb-schema.md` |
| timeline | 三区块：已发生 / 正在推进 / 未来关键节点（`timeline-rules.md`） |
| citation | `href="#source-U-1"` 须对应 appendix `id="source-U-1"` |
| 重排模式 | 仅改 KB-CONFIG + nav + 编号，不重写内容 |
| Worker 校验 | 新写入 strict v2.8；reorder 限制 CONFIG/nav/编号；旧 HTML 预览不强制 strict |

---

## 注意

| 问题 | 处理 |
|------|------|
| Raw 404 | 未 push 或分支不是 `main` |
| 无 assets/kb-template | 用了旧版 v2.7 脚本 → 跑 `install-jfo-skills-v28.sh` |
| Redeploy 后 skill 没了 | 无 Volume → Redeploy 后重跑安装脚本 |
| Hermes 报 reference files don't exist | 确认 `HERMES_SKILLS_DIR=/opt/data/skills`；勿装到 `.hermes/skills`；跑第三节自检三条 `test`/`grep` |

---

## 本地 Worker 样例校验

```bash
cd api-worker
npx tsx scripts/validate-kb-v28-samples.ts
```

应通过 `sample-output.html` 与 `sample-output-reordered.html`。
