# RAGFlow 本地代理（最简）

这个目录用于把前端请求转发到另一台机器上的 RAGFlow，解决：

- 浏览器跨域（CORS）
- API Key 不暴露到前端
- 会话 `session_id` 续聊

## 1) 复制配置文件

```bash
cp .env.example .env
```

Windows 也可直接手动复制并重命名为 `.env`。

必须填写：

- `RAGFLOW_BASE`：另一台机器可访问地址，例如 `http://192.168.1.23:9380`
- `RAGFLOW_API_KEY`
- `RAGFLOW_CHAT_ID`

## 2) 安装并启动

```bash
npm install
npm run dev
```

启动后默认监听：`http://localhost:8787`

## 3) 健康检查（可选）

```bash
curl http://localhost:8787/api/ragflow/health
```

## 4) 前端配置

在项目根目录 `family-office-platform/.env.local` 填：

```bash
VITE_RAGFLOW_MODE=proxy
VITE_RAGFLOW_CHAT_ENDPOINT=http://localhost:8787/api/ragflow/chat
```

然后运行前端：

```bash
npm run dev
```

登录 `JimmyHuang`（Core）后进入 `nn-fresh-port` 即可实测。
