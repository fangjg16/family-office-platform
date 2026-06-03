const FILE_ONLY = /^已发送\s*\d+\s*个文件/u;

/** 首条提问侧栏主题（即时展示；云端 meta 可能再精炼） */
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

const PLACEHOLDER_PREVIEWS = new Set([
  "尚未发送消息",
  "对话进行中",
  "对话记录",
  "基于项目资料包与对话进行分析",
]);

export function isSidebarTopicPreview(preview: string): boolean {
  const p = preview.trim();
  return p.length > 0 && !PLACEHOLDER_PREVIEWS.has(p);
}

export function topicFromFirstUserMessage(msgs: { role: string; content: string }[]): string {
  const first = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!first) return "对话记录";
  return deriveConversationTopicHeuristic(first.content);
}
