# JFO API Worker（Cloudflare）

为 GitHub Pages 前端提供：

- `GET /api/health`
- `GET /api/projects/:projectId/citations`
- `POST /api/projects/:projectId/files`（上传资料 / 会话附件）
- `POST /api/chat`（关键词检索 + 调 Hermes/千问）

**完整小白步骤见：** [docs/DEPLOY-CLOUDFLARE-QWEN.md](../docs/DEPLOY-CLOUDFLARE-QWEN.md)

快速命令：

```bash
npm install
# 编辑 wrangler.toml 中的 D1 database_id
npx wrangler d1 execute jfo-meta --remote --file=./schema.sql
copy .dev.vars.example .dev.vars
npx wrangler deploy
```

`ALLOWED_ORIGIN` 已默认 `https://fangjg16.github.io`（无自定义域名）。
