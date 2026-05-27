function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buffer = "";
  let full = "";

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(sseLine("meta", meta)));
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
        controller.enqueue(enc.encode(sseLine("error", { message: msg })));
        controller.close();
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
