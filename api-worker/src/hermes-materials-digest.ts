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
    "【Worker 预注入 · 项目资料包摘录（事实依据，非版式依据）】",
    "以下正文来自 Cloudflare D1/R2 已解析资料，用于填充各 section 的事实、数字、节点与时间。",
    "版式与组件：仍须以 knowledge-base-generation skill 目录中的 kb-template.html + STYLE_GUIDE 为准，勿为塞内容而手写简化 CSS 或改掉 panel-switcher。",
    "摘录中有时间/里程碑 → 时间轴用年→月→日嵌套 details；有流程/阶段 → 业务模式优先 Journey Map；有摘要要点 → 写入 .kb-summary。",
    excerpt,
  ].join("\n");
}
