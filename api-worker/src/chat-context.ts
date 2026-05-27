import {
  buildCitationSystemLines,
  citationMapFromSlots,
  getCitationSlots,
  matchCitationSlot,
} from "./citations";
import { loadChunks } from "./chat-data";
import { buildLlmMessages, getConversationMemorySummary, splitHistoryForMemory } from "./chat-memory";
import {
  shouldForceExternalSearch,
  skillIntentSystemLines,
  websitePlatformIdentityLines,
  type SkillIntent,
} from "./chat-modes";
import { tavilyCapabilitySystemLines } from "./tavily-search";
import {
  isGenericProjectQuestion,
  isPlaceholderChunkText,
  selectChunksForChatWithVectors,
  type ChunkRow,
} from "./search";
import { getQueryEmbeddingCached } from "./query-embedding-cache";
import type { EmbedEnv } from "./embeddings";
import { buildTavilyQuery, formatTavilyBlock, searchTavily, wantsExternalSearch } from "./tavily-search";

const FILE_ONLY_USER_PROMPT =
  /已发送\s*\d+\s*个文件|请基于资料继续|请阅读刚上传/u;

const DEEP_EXCERPT_MAX_CHARS = 95_000;
const OVERVIEW_EXCERPT_MAX_CHARS = 36_000;

export const CHAT_STATUS = {
  loading: "正在加载项目资料…",
  retrieving: "正在检索相关片段…",
  external: "正在联网搜索公开资料…",
  generating: "正在生成回答…",
} as const;

export type ChatContextEnv = EmbedEnv & {
  DB: D1Database;
  TAVILY_API_KEY?: string;
};

export type PrepareChatContextParams = {
  env: ChatContextEnv;
  projectId: string;
  userId: string;
  conversationId?: string;
  message: string;
  files?: string[];
  history: { role: string; content: string }[];
  chatMode: SkillIntent;
  deepMode: boolean;
  overviewQuestion: boolean;
  injectPackageCorpus: boolean;
  dbProjectSummary: string;
  projectTitleHint: string;
  hermesConfigured: boolean;
  tavilyConfigured: boolean;
  onStatus?: (label: string) => void;
};

export type PrepareChatContextResult = {
  messages: { role: string; content: string }[];
  streamMeta: Record<string, unknown>;
  usedExternalSearch: boolean;
  hadPackageChunks: boolean;
};

function buildExcerptFromHits(
  hits: ChunkRow[],
  slots: ReturnType<typeof getCitationSlots>,
  usedSlotIds: Set<string>,
  dbProjectSummary: string,
): string {
  if (hits.length === 0) {
    return dbProjectSummary
      ? `${dbProjectSummary}（资料包暂无可用正文摘录；请结合上方项目登记信息作答，并说明需用户补充材料处。）`
      : "（未检索到资料摘录；请明确说明依据不足，勿编造。）";
  }

  const onlyPlaceholders = hits.every((h) => isPlaceholderChunkText(h.text));
  if (onlyPlaceholders) {
    return "（资料文件已上传，但正文未解析成功，多为扫描版 PDF。请改传可复制文字的 PDF 或 .txt/.md，或重新上传后重试。）";
  }

  let excerptBlock = hits
    .map((h) => {
      const slot = matchCitationSlot(slots, h.filename ?? "");
      if (slot) usedSlotIds.add(slot.id);
      const slotHint = slot ? `[ID:${slot.id}]` : "";
      return `${slotHint} 文件：${h.filename ?? "资料"}\n${h.text}`;
    })
    .join("\n\n---\n\n");

  if (dbProjectSummary && !excerptBlock.startsWith("【项目登记")) {
    excerptBlock = `${dbProjectSummary}${excerptBlock}`;
  }
  return excerptBlock;
}

export async function prepareStandardChatContext(
  params: PrepareChatContextParams,
): Promise<PrepareChatContextResult> {
  const {
    env,
    projectId,
    userId,
    message,
    history,
    chatMode,
    deepMode,
    overviewQuestion,
    injectPackageCorpus,
    dbProjectSummary,
    projectTitleHint,
    hermesConfigured,
    tavilyConfigured,
    onStatus,
  } = params;

  const conversationKey = (params.conversationId ?? "").trim();
  const slots = getCitationSlots(projectId);
  const citationMap = citationMapFromSlots(slots);
  const usedSlotIds = new Set<string>();

  const fileHint = (params.files ?? []).join(" ");
  const searchQuery = fileHint ? `${message} ${fileHint}` : message;
  const needsExternal = wantsExternalSearch(message) || shouldForceExternalSearch(chatMode);
  const willUseVectors =
    !injectPackageCorpus && Boolean((env.DASHSCOPE_API_KEY || "").trim());

  onStatus?.(CHAT_STATUS.loading);

  const tavilyKey = (env.TAVILY_API_KEY || "").trim();
  const historyForQuery = history.filter((m) => m.role === "user" || m.role === "assistant");

  const [allChunks, memorySummary, queryEmbedding, externalResult] = await Promise.all([
    loadChunks(env, projectId, userId, params.conversationId),
    getConversationMemorySummary(env, userId, conversationKey),
    willUseVectors
      ? getQueryEmbeddingCached(env, projectId, searchQuery)
      : Promise.resolve(null as number[] | null),
    needsExternal
      ? (async () => {
          onStatus?.(CHAT_STATUS.external);
          if (!tavilyKey) {
            return {
              used: true,
              block: formatTavilyBlock(
                [],
                "未配置 TAVILY_API_KEY（请在 Worker 执行 wrangler secret put TAVILY_API_KEY）",
              ),
            };
          }
          const tavilyQuery = buildTavilyQuery(message, fileHint, historyForQuery);
          const { hits, error } = await searchTavily(tavilyKey, tavilyQuery);
          return { used: true, block: formatTavilyBlock(hits, error) };
        })()
      : Promise.resolve({ used: false, block: "" }),
  ]);

  const hadPackageChunks = allChunks.length > 0;
  onStatus?.(CHAT_STATUS.retrieving);

  const selectOptions = {
    deep: injectPackageCorpus,
    maxChars: injectPackageCorpus
      ? overviewQuestion && !deepMode
        ? OVERVIEW_EXCERPT_MAX_CHARS
        : DEEP_EXCERPT_MAX_CHARS
      : 8_000,
    topK: overviewQuestion ? 24 : 5,
  };

  let hits = await selectChunksForChatWithVectors(
    env,
    allChunks,
    searchQuery,
    selectOptions,
    queryEmbedding,
  );

  if (
    hits.length === 0 &&
    allChunks.length > 0 &&
    (FILE_ONLY_USER_PROMPT.test(message) || overviewQuestion)
  ) {
    hits = await selectChunksForChatWithVectors(
      env,
      allChunks,
      searchQuery,
      { deep: true, maxChars: OVERVIEW_EXCERPT_MAX_CHARS, topK: 24 },
      queryEmbedding,
    );
  }

  let excerptBlock = buildExcerptFromHits(hits, slots, usedSlotIds, dbProjectSummary);
  if (hits.length === 0 && dbProjectSummary && !excerptBlock.startsWith("【项目登记")) {
    excerptBlock = dbProjectSummary;
  }

  const usedExternalSearch = externalResult.used;
  const externalBlock = externalResult.block;

  const activeSlots =
    usedSlotIds.size > 0 ? slots.filter((s) => usedSlotIds.has(s.id)) : slots;
  const citationLines = buildCitationSystemLines(activeSlots);
  const { recent } = splitHistoryForMemory(history);

  const systemParts = [
    ...websitePlatformIdentityLines(),
    "你是联合家办平台项目助手，服务机会型投资尽调场景。回答须综合三类依据：（1）【资料摘录】中的项目内事实；（2）若有【外部检索】则纳入公开网页信息；（3）为衔接上下文的行业/流程推论——须标明「推论」或「待核实」，不得冒充已核实事实。",
    "你不是「只能读上传 PDF」的机器人：项目内问题以摘录为主；公开信息、政策、市场动态在触发联网或摘录不足时，应结合外部检索或明确说明缺口与下一步（如建议用户说「查外部资料：…」）。",
    "用户可能使用项目简称（如「南宁生鲜港」「南宁生鲜智慧港」）；与摘录中「南宁东盟生鲜食品智慧港」等明显同一项目时，应正常作答，勿因简称不同而拒绝。",
    ...(overviewQuestion || hadPackageChunks
      ? [
          "若【资料摘录】或【项目登记信息】中已有本项目资料包内容，必须基于其介绍项目背景与要点；禁止声称「没有看到任何项目资料」。",
        ]
      : []),
    "引用规范：上传资料用 [ID:n]（仅可引用摘录中实际出现且下列存在的编号）；网页用 [WEB:n] 并附 URL；勿混用。",
    ...(chatMode === "standard"
      ? [
          hermesConfigured
            ? "轻问快答：主要依据下方【资料摘录】与对话上下文作答；若用户明确提出尽调清单、知识网络、IC 备忘录等深度交付，说明将转入后台深度分析（勿自称无法完成）。"
            : "若用户需要全面分析、尽调清单、风险矩阵、回报测算、知识网络或 IC 备忘录，在本对话直接说明即可；平台会注入更完整资料摘录并输出结构化结果。",
        ]
      : skillIntentSystemLines(chatMode, projectTitleHint)),
    ...tavilyCapabilitySystemLines(tavilyConfigured),
    "可用引用编号与文献名：",
    citationLines,
    "",
    "【资料摘录】",
    excerptBlock,
  ];

  if (usedExternalSearch) {
    systemParts.push(
      "",
      "【外部检索（Tavily）】",
      externalBlock,
      "",
      "【本轮指令】用户需要公开信息。以【外部检索】为主、与【资料摘录】交叉验证：一致处可加强信心，冲突处分别列出并建议待核项；勿否认本轮已具备的联网结果。",
    );
  }

  const messages = buildLlmMessages({
    systemParts,
    memorySummary,
    recentHistory: recent,
    userMessage: message,
  });

  return {
    messages,
    streamMeta: {
      citationMap,
      projectId,
      externalSearch: usedExternalSearch,
      chatMode,
      skillIntent: chatMode,
    },
    usedExternalSearch,
    hadPackageChunks,
  };
}

export { isGenericProjectQuestion } from "./search";
