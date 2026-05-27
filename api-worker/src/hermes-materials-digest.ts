import { getCitationSlots, matchCitationSlot } from "./citations";
import { loadChunks } from "./chat-data";
import { isPlaceholderChunkText, selectChunksForChat } from "./search";

/** 与深度模式一致：尽量把 package 资料包正文带给 Hermes */
const HERMES_DIGEST_MAX_CHARS = 95_000;

export async function buildHermesMaterialsDigest(
  env: { DB: D1Database },
  projectId: string,
  userId: string,
  conversationId?: string,
  userMessage?: string,
): Promise<string> {
  let allChunks: Awaited<ReturnType<typeof loadChunks>>;
  try {
    allChunks = await loadChunks(env, projectId, userId, conversationId);
  } catch {
    return "";
  }
  if (allChunks.length === 0) return "";

  const searchQuery = (userMessage ?? "").trim() || "项目尽调 资料包 商业模式 时间轴 区位 财务";
  const hits = selectChunksForChat(allChunks, searchQuery, {
    deep: true,
    maxChars: HERMES_DIGEST_MAX_CHARS,
    topK: 48,
  });
  const usable = hits.filter((h) => !isPlaceholderChunkText(h.text));
  if (usable.length === 0) return "";

  const slots = getCitationSlots(projectId);
  const excerpt = usable
    .map((h) => {
      const slot = matchCitationSlot(slots, h.filename ?? "");
      const slotHint = slot ? `[ID:${slot.id}]` : "";
      return `${slotHint} 文件：${h.filename ?? "资料"}\n${h.text}`;
    })
    .join("\n\n---\n\n");

  return [
    "",
    "【Worker 预注入 · 项目资料包摘录（与网站对话同源，务必作为生成依据）】",
    "以下正文来自 Cloudflare D1/R2 已解析资料；生成知识网络时必须引用其中的商业模式、时间轴、区位、财务等事实。",
    "禁止因篇幅原因省略 STYLE_GUIDE 组件（时间轴层级、Journey Map、kb-summary、附录 B 术语表等）。",
    excerpt,
  ].join("\n");
}
