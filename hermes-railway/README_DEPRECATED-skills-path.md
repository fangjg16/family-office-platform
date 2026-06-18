# DEPRECATED — `/opt/data/.hermes/skills`

**勿将本路径作为 Hermes skills 根目录。**

| 路径 | 状态 |
|------|------|
| `/opt/data/skills` | ✅ **正式运行路径**（Hermes Gateway `skill_view` 读取） |
| `/opt/data/.hermes/skills` | ❌ **已废弃**（误装副本，已重命名为 `skills_deprecated_YYYYMMDD`） |

安装后自检（三条须全部通过）：

```bash
test -f /opt/data/skills/knowledge-base-generation/references/kb-schema.md
test -f /opt/data/skills/knowledge-base-generation/assets/kb-template.html
grep -q revealAnchor /opt/data/skills/knowledge-base-generation/assets/kb-template.html
```

详见 `docs/HERMES-RAILWAY-SSH-SETUP.md` 第三节。
