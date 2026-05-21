import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PROXY_PORT || 8787);
const RAGFLOW_BASE = (process.env.RAGFLOW_BASE || "").trim().replace(/\/$/, "");
const RAGFLOW_API_KEY = (process.env.RAGFLOW_API_KEY || "").trim();
const RAGFLOW_CHAT_ID = (process.env.RAGFLOW_CHAT_ID || "").trim();

const sessionByConversation = new Map();

function requireEnv(res) {
  const missing = [];
  if (!RAGFLOW_BASE) missing.push("RAGFLOW_BASE");
  if (!RAGFLOW_API_KEY) missing.push("RAGFLOW_API_KEY");
  if (!RAGFLOW_CHAT_ID) missing.push("RAGFLOW_CHAT_ID");
  if (missing.length > 0) {
    res.status(500).json({
      answer: `代理未配置：缺少 ${missing.join(", ")}`,
    });
    return true;
  }
  return false;
}

app.get("/api/ragflow/health", async (_req, res) => {
  if (requireEnv(res)) return;
  try {
    const resp = await fetch(`${RAGFLOW_BASE}/api/v1/chats?page=1&page_size=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${RAGFLOW_API_KEY}`,
      },
    });
    res.json({
      ok: resp.ok,
      status: resp.status,
      endpoint: `${RAGFLOW_BASE}/api/v1/chats`,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/ragflow/chat", async (req, res) => {
  if (requireEnv(res)) return;
  try {
    const { message, conversationId, userId } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ answer: "message 不能为空" });
    }

    const sessionId = conversationId ? sessionByConversation.get(conversationId) : undefined;

    const payload = {
      question: String(message),
      stream: false,
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(userId ? { user_id: String(userId) } : {}),
    };

    const resp = await fetch(`${RAGFLOW_BASE}/api/v1/chats/${RAGFLOW_CHAT_ID}/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAGFLOW_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }

    if (!resp.ok) {
      const msg =
        data?.message ||
        data?.data?.answer ||
        `RAGFlow 请求失败（HTTP ${resp.status}）`;
      return res.status(resp.status).json({ answer: String(msg) });
    }

    const answer =
      data?.data?.answer || data?.answer || data?.message || "RAGFlow 未返回可展示答案";
    const newSession = data?.data?.session_id;
    if (conversationId && newSession) {
      sessionByConversation.set(conversationId, newSession);
    }

    return res.json({
      answer: String(answer),
      session_id: newSession || null,
    });
  } catch (err) {
    return res.status(500).json({
      answer: `代理异常：${String(err)}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[ragflow-proxy] listening on http://localhost:${PORT}`);
});
