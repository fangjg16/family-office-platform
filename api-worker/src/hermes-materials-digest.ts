import type { SkillIntent } from "./chat-modes";
import { getCitationSlots, matchCitationSlot } from "./citations";
import { loadChunks } from "./chat-data";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";
import { isPlaceholderChunkText, selectChunksForChat } from "./search";

type DigestIntensity = "none" | "light" | "moderate" | "session_priority" | "full";

const INTENSITY_LIMITS: Record<
  Exclude<DigestIntensity, "none">,
  { packageMax: number; sessionMax: number; topK: number }
> = {
  light: { packageMax: 24_000, sessionMax: 16_000, topK: 20 },
  moderate: { packageMax: 36_000, sessionMax: 22_000, topK: 24 },
  session_priority: { packageMax: 42_000, sessionMax: 28_000, topK: 28 },
  full: { packageMax: 58_000, sessionMax: 28_000, topK: 36 },
};

export function resolveMaterialsDigestIntensity(
  intent: SkillIntent,
  knMode?: KnowledgeNetworkUpdateMode,
): DigestIntensity {
  if (intent === "standard") return "none";
  if (intent === "knowledge_network") {
    if (knMode === "reorder") return "none";
    if (knMode === "incremental") return "session_priority";
    if (knMode === "full") return "full";
    if (knMode === "initial") return "moderate";
    return "moderate";
  }
  if (intent === "ic_memo") return "light";
  if (intent === "project_intake") return "full";
  if (intent === "public_info_search") return "light";
  if (
    intent === "dd_checklist" ||
    intent === "dd_claim_audit" ||
    intent === "risk_matrix" ||
    intent === "returns_analysis" ||
    intent === "sensitivity_analysis" ||
    intent === "value_creation_plan" ||
    intent === "comp_analysis" ||
    intent === "background_check"
  ) {
    return "session_priority";
  }
  return "session_priority";
}

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

/**
 * Worker 侧「资料摘录」预注入：按任务强度节选，非机械全文。
 * Hermes 仍应通过 jfo-r2-materials 先 manifest、再按需 textUrl。
 */
export async function buildHermesMaterialsDigest(
  env: { DB: D1Database },
  projectId: string,
  userId: string,
  conversationId?: string,
  userMessage?: string,
  prioritizeFilenames?: string[],
  intent: SkillIntent = "project_intake",
  knMode?: KnowledgeNetworkUpdateMode,
): Promise<string> {
  const intensity = resolveMaterialsDigestIntensity(intent, knMode);
  if (intensity === "none") return "";

  let allChunks: Awaited<ReturnType<typeof loadChunks>>;
  try {
    allChunks = await loadChunks(env, projectId, userId, conversationId);
  } catch {
    return "";
  }
  if (allChunks.length === 0) return "";

  const limits = INTENSITY_LIMITS[intensity];
  const searchQuery = (userMessage ?? "").trim() || "项目尽调 资料包 商业模式 时间轴 区位 财务";
  const priorities = (prioritizeFilenames ?? []).filter(Boolean);
  const slots = getCitationSlots(projectId);

  const sessionChunks = allChunks.filter((c) => c.scope === "session");
  const packageChunks = allChunks.filter((c) => c.scope !== "session");

  const sessionHits = selectChunksForChat(sessionChunks, searchQuery, {
    deep: intensity === "full",
    maxChars: limits.sessionMax,
    topK: limits.topK,
    prioritizeFilenames: priorities,
  });

  const packageHits =
    intensity === "light" && sessionHits.length > 0
      ? []
      : selectChunksForChat(packageChunks, searchQuery, {
          deep: intensity === "full",
          maxChars: limits.packageMax,
          topK: limits.topK,
          prioritizeFilenames: priorities,
        });

  const sessionBlock = formatDigestSection("本对话上传附件摘录", sessionHits, slots);
  const packageBlock = formatDigestSection("项目资料包摘录", packageHits, slots);

  if (!sessionBlock && !packageBlock) return "";

  const intensityNote =
    intensity === "light"
      ? "本预注入为轻量节选（优先对话附件）；缺事实时请 manifest 后按需 GET 相关 textUrl，勿无差别拉全文。"
      : intensity === "moderate"
        ? "本预注入为首次 KB 核心节选（非全文）；manifest 后仅对缺口文件 GET textUrl。"
        : intensity === "session_priority"
          ? "本预注入为任务相关节选；完整 manifest 仍须确认，正文按任务按需拉取。"
          : "本预注入为主要资料节选（全量重做）；仍须 manifest 确认清单，勿机械拉取每个 textUrl。";

  const parts = [
    "",
    "【Worker 预注入 · 项目资料摘录（事实依据，非版式依据）】",
    intensityNote,
    "「本对话上传附件」优先于「项目资料包」；若用户刚上传文件，必须纳入分析。",
    "版式以 assets/kb-template.html 为准；勿为生成 KB 读取 style-guide / components 全文。",
  ];
  if (sessionBlock) parts.push("", sessionBlock);
  if (packageBlock) parts.push("", packageBlock);
  return parts.join("\n");
}
