# 从 GitHub Raw 安装 Hermes Skills（免 nano）

把合域 v2.2 的 16 个 skill + 家办桥接 `jfo-r2-materials` 都放在本仓库：

```text
hermes-railway/skills/<skill-name>/SKILL.md
hermes-railway/reference/STYLE_GUIDE.md
hermes-railway/reference/skills_reference.md
```

**不要**把 `opportunistic-investments v2.2` 整包提交到 Git（体积大、有 `.bak`）；已复制进 `hermes-railway/skills/`。

---

## 第 1 步：推到 GitHub（你本机做一次）

在 PowerShell：

```powershell
cd "c:\Users\jensenfang\Downloads\家办平台\family-office-platform"
git add hermes-railway/skills hermes-railway/reference hermes-railway/INSTALL-SKILLS-FROM-GITHUB.md
git status
git commit -m "Add Hermes skills (heyu v2.2 + jfo-r2-materials) for raw install"
git push origin main
```

> 仓库须为 **Public**（或 Hermes 容器能访问的私有 Raw），否则 Raw URL 会 404。

推送成功后，任意 skill 的 Raw 地址形如：

```text
https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/jfo-r2-materials/SKILL.md
```

在浏览器打开上述链接，应直接看到 Markdown 原文（不是 404）。

---

## 第 2 步：进 Railway 容器（仍需 SSH 一次，但不用 nano）

完成 `ssh-keygen` 与 `railway.cmd login` 后：

```powershell
railway.cmd ssh --project=c6d187c9-e149-4e27-b576-8d0c763f0d85 --environment=c3fbdd4a-fa30-4bcb-81c5-da20dc1b48b7 --service=eb8fc221-019c-4539-92e2-04e755375b6a
```

---

## 第 3 步：在容器里批量安装（复制整段）

```bash
BASE="https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills"
SKILLS="jfo-r2-materials project-intake document-reorganize public-info-search knowledge-base-generation term-annotator comp-analysis dd-checklist dd-claim-audit background-check risk-matrix returns-analysis sensitivity-analysis value-creation-plan ic-memo gap-tracking node-monitoring"

for s in $SKILLS; do
  echo "=== Installing $s ==="
  hermes skills install "$BASE/$s/SKILL.md" --name "$s" || echo "FAILED: $s"
done

hermes skills list | grep -E 'jfo-r2|project-intake|knowledge-base'
```

装完可在 Hermes Dashboard → **Restart Gateway**，SKILLS 里搜索 `jfo`、`intake`。

---

## 只装桥接 skill（最小）

```bash
hermes skills install "https://raw.githubusercontent.com/fangjg16/family-office-platform/main/hermes-railway/skills/jfo-r2-materials/SKILL.md" --name jfo-r2-materials
```

---

## 第 4 步：SOUL / CONFIG（网页粘贴，不用 SSH）

Dashboard → **CONFIG** 或 **SOUL**，追加：

```markdown
## 联合家办平台 · 资料来源

当用户提到家办平台项目（projectId 如 nn-fresh-port）或「网站上传的资料」时：

1. **禁止**默认本地项目文件夹里有尽调 PDF。
2. **必须先**执行 skill `jfo-r2-materials`：GET manifest?scope=package，再 GET 各 textUrl（Header: Authorization: Bearer $JFO_INTERNAL_KEY）。
3. 再用 project-intake、knowledge-base-generation 等处理已拉取的正文。
4. 生成知识网络 HTML 时遵守合域 STYLE_GUIDE（见仓库 hermes-railway/reference/STYLE_GUIDE.md）。

环境变量：JFO_API_PUBLIC_BASE、JFO_INTERNAL_KEY。
```

---

## 注意

| 问题 | 处理 |
|------|------|
| Raw 404 | 还没 `git push`，或分支不是 `main` |
| install 401/失败 | 容器出网受限；改用手动 curl + 写到 ~/.hermes/skills/ |
| Redeploy 后 skill 没了 | 容器无持久盘；Redeploy 后**再跑一遍**第 3 步，或挂 Railway Volume |
| 16 个 skill 已存在 | `hermes skills list` 看是否重复；重复可 `hermes skills uninstall <name>` 后再装 |

---

## 和「整包 opportunistic-investments v2.2」的关系

| 位置 | 用途 |
|------|------|
| 你本机 `家办平台/opportunistic-investments v2.2/` | 本地备份 / Cowork 插件安装 |
| GitHub `hermes-railway/skills/*` | **Hermes 用 Raw URL 安装的唯一来源** |
| 网站 `family-office-platform` | 对话与上传，不装 plugin |
