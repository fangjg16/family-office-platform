type TopicEnv = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  HERMES_MODEL?: string;
};

const FILE_ONLY = /^已发送\s*\d+\s*个文件/u;

/** 无 LLM 时的侧栏主题兜底（与前端 src/lib/conversation-topic.ts 保持一致） */
export function deriveConversationTopicHeuristic(raw: string): string {
  let text = raw.trim().replace(/\s+/gu, " ");
  if (!text || FILE_ONLY.test(text)) return "文件与资料咨询";
  text = text.replace(/^请阅读刚上传[^。！？\n]*[。！？]?\s*/u, "");
  text = text.replace(/附件[：:][^\n]+/gu, "").trim();
  const sentence = (text.split(/[。！？\n]/u)[0] ?? text).trim();
  const plain = sentence.replace(/[#*_`[\]()【】]/gu, "").trim();
  if (!plain) return "新对话";
  if (plain.length <= 16) return plain;
  const cut = plain.slice(0, 16);
  const punct = cut.search(/[，、；,\s]/u);
  if (punct > 4) return cut.slice(0, punct).trim();
  return `${cut}…`;
}

function sanitizeLlmTopic(raw: string): string {
  let t = raw
    .trim()
    .replace(/^["'「『【]+|["'」』】]+$/gu, "")
    .replace(/[。！？.!?,，、；;：:]+$/u, "")
    .trim();
  if (t.length > 18) t = `${t.slice(0, 16)}…`;
  return t;
}

/** 首条用户提问 → 侧栏主题词（优先千问，失败则用启发式） */
export async function generateConversationTopic(
  env: TopicEnv,
  firstUserMessage: string,
): Promise<string> {
  const heuristic = deriveConversationTopicHeuristic(firstUserMessage);
  const key = (env.DASHSCOPE_API_KEY || "").trim();
  if (!key) return heuristic;

  const model = (env.HERMES_MODEL || "qwen-plus").trim();
  const base = (env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1")
    .trim()
    .replace(/\/$/, "");

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 32,
        messages: [
          {
            role: "system",
            content:
              "你是侧栏对话标题助手。根据用户首条提问，只输出一个高度概括的主题词（4-14个汉字，名词性短语）。禁止标点、禁止解释、禁止引号。",
          },
          {
            role: "user",
            content: firstUserMessage.trim().slice(0, 600),
          },
        ],
      }),
    });
    if (!res.ok) return heuristic;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "";
    const topic = sanitizeLlmTopic(answer);
    return topic.length >= 2 ? topic : heuristic;
  } catch {
    return heuristic;
  }
}

export function isFirstUserTurnInHistory(
  history: { role: string; content: string }[],
): boolean {
  return !history.some((m) => m.role === "user" && m.content.trim());
}
