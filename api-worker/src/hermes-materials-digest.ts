import { getCitationSlots, matchCitationSlot } from "./citations";
import { loadChunks } from "./chat-data";
import { isPlaceholderChunkText, selectChunksForChat } from "./search";

/** 与深度模式一致：尽量把 package + 本对话 session 正文带给 Hermes */
const HERMES_DIGEST_MAX_CHARS = 95_000;
const HERMES_SESSION_DIGEST_MAX_CHARS = 32_000;

function formatDigestSection(
  title: string,
  hits: ReturnType<typeof selectChunksForChat>,
  slots: ReturnType<typeof getCitationSlots>,
): string {
  const usable = hits.filter((h) => !isPlaceholderChunkText(h.text));
  if (usable.length === 0) return "";
  const excerpt = usable
    .map((h) => {
      const slot = matchCitationSlot(slots, h.filename ?? "");
      const slotHint = slot ? `[ID:${slot.id}]` : "";
      return `${slotHint} 文件：${h.filename ?? "资料"}\n${h.text}`;
    })
    .join("\n\n---\n\n");
  return [`【${title}】`, excerpt].join("\n");
}

export async function buildHermesMaterialsDigest(
  env: { DB: D1Database },
  projectId: string,
  userId: string,
  conversationId?: string,
  userMessage?: string,
  prioritizeFilenames?: string[],
): Promise<string> {
  let allChunks: Awaited<ReturnType<typeof loadChunks>>;
  try {
    allChunks = await loadChunks(env, projectId, userId, conversationId);
  } catch {
    return "";
  }
  if (allChunks.length === 0) return "";

  const searchQuery = (userMessage ?? "").trim() || "项目尽调 资料包 商业模式 时间轴 区位 财务";
  const priorities = (prioritizeFilenames ?? []).filter(Boolean);
  const slots = getCitationSlots(projectId);

  const sessionChunks = allChunks.filter((c) => c.scope === "session");
  const packageChunks = allChunks.filter((c) => c.scope !== "session");

  const sessionHits = selectChunksForChat(sessionChunks, searchQuery, {
    deep: true,
    maxChars: HERMES_SESSION_DIGEST_MAX_CHARS,
    topK: 48,
    prioritizeFilenames: priorities,
  });
  const packageHits = selectChunksForChat(packageChunks, searchQuery, {
    deep: true,
    maxChars: HERMES_DIGEST_MAX_CHARS,
    topK: 48,
    prioritizeFilenames: priorities,
  });

  const sessionBlock = formatDigestSection("本对话上传附件摘录", sessionHits, slots);
  const packageBlock = formatDigestSection("项目资料包摘录", packageHits, slots);

  if (!sessionBlock && !packageBlock) return "";

  const parts = [
    "",
    "【Worker 预注入 · 项目资料摘录（事实依据，非版式依据）】",
    "以下正文来自 Cloudflare D1/R2 已解析资料。",
    "「本对话上传附件」优先于「项目资料包」；若用户刚上传文件，必须纳入分析，勿仅列 package manifest。",
    "版式与组件：仍须以 knowledge-base-generation skill 目录中的 kb-template.html + STYLE_GUIDE 为准。",
  ];
  if (sessionBlock) parts.push("", sessionBlock);
  if (packageBlock) parts.push("", packageBlock);
  return parts.join("\n");
}
