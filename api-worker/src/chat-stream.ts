import { CHAT_STATUS } from "./chat-context";

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** 防止长时间检索/生成无字节导致浏览器或代理判定连接空闲而断开 */
function scheduleSseKeepalive(
  controller: ReadableStreamDefaultController<Uint8Array>,
  intervalMs = 12_000,
): () => void {
  const enc = new TextEncoder();
  const ping = () => {
    try {
      controller.enqueue(enc.encode(": keepalive\n\n"));
    } catch {
      /* stream already closed */
    }
  };
  const id = setInterval(ping, intervalMs);
  return () => clearInterval(id);
}

export function jfoSseError(message: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(sseLine("error", { message })));
      controller.close();
    },
  });
}

/** 将 OpenAI 兼容 SSE 转为平台事件：meta / delta / done */
export function transformOpenAiStreamToJfo(
  upstream: ReadableStream<Uint8Array>,
  meta: Record<string, unknown>,
  onDone?: (fullAnswer: string) => void,
  options?: { emitMeta?: boolean },
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buffer = "";
  let full = "";
  const emitMeta = options?.emitMeta !== false;

  return new ReadableStream({
    async start(controller) {
      if (emitMeta) {
        controller.enqueue(enc.encode(sseLine("meta", meta)));
      }
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string }; finish_reason?: string }[];
              };
              const delta = json.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                full += delta;
                controller.enqueue(enc.encode(sseLine("delta", { text: delta })));
              }
            } catch {
              /* 忽略单行解析失败 */
            }
          }
        }
        onDone?.(full);
        controller.enqueue(
          enc.encode(sseLine("done", { answer: full, knowledgeNetworkHtml: null })),
        );
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (full.trim().length > 0) {
          onDone?.(full);
          controller.enqueue(
            enc.encode(
              sseLine("done", {
                answer: full,
                knowledgeNetworkHtml: null,
                truncated: true,
                truncateReason: msg,
              }),
            ),
          );
          controller.close();
        } else {
          controller.enqueue(enc.encode(sseLine("error", { message: msg })));
          controller.close();
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function fetchChatCompletionsStream(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  label: string,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const t = await res.text();
    let err = `${label} HTTP ${res.status}`;
    try {
      const j = JSON.parse(t) as { error?: { message?: string } };
      err = j.error?.message || err;
    } catch {
      if (t) err = t.slice(0, 200);
    }
    throw new Error(err);
  }

  if (!res.body) throw new Error(`${label} 未返回流式 body`);
  return res.body;
}

export type ChatPipelinePrepareResult = {
  meta: Record<string, unknown>;
  upstream: ReadableStream<Uint8Array>;
  onDone?: (fullAnswer: string) => void;
};

/**
 * 先推送 status / meta，再 pipe LLM 流。
 * prepare 内可做并行检索；通过 onStatus 向前端汇报阶段。
 */
export function buildChatPipelineStream(
  prepare: (emitStatus: (label: string) => void) => Promise<ChatPipelinePrepareResult>,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const stopKeepalive = scheduleSseKeepalive(controller);
      const emitStatus = (label: string) => {
        controller.enqueue(enc.encode(sseLine("status", { label })));
      };
      try {
        emitStatus(CHAT_STATUS.loading);
        const { meta, upstream, onDone } = await prepare(emitStatus);
        controller.enqueue(enc.encode(sseLine("meta", meta)));
        const body = transformOpenAiStreamToJfo(upstream, meta, onDone, { emitMeta: false });
        const reader = body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(enc.encode(sseLine("error", { message: msg })));
        controller.close();
      } finally {
        stopKeepalive();
      }
    },
  });
}
