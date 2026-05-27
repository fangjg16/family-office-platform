export type ChatStreamMeta = {
  citationMap?: Record<string, string>;
  projectId?: string;
  llmBackend?: string;
};

export type ChatStreamDone = {
  answer: string;
  knowledgeNetworkHtml?: string | null;
};

/** 消费 Worker SSE（event: meta | delta | done | error） */
export async function consumeChatSse(
  response: Response,
  handlers: {
    onMeta?: (meta: ChatStreamMeta) => void;
    onStatus?: (label: string) => void;
    onDelta: (text: string) => void;
    onDone: (payload: ChatStreamDone) => void;
    onError?: (message: string) => void;
  },
): Promise<void> {
  const ctype = response.headers.get("Content-Type") ?? "";
  if (!ctype.includes("text/event-stream")) {
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err =
        payload && typeof payload === "object" && "answer" in payload
          ? String((payload as { answer?: string }).answer)
          : `HTTP ${response.status}`;
      throw new Error(err);
    }
    const answer =
      payload && typeof payload === "object" && "answer" in payload
        ? String((payload as { answer?: string }).answer ?? "")
        : "";
    handlers.onDone({
      answer,
      knowledgeNetworkHtml:
        payload && typeof payload === "object" && "knowledgeNetworkHtml" in payload
          ? ((payload as { knowledgeNetworkHtml?: string | null }).knowledgeNetworkHtml ??
            null)
          : null,
    });
    return;
  }

  if (!response.body) throw new Error("流式响应无 body");

  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (dataLines.length === 0) return;
    const raw = dataLines.join("\n");
    dataLines = [];
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (eventName === "meta") {
      handlers.onMeta?.(parsed as ChatStreamMeta);
    } else if (eventName === "status") {
      const label = typeof parsed.label === "string" ? parsed.label : "";
      if (label) handlers.onStatus?.(label);
    } else if (eventName === "delta") {
      const text = typeof parsed.text === "string" ? parsed.text : "";
      if (text) handlers.onDelta(text);
    } else if (eventName === "done") {
      handlers.onDone({
        answer: typeof parsed.answer === "string" ? parsed.answer : "",
        knowledgeNetworkHtml:
          typeof parsed.knowledgeNetworkHtml === "string"
            ? parsed.knowledgeNetworkHtml
            : null,
      });
    } else if (eventName === "error") {
      handlers.onError?.(typeof parsed.message === "string" ? parsed.message : "流式错误");
    }
    eventName = "message";
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        flushEvent();
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      } else if (line.trim() === "") {
        flushEvent();
      }
    }
  }
  flushEvent();
}
