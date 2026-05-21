# Railway 部署 Hermes Agent（千问 DashScope）

本目录是**配置说明**，不是可执行代码。Hermes 需在 Railway（或其它 VPS）上单独安装运行。

## 1. 创建 Railway 项目

1. 登录 [Railway](https://railway.app)。
2. **New Project** → 选 **Empty Project** 或从 Docker 部署。
3. 若使用 Docker：按 [Hermes Agent 官方仓库](https://github.com/NousResearch/hermes-agent) 的 README 构建镜像，启动命令为 `hermes gateway`。

## 2. 环境变量（千问）

在 Railway → **Variables** 中添加（值来自阿里云 DashScope）：

```bash
# Hermes API 服务（给 Cloudflare Worker 调用）
API_SERVER_ENABLED=true
API_SERVER_KEY=请换成随机长密码_与Worker的HERMES_API_KEY相同

# 千问 / DashScope（标准按量 Key）
DASHSCOPE_API_KEY=sk-xxxxxxxx

# 若 Hermes 使用 OpenAI 兼容 custom provider，常见写法：
# MODEL_PROVIDER=custom
# OPENAI_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
# OPENAI_API_KEY=同上 DASHSCOPE_API_KEY
# MODEL_DEFAULT=qwen-plus
```

**注意：** 国际站 / 国内站 base_url 不同。Coding Plan 与标准 Key 不能混用 endpoint。  
见：[Hermes Qwen Cloud 文档](https://docs.qwencloud.com/token-plan/tools/hermes-agent)、[Providers](https://hermes-agent.nousresearch.com/docs/integrations/providers)。

安装 Hermes 后可在容器里执行：

```bash
hermes config set model.provider custom
hermes config set model.base_url https://dashscope.aliyuncs.com/compatible-mode/v1
hermes config set model.api_key $DASHSCOPE_API_KEY
hermes config set model.default qwen-plus
```

（国际用户可能用 `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`，以控制台说明为准。）

## 3. 启动与公网地址

启动：`hermes gateway`（默认监听 `8642`）。

Railway 会分配 **Public URL**，例如 `https://hermes-production-xxxx.up.railway.app`。

Worker 里配置（**不要**加 `/v1` 后缀，Worker 会自动请求 `/api/v1/chat/completions`）：

```bash
HERMES_BASE_URL=https://hermes-agent-production-xxxx.up.railway.app
HERMES_API_KEY=与 API_SERVER_KEY 相同
HERMES_MODEL=qwen-plus
```

**重要：** Railway 模板默认公网域名往往指向 **Dashboard（9119）**。OpenAI 兼容接口在 **`/api/v1/...`**。若 `/v1/chat/completions` 返回 405/HTML，说明地址指错了；本仓库 Worker 已改为请求 `/api/v1/chat/completions`。

## 4. 自测

```bash
curl "https://你的railway域名/v1/models" \
  -H "Authorization: Bearer 你的API_SERVER_KEY"
```

应返回模型列表或 200 JSON。

再测对话：

```bash
curl "https://你的railway域名/v1/chat/completions" \
  -H "Authorization: Bearer 你的API_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"qwen-plus\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"stream\":false}"
```

## 5. 安全建议

- 不要将 `API_SERVER_KEY` / `DASHSCOPE_API_KEY` 提交到 GitHub。
- 生产环境限制 Hermes 工具集（避免对公网开放终端工具）。
- 仅允许 Cloudflare Worker 的 IP 或共享密钥访问（Railway 可再加自定义 header 校验）。
