import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileUp,
  FileText,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ChatMarkdown } from "@/components/workspace/ChatMarkdown";
import { TypingLoader } from "@/components/ui/loader";
import {
  KnowledgeNetworkPreview,
  prepareKnowledgeNetworkMessageDisplay,
} from "@/components/workspace/KnowledgeNetworkPreview";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { cn } from "@/lib/utils";
import {
  AI_CHAT_ENDPOINT,
  dedupeFilesByFilename,
  deleteProjectFile,
  ENABLE_LIVE_CHAT,
  fetchProjectByIdFromApi,
  fetchProjectFiles,
  filterConversationSessionFiles,
  type ProjectFileRecord,
} from "@/lib/project-api";
import type { KnowledgeNetworkChatEntryState } from "@/lib/knowledge-network-prompts";
import { upsertApiProject } from "@/workspace/project-registry";
import { CHAT_QUICK_PROMPTS } from "@/lib/chat-quick-prompts";
import { consumeChatSse } from "@/lib/chat-stream-client";
import {
  deriveConversationTopicHeuristic,
  isSidebarTopicPreview,
  topicFromFirstUserMessage,
} from "@/lib/conversation-topic";
import { isDeepSkillMessage, streamingAssistantDisplayText } from "@/lib/chat-intent";
import type { LiveChatMessage } from "@/workspace/chat-types";
import {
  loadChatStateForUser,
  persistChatStateForUser,
  type ChatPersistOptions,
} from "@/workspace/chat-persistence";
import {
  getProjectResourceDemo,
  type ProjectChatSnippet,
} from "@/workspace/project-resource-demos";
import {
  getMergedProjects,
  getProjectById,
  subscribeApiProjects,
} from "@/workspace/project-registry";
import {
  conversationRoutePath,
  inferProjectIdFromConversationId as inferProjectIdFromConvId,
  pickConversationIdForProject,
} from "@/workspace/chat-conversation-id";
import {
  appendMessageWithSortIndex,
  sortMessagesByConversation,
  sortMessagesChronologically,
} from "@/workspace/chat-message-order";
import {
  formatBubbleTimeLabel,
  formatSidebarDateLabel,
  latestMessageTimeLabel,
} from "@/workspace/chat-time";
import { ALL_PROJECTS } from "@/workspace/projects";
import {
  loadSessionUserId,
  saveLastChatProjectId,
} from "@/workspace/session";
import type { WorkspaceRole } from "@/workspace/types";
import {
  getProjectRole,
  getUserById,
  workspaceRoleToUiTier,
  type UiTier,
} from "@/workspace/workspace-users";
import type { WorkspaceUser } from "@/workspace/types";

type SessionConversation = {
  id: string;
  projectId: string;
  title: string;
  preview: string;
  updatedAt: string;
  files: string[];
  /** 演示剧本对话；blank 为空白新对话 */
  variant?: "demo" | "blank";
};

type SessionConversationState = {
  conversations: SessionConversation[];
  messagesByConversation: Record<string, LiveChatMessage[]>;
};

function conversationHasMessages(
  c: SessionConversation,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): boolean {
  const msgs = messagesByConversation[c.id];
  return Array.isArray(msgs) && msgs.length > 0;
}

function pruneEmptyLiveConversations(
  convs: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
): SessionConversation[] {
  return convs.filter(
    (c) =>
      c.variant === "blank" || conversationHasMessages(c, messagesByConversation),
  );
}

/** 输入框：单行起，随内容增高，超过上限后框内滚动 */
const CHAT_INPUT_MIN_PX = 48;
/** 约 3 行正文 + 内边距，再高则框内滚动 */
const CHAT_INPUT_MAX_PX = 88;

function resizeChatComposer(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const next = Math.min(Math.max(el.scrollHeight, CHAT_INPUT_MIN_PX), CHAT_INPUT_MAX_PX);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > CHAT_INPUT_MAX_PX ? "auto" : "hidden";
}

function buildBlankSessionConversation(
  projectId: string,
  conversationId: string,
  projectName: string,
): SessionConversation {
  return {
    id: conversationId,
    projectId,
    title: `${projectName} · 全局分析`,
    preview: "尚未发送消息",
    updatedAt: getCurrentDateTimeLabel(),
    files: [],
    variant: "blank",
  };
}

function inferProjectIdFromConversationId(
  conversationId: string,
  known: SessionConversation[],
): string | null {
  const hit = known.find((c) => c.id === conversationId);
  if (hit) return hit.projectId;
  const inferred = inferProjectIdFromConvId(conversationId);
  if (inferred) return inferred;
  for (const project of getMergedProjects()) {
    if (conversationId === project.id || conversationId.startsWith(`${project.id}-`)) {
      return project.id;
    }
  }
  return null;
}

/** 用该会话最后一条消息的时间修正侧栏；预览仅首条用户提问主题，不跟随后续消息 */
function applyConversationMetadataFromMessages(
  convs: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
): SessionConversation[] {
  return convs.map((c) => {
    const msgs = messagesByConversation[c.id];
    if (!msgs?.length) return c;
    const lastTime = latestMessageTimeLabel(msgs);
    const topicPreview = topicFromFirstUserMessage(msgs);
    const looksLikeTopic =
      isSidebarTopicPreview(c.preview) && c.preview.trim().length <= 20;
    return {
      ...c,
      preview: looksLikeTopic ? c.preview : topicPreview,
      updatedAt: lastTime || c.updatedAt,
    };
  });
}

/** 云端有消息但会话元数据缺失时，从 message 键恢复侧栏项（避免同步时被误删） */
function reconcileConversationsWithMessages(
  convs: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
): SessionConversation[] {
  const byId = new Map(convs.map((c) => [c.id, c]));
  for (const [conversationId, msgs] of Object.entries(messagesByConversation)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    if (byId.has(conversationId)) continue;
    const projectId = inferProjectIdFromConversationId(conversationId, convs);
    if (!projectId) continue;
    const built = buildConversationFromProject(projectId);
    if (!built) continue;
    byId.set(conversationId, {
      ...built,
      id: conversationId,
      preview: topicFromFirstUserMessage(msgs),
      updatedAt: latestMessageTimeLabel(msgs) || getCurrentDateTimeLabel(),
      variant: "blank",
    });
  }
  return applyConversationMetadataFromMessages(
    Array.from(byId.values()),
    messagesByConversation,
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 去掉历史预填侧栏项；有真实消息的预填项一律保留 */
function stripLegacySidebarPrefill(
  convs: SessionConversation[],
  currentProjectId: string,
  messagesByConversation: Record<string, LiveChatMessage[]>,
): SessionConversation[] {
  return convs.filter((c) => {
    if (!LEGACY_SIDEBAR_PREFILL_PROJECT_IDS.has(c.projectId)) return true;
    if (c.id !== `${c.projectId}-main`) return true;
    if (conversationHasMessages(c, messagesByConversation)) return true;
    return c.projectId === currentProjectId;
  });
}

function mergeConversationsForBootstrap(
  base: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
  isLiveAiMode: boolean,
  focusProjectId?: string,
): SessionConversation[] {
  const cleaned = focusProjectId
    ? stripLegacySidebarPrefill(base, focusProjectId, messagesByConversation)
    : base;
  const reconciled = reconcileConversationsWithMessages(cleaned, messagesByConversation);
  const withTimes = applyConversationMetadataFromMessages(reconciled, messagesByConversation);
  if (isLiveAiMode) {
    return withTimes;
  }
  if (!focusProjectId) return withTimes;
  const currentConversation = buildConversationFromProject(focusProjectId);
  if (!currentConversation) return withTimes;
  const hasCurrent = withTimes.some((item) => item.projectId === focusProjectId);
  if (hasCurrent) return withTimes;
  return [withCurrentPreviewTime(currentConversation), ...withTimes];
}

function projectDisplayName(projectId: string): string {
  return getProjectById(projectId)?.name ?? (projectId.startsWith("proj-") ? "云端项目" : projectId);
}

function conversationSidebarRows(
  convs: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
  isLiveAiMode: boolean,
): SessionConversation[] {
  const list = isLiveAiMode
    ? pruneEmptyLiveConversations(convs, messagesByConversation)
    : convs;
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

type SidebarProjectGroup = {
  projectId: string;
  projectName: string;
  latestAt: string;
  conversations: SessionConversation[];
};

function groupSidebarByProject(
  convs: SessionConversation[],
  messagesByConversation: Record<string, LiveChatMessage[]>,
  isLiveAiMode: boolean,
): SidebarProjectGroup[] {
  const rows = conversationSidebarRows(convs, messagesByConversation, isLiveAiMode);
  const byProject = new Map<string, SessionConversation[]>();
  for (const c of rows) {
    const list = byProject.get(c.projectId) ?? [];
    list.push(c);
    byProject.set(c.projectId, list);
  }
  const groups: SidebarProjectGroup[] = [];
  for (const [pid, list] of byProject) {
    const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    groups.push({
      projectId: pid,
      projectName: projectDisplayName(pid),
      latestAt: sorted[0]?.updatedAt ?? "",
      conversations: sorted,
    });
  }
  groups.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  return groups;
}

const EMPTY_LIVE_CHAT_MESSAGES: LiveChatMessage[] = [];

const CHAT_ENTRY_TRANSITION_KEY = "workspace-chat-entry-transition";
const RAGFLOW_API_KEY =
  (import.meta.env.VITE_RAGFLOW_API_KEY as string | undefined)?.trim() ?? "";
const RAGFLOW_MODE =
  ((import.meta.env.VITE_RAGFLOW_MODE as string | undefined)?.trim().toLowerCase() ??
    "proxy") as "native" | "openai" | "proxy";

/** 录制演示：空格填入下一条预设问题，发送后「思考中」再展示预设回复（时长随文案长度略增） */
type DemoAssistantPiece =
  | { type: "admin_intro" }
  | { type: "resource_table" }
  | { type: "supply_prompt"; body: string }
  | { type: "supply_body"; body: string }
  | { type: "credibility_mid"; summaryLines?: string[] }
  | { type: "credibility_single"; tier: UiTier }
  | { type: "mid_refusal"; body: string }
  | { type: "mid_text"; title?: string; body: string }
  | { type: "ranking" };

type DemoPlaybackTimelineMsg =
  | {
      id: string;
      kind: "user";
      text: string;
      files?: readonly { name: string }[];
      time?: string;
    }
  | {
      id: string;
      kind: "assistant";
      piece: DemoAssistantPiece;
      time?: string;
    };

function demoThinkingDelayMs(userLine: string): number {
  const base = 1600;
  const perChar = 28;
  const cap = 3400;
  return Math.min(cap, base + userLine.length * perChar);
}

function buildDemoPlaybackRoundSpecs(
  projectName: string,
  tier: UiTier,
  workspaceRole: WorkspaceRole,
  chat: ProjectChatSnippet,
): Array<{
  userLine: string;
  files?: readonly { name: string }[];
  assistantPieces: DemoAssistantPiece[];
}> {
  const rounds: Array<{
    userLine: string;
    files?: readonly { name: string }[];
    assistantPieces: DemoAssistantPiece[];
  }> = [];

  const tablePieces: DemoAssistantPiece[] = [];
  if (workspaceRole === "admin") {
    tablePieces.push({ type: "admin_intro" });
  }
  tablePieces.push({ type: "resource_table" });

  rounds.push({
    userLine: `请概述「${projectName}」目前的资源配置全貌`,
    assistantPieces: tablePieces,
  });

  if (tier === "full" && chat.supplyExchanges && chat.supplyExchanges.length > 0) {
    for (const ex of chat.supplyExchanges) {
      if (ex.confirmation) {
        rounds.push({
          userLine: ex.userLine,
          files: ex.attachments,
          assistantPieces: [{ type: "supply_prompt", body: ex.confirmation.agentPrompt }],
        });
        rounds.push({
          userLine: ex.confirmation.userConfirmLine,
          assistantPieces: [{ type: "supply_body", body: ex.aiBody }],
        });
      } else {
        rounds.push({
          userLine: ex.userLine,
          files: ex.attachments,
          assistantPieces: [{ type: "supply_body", body: ex.aiBody }],
        });
      }
    }
  } else if (tier === "mid" && chat.midFollowUp && chat.midFollowUp.length > 0) {
    for (const step of chat.midFollowUp) {
      const pieces: DemoAssistantPiece[] = [];
      if (step.kind === "credibility") {
        pieces.push({
          type: "credibility_mid",
          summaryLines:
            step.summaryLines && step.summaryLines.length > 0
              ? [...step.summaryLines]
              : undefined,
        });
      } else if (step.kind === "refusal") {
        pieces.push({ type: "mid_refusal", body: step.body });
      } else {
        pieces.push({ type: "mid_text", title: step.title, body: step.body });
      }
      rounds.push({
        userLine: step.userLine,
        files: step.kind === "text" ? step.attachments : undefined,
        assistantPieces: pieces,
      });
    }
  } else {
    const credibilityLine =
      tier === "low"
        ? chat.credibilityUserLineLow
        : tier === "mid"
          ? chat.credibilityUserLineMid
          : chat.credibilityUserLine;
    rounds.push({
      userLine: credibilityLine,
      assistantPieces: [{ type: "credibility_single", tier }],
    });
  }

  rounds.push({
    userLine: "推荐最佳合作方案",
    assistantPieces: [{ type: "ranking" }],
  });

  return rounds;
}

function PlaybackAssistantRenderer({
  piece,
  tier,
  workspaceRole,
  projectId,
  projectName,
  chat,
  time,
}: {
  piece: DemoAssistantPiece;
  tier: UiTier;
  workspaceRole: WorkspaceRole;
  projectId: string;
  projectName: string;
  chat: ProjectChatSnippet;
  time?: string;
}) {
  switch (piece.type) {
    case "admin_intro":
      return (
        <AiShell time={time}>
          <p className="text-sm font-semibold text-primary">Admin 控制台</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            您可调整各维度评分权重。示例：供应链因素占比{" "}
            <span className="font-mono text-foreground">20% → 25%</span>{" "}
            已写入当前项目草稿；Core 用户可在本项目中维护本家族数据。
          </p>
        </AiShell>
      );
    case "resource_table":
      return (
        <ResourceTableBlock
          tier={tier}
          workspaceRole={workspaceRole}
          projectId={projectId}
          projectName={projectName}
          time={time}
        />
      );
    case "supply_prompt":
      return (
        <AiShell time={time}>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {piece.body}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">● Master Agent · 待您确认</p>
        </AiShell>
      );
    case "supply_body":
      return (
        <AiShell time={time}>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {piece.body}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">
            ● Master Agent · 已入库 · 与本项目智库字段联动
          </p>
        </AiShell>
      );
    case "credibility_mid":
      return (
        <CredibilityBlock
          tier="mid"
          chat={chat}
          midSummaryLines={piece.summaryLines}
          time={time}
        />
      );
    case "credibility_single":
      return <CredibilityBlock tier={piece.tier} chat={chat} time={time} />;
    case "mid_refusal":
      return <MidRefusalBlock body={piece.body} time={time} />;
    case "mid_text":
      return <MidTextBlock title={piece.title} body={piece.body} time={time} />;
    case "ranking":
      return <RankingBlock tier={tier} chat={chat} time={time} />;
    default:
      return null;
  }
}

function apiBaseFromChatEndpoint(chatEndpoint: string): string {
  const trimmed = chatEndpoint.trim().replace(/\/+$/u, "");
  if (trimmed.endsWith("/api/chat")) {
    return trimmed.replace(/\/api\/chat$/u, "");
  }
  if (trimmed.endsWith("/api/ragflow/chat")) {
    return trimmed.replace(/\/api\/ragflow\/chat$/u, "");
  }
  return trimmed;
}

function buildApiHealthProbeUrl(chatEndpoint: string): string | null {
  const trimmed = chatEndpoint.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/+$/u, "");
    if (path.endsWith("/api/chat")) {
      u.pathname = path.replace(/\/api\/chat$/u, "/api/health");
      return u.toString();
    }
    if (path.endsWith("/api/ragflow/chat")) {
      u.pathname = path.replace(/\/api\/ragflow\/chat$/u, "/api/ragflow/health");
      return u.toString();
    }
  } catch {
    return null;
  }
  return null;
}

const AGENT_JOB_POLL_MS = 3000;
/** 深度任务最长轮询约 12 分钟（与 Worker waitForHermesRun 10 分钟 + 缓冲对齐） */
const AGENT_JOB_MAX_POLLS = 240;
/** 合并连续编辑后再 PUT；发消息/任务完成会立即 flush */
const CHAT_PERSIST_DEBOUNCE_MS = 300;

type AgentJobPollPayload = {
  status?: string;
  answer?: string | null;
  knowledgeNetworkHtml?: string | null;
  projectKnowledgeNetworkVersion?: number;
  error?: string | null;
  progressLabel?: string;
  hermesStatus?: string | null;
  elapsedSec?: number;
  deepPath?: string | null;
};

async function pollAgentJobUntilDone(params: {
  apiBase: string;
  userId: string;
  jobId: string;
  conversationKey: string;
  assistantMsgId: string;
  citationMap: Record<string, string>;
  onUpdate: (
    conversationKey: string,
    messageId: string,
    patch: Partial<LiveChatMessage>,
  ) => void;
  onError: (msg: string) => void;
  onPersist?: () => void;
}): Promise<void> {
  const {
    apiBase,
    userId,
    jobId,
    conversationKey,
    assistantMsgId,
    citationMap,
    onUpdate,
    onError,
    onPersist,
  } = params;
  const root = apiBase.replace(/\/+$/u, "");
  for (let i = 0; i < AGENT_JOB_MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, AGENT_JOB_POLL_MS));
    try {
      const url = `${root}/api/agent-jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      const data = (await res.json().catch(() => ({}))) as AgentJobPollPayload;
      if (!res.ok) continue;
      if (data.status === "running" || data.status === "pending") {
        const label =
          typeof data.progressLabel === "string" && data.progressLabel.trim()
            ? data.progressLabel.trim()
            : "深度分析进行中…";
        onUpdate(conversationKey, assistantMsgId, { jobProgressLabel: label });
      }
      if (data.status === "completed") {
        const raw = String(data.answer ?? "").trim() || "（任务已完成，但未返回正文。）";
        const answer = formatCitationMarkers(raw, citationMap);
        const knFromApi =
          typeof data.knowledgeNetworkHtml === "string"
            ? data.knowledgeNetworkHtml.trim()
            : "";
        const prepared = prepareKnowledgeNetworkMessageDisplay(answer, knFromApi || null);
        const knVersion =
          typeof data.projectKnowledgeNetworkVersion === "number"
            ? data.projectKnowledgeNetworkVersion
            : undefined;
        onUpdate(conversationKey, assistantMsgId, {
          content: prepared.displayContent,
          knowledgeNetworkHtml: prepared.html || undefined,
          projectKnowledgeNetworkVersion: knVersion,
          pendingJobId: undefined,
          jobProgressLabel: undefined,
        });
        onPersist?.();
        return;
      }
      if (data.status === "failed") {
        const errText = String(data.error ?? "未知错误");
        onUpdate(conversationKey, assistantMsgId, {
          content: `深度分析未完成：${errText}`,
          pendingJobId: undefined,
          jobProgressLabel: undefined,
        });
        onError(errText);
        onPersist?.();
        return;
      }
    } catch {
      /* 单轮轮询失败则继续 */
    }
  }
  onUpdate(conversationKey, assistantMsgId, {
    content:
      "本轮页面轮询已结束，任务可能仍在后台运行。刷新本页会自动继续等待结果；若久无结果可重试一次。",
    jobProgressLabel: "等待刷新后继续轮询…",
  });
}

function ragflowChatLooksLikeDirectService(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.port === "9380") return true;
    return /ragflow/i.test(u.hostname);
  } catch {
    return false;
  }
}

const STREAM_TRUNCATED_FOOTER =
  "\n\n---\n\n*（生成过程中连接中断，以上为已返回内容。可缩短问题后重试，或刷新页面再发。）*";

function isStreamDisconnectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network connection lost") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("aborted")
  );
}

function formatRagflowRequestError(message: string, endpoint: string): string {
  const base = `请求失败：${message}`;
  if (!message.toLowerCase().includes("failed to fetch")) return base;
  const ep = endpoint.trim();
  const extra: string[] = [];
  if (ep) {
    extra.push(`当前接口：${ep}`);
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:" && ep.startsWith("http:")) {
    extra.push("页面为 HTTPS，而接口为 HTTP，浏览器会拦截混合内容。请改用 https 代理，或本地用 http 访问前端。");
  }
  if (ep && ragflowChatLooksLikeDirectService(ep)) {
    extra.push(
      "浏览器通常无法直接访问 RAGFlow（跨域/CORS）。请在 `family-office-platform/proxy/` 启动本地代理，并在 `.env.local` 中将 `VITE_RAGFLOW_CHAT_ENDPOINT` 指向 `http://localhost:8787/api/ragflow/chat`，然后重启 `npm run dev`。",
    );
  } else if (ep.includes("8787") || ep.includes("/api/ragflow/chat")) {
    extra.push(
      "请确认已在本机运行代理：`cd family-office-platform/proxy` → `npm install` → `npm run dev`，并在浏览器打开 `http://localhost:8787/api/ragflow/health` 应返回 JSON。随后重启前端开发服务器以加载 `.env.local`。",
    );
  } else {
    extra.push("请确认该地址在本机可访问、未被防火墙拦截，且与前端同源策略不冲突。");
  }
  return [base, ...extra].join(" ");
}

/**
 * 仅保留在当前网页会话内（内存）：
 * - 不刷新页面时，项目间切换可保留左侧操作
 * - 刷新页面后自动清空
 */
const SESSION_CONVERSATION_CACHE: Record<string, SessionConversationState> = {};
/** 部署前为撑开侧栏预填的两个种子项目；产品期不再默认展示 */
const LEGACY_SIDEBAR_PREFILL_PROJECT_IDS = new Set(["europe-hotel-ma", "shrimp"]);
const NANNING_CITATION_MAP: Record<string, string> = {
  "1": "《南宁生鲜食品智慧港项目介绍.pdf》",
  "2": "《尽调报告二 南宁东盟生鲜食品智慧港.pdf》",
  "3": "《尽调报告一 嘉兴中润海盐冷链产业园区.pdf》",
  "4": "《嘉兴中润项目推介.pdf》",
};
const PROJECT_TIME_META: Record<
  string,
  {
    dayLabel: string;
    userTimes: [string, string, string];
    aiTimes: [string, string, string];
  }
> = {
  shrimp: {
    dayLabel: "2026/04/09",
    userTimes: ["09:42", "09:47", "09:53"],
    aiTimes: ["09:44", "09:49", "09:55"],
  },
  "europe-hotel-ma": {
    dayLabel: "2026/04/12",
    userTimes: ["14:32", "14:36", "14:41"],
    aiTimes: ["14:34", "14:38", "14:44"],
  },
  "natgeo-rwa": {
    dayLabel: "2026/04/13",
    userTimes: ["11:18", "11:23", "11:29"],
    aiTimes: ["11:20", "11:26", "11:31"],
  },
  "cross-trade": {
    dayLabel: "2026/04/16",
    userTimes: ["17:38", "17:43", "17:48"],
    aiTimes: ["17:40", "17:45", "17:50"],
  },
};

function getProjectTimeMeta(projectId: string) {
  return (
    PROJECT_TIME_META[projectId] ?? {
      dayLabel: "2026/04/16",
      userTimes: ["10:30", "10:35", "10:40"] as [string, string, string],
      aiTimes: ["10:32", "10:37", "10:42"] as [string, string, string],
    }
  );
}

function getLastDialogueDateTime(projectId: string): string {
  const meta = getProjectTimeMeta(projectId);
  return `${meta.dayLabel} ${meta.aiTimes[2]}`;
}

function getCurrentDateTimeLabel() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${date} ${time}`;
}

function extractRagflowAnswer(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";

  const obj = payload as Record<string, unknown>;
  const picks: unknown[] = [
    obj.answer,
    obj.response,
    obj.output,
    obj.message,
    (obj.data as Record<string, unknown> | undefined)?.answer,
    (obj.data as Record<string, unknown> | undefined)?.response,
    (obj.data as Record<string, unknown> | undefined)?.output,
    (obj.result as Record<string, unknown> | undefined)?.answer,
  ];

  for (const item of picks) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return "";
}

function citationMarkerPrefix(id: string): string {
  if (id === "1") return "🟣";
  if (id === "2") return "🟢";
  if (id === "3") return "🔵";
  if (id === "4") return "🟡";
  return "⚪";
}

function formatCitationMarkers(
  text: string,
  map: Record<string, string> = NANNING_CITATION_MAP,
): string {
  let out = text.replace(/\[WEB\s*:\s*(\d+)\]/gu, "🌐[$1]");
  if (!out.includes("[ID:")) return out;
  return out
    .replace(/\[ID\s*:\s*(\d+)\]/gu, (_raw, id: string) => {
      const marker = `${citationMarkerPrefix(id)}`;
      const title = map[id];
      if (!title) return marker;
      return `[${marker}](cite:${id} "${title}")`;
    })
    .replace(/([)\]）】])(?=[🟣🟢🔵🟡⚪])/gu, "$1 ");
}

type UploadFileResult = {
  filename: string;
  parsed: boolean;
  chunks: number;
  pdfWarning?: string | null;
};

async function uploadSessionFilesToApi(
  chatEndpoint: string,
  projectId: string,
  userId: string,
  conversationId: string,
  files: File[],
): Promise<UploadFileResult[]> {
  const base = apiBaseFromChatEndpoint(chatEndpoint);
  const results: UploadFileResult[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    form.append("userId", userId);
    form.append("scope", "session");
    form.append("conversationId", conversationId);
    const res = await fetch(`${base}/api/projects/${projectId}/files`, {
      method: "POST",
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      filename?: string;
      parsed?: boolean;
      chunks?: number;
      pdfWarning?: string | null;
    };
    if (!res.ok) {
      throw new Error(payload.error || `上传失败（${res.status}）`);
    }
    results.push({
      filename: payload.filename ?? file.name,
      parsed: Boolean(payload.parsed),
      chunks: payload.chunks ?? 0,
      pdfWarning: payload.pdfWarning ?? null,
    });
  }
  return results;
}

function isGenericFileOnlyUserText(text: string): boolean {
  return /^已发送\s*\d+\s*个文件/u.test(text.trim());
}

function buildFileUploadApiMessage(fileNames: string[]): string {
  return `请阅读刚上传的项目资料并回答用户后续问题。附件：${fileNames.join("、")}`;
}

function withCurrentPreviewTime(conversation: SessionConversation): SessionConversation {
  return {
    ...conversation,
    updatedAt: getCurrentDateTimeLabel(),
  };
}

function buildConversationFromProject(projectId: string): SessionConversation | null {
  const project =
    getProjectById(projectId) ??
    ALL_PROJECTS.find((p) => p.id === projectId) ??
    (projectId.startsWith("proj-")
      ? {
          id: projectId,
          name: "云端项目",
          category: "",
          phase: "Active（资源筹备中）" as const,
          summary: "",
          guestSummary: "",
        }
      : null);
  if (!project) return null;
  const demo = getProjectResourceDemo(projectId);
  const names: string[] = [];
  demo.chat.supplyExchanges?.forEach((ex) => {
    ex.attachments?.forEach((f) => names.push(f.name));
  });
  demo.chat.midFollowUp?.forEach((step) => {
    if (step.kind === "text" && step.attachments) {
      step.attachments.forEach((f) => names.push(f.name));
    }
  });
  const isUserCreated = projectId.startsWith("proj-");
  return {
    id: `${projectId}-main`,
    projectId,
    title: `${project.name} · 全局分析`,
    preview: isUserCreated ? "基于项目资料包与对话进行分析" : demo.chat.sidebarPreview,
    updatedAt: getLastDialogueDateTime(projectId),
    files: isUserCreated ? [] : Array.from(new Set(names)),
    variant: isUserCreated ? "blank" : "demo",
  };
}

function conversationPath(c: SessionConversation): string {
  if (c.id === `${c.projectId}-main`) {
    return `/app/chat/${c.projectId}`;
  }
  return `/app/chat/${c.projectId}/${c.id}`;
}

async function copyPlainTextToClipboard(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    await navigator.clipboard.writeText(trimmed);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = trimmed;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function MessageBubbleToolbar({
  copyText,
  onDeleteMessage,
}: {
  copyText?: string;
  onDeleteMessage?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(copyText?.trim());
  if (!canCopy && !onDeleteMessage) return null;

  const handleCopy = () => {
    void copyPlainTextToClipboard(copyText ?? "").then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const actionBtnClass =
    "rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100";

  return (
    <div className="mt-2 flex shrink-0 flex-col gap-0.5">
      {canCopy ? (
        <button
          type="button"
          onClick={handleCopy}
          className={cn(actionBtnClass, "hover:bg-muted/80 hover:text-foreground")}
          title={copied ? "已复制" : "复制本条内容"}
          aria-label={copied ? "已复制" : "复制本条内容"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      ) : null}
      {onDeleteMessage ? (
        <button
          type="button"
          onClick={onDeleteMessage}
          className={cn(actionBtnClass, "hover:bg-destructive/10 hover:text-destructive")}
          title="删除本条消息"
          aria-label="删除本条消息"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

/** 用户发出内容（文字 / 附件）共用 brand kit 酒红气泡 */
const USER_MESSAGE_SHELL = cn(
  "border border-[hsl(var(--wine-deep)/0.32)]",
  "bg-gradient-to-br from-[hsl(var(--wine-deep))] to-[hsl(353_42%_28%)]",
  "shadow-[0_8px_22px_-12px_hsl(var(--wine-deep)/0.42)]",
);

function UserBubble({
  children,
  time,
  copyText,
  onDeleteMessage,
}: {
  children: ReactNode;
  time?: string;
  copyText?: string;
  onDeleteMessage?: () => void;
}) {
  const displayTime = formatBubbleTimeLabel(time);
  return (
    <div className="flex justify-end">
      <div className="group inline-flex flex-col items-end">
        <div className="flex items-start gap-1.5">
          <MessageBubbleToolbar copyText={copyText} onDeleteMessage={onDeleteMessage} />
          <div
            className={cn(
              "inline-block max-w-[32ch] sm:max-w-[42ch] rounded-3xl rounded-br-lg px-5 py-3 text-sm font-medium leading-relaxed text-wine-deep-foreground break-words whitespace-pre-line",
              USER_MESSAGE_SHELL,
              "transition-transform duration-300 hover:scale-[1.005]",
              "selection:bg-[hsl(var(--wine-muted))] selection:text-[hsl(var(--warm-charcoal))]",
            )}
          >
            {children}
          </div>
        </div>
        {displayTime ? (
          <span className="mt-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {displayTime}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ChatThinkingBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/25 px-3 py-1.5",
        className,
      )}
    >
      <TypingLoader size="sm" className="[&>div]:bg-[hsl(var(--wine-deep)/0.7)]" />
      <span className="text-sm font-medium text-muted-foreground">{children}</span>
    </div>
  );
}

function ChatAgentStatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 whitespace-nowrap text-[11px] text-muted-foreground">{children}</p>
  );
}

function AiShell({
  children,
  time,
  copyText,
  onDeleteMessage,
}: {
  children: ReactNode;
  time?: string;
  copyText?: string;
  onDeleteMessage?: () => void;
}) {
  const displayTime = formatBubbleTimeLabel(time);
  return (
    <div className="flex justify-start">
      <div className="group inline-flex flex-col items-start">
        <div className="flex items-start gap-1.5">
          <div
            className={cn(
              "max-w-[92%] rounded-3xl rounded-bl-lg border border-border/80 bg-white px-5 py-4 text-sm leading-relaxed text-foreground",
              "shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)]",
              "selection:bg-[hsl(var(--wine-deep)/0.14)] selection:text-foreground",
            )}
          >
            {children}
          </div>
          <MessageBubbleToolbar copyText={copyText} onDeleteMessage={onDeleteMessage} />
        </div>
        {displayTime ? (
          <span className="mt-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {displayTime}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function UploadSelectedFileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />;
  }
  if (lower.endsWith(".pdf")) {
    return <FileText className="h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} aria-hidden />;
  }
  return <FileUp className="h-4 w-4 shrink-0 text-[hsl(var(--wine-deep))]" strokeWidth={2} aria-hidden />;
}

/** 对话内「已发送附件」：与用户气泡同色系（brand kit 酒红），仅展示文件名 */
function ChatSentFilesPanel({ files }: { files: readonly { name: string }[] }) {
  if (files.length === 0) return null;
  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,28rem)] rounded-2xl rounded-br-lg px-4 py-3",
        USER_MESSAGE_SHELL,
      )}
    >
      <div className="mb-2.5 flex items-center gap-2 border-b border-wine-deep-foreground/15 pb-2">
        <Paperclip
          className="h-3.5 w-3.5 text-wine-deep-foreground/75"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-[11px] font-semibold tracking-wide text-wine-deep-foreground/80">
          已发送 {files.length} 个文件
        </span>
      </div>
      <div className="space-y-2">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between gap-2 rounded-xl border border-wine-deep-foreground/12 bg-black/[0.12] px-3 py-2.5"
          >
            <span className="truncate text-xs font-medium text-wine-deep-foreground">
              {f.name}
            </span>
            <span className="shrink-0 text-[10px] font-semibold text-wine-muted">已送达</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceTableBlock({
  tier,
  workspaceRole,
  projectId,
  projectName,
  time,
}: {
  tier: UiTier;
  workspaceRole: WorkspaceRole;
  projectId: string;
  projectName: string;
  time?: string;
}) {
  const demo = getProjectResourceDemo(projectId);

  const intro =
    tier === "full"
      ? workspaceRole === "admin"
        ? `${projectName}当前共有 3 个家族在智库中登记资源（Admin：可见全站字段，并可调整各维度评分权重，如供应链因素占比）。`
        : `${projectName}当前共有 3 个家族在智库中登记资源（Core：可录入与修改本家族数据，不可见其他家族明细）。`
      : tier === "mid"
        ? "以下为经脱敏后的资源配置概览：家族以代号呈现，资金为区间描述，细节模糊至区域级。"
        : "按您的权限，仅展示各环节是否已具备资源覆盖情况，不展示主体身份与具体金额。";

  const rows =
    tier === "full"
      ? demo.coreRows
      : tier === "mid"
        ? demo.secondaryRows
        : demo.brokerRows;

  const cols =
    tier === "low"
      ? ["环节", "家族/金额", "状态", "备注"]
      : ["家族", "资金", "状态", "核心资源"];

  const warn =
    tier === "full"
      ? demo.coreWarn
      : tier === "mid"
        ? demo.secondaryWarn
        : demo.brokerWarn;

  const foot =
    tier === "full"
      ? workspaceRole === "admin"
        ? "权限同步 · Admin · 可调整评分维度权重"
        : "权限同步 · Core · 本家族数据可维护，其他家族不可见"
      : tier === "mid"
        ? "权限同步 · Mid · 脱敏与简化视图"
        : "权限同步 · Low · 最低权限对话";

  return (
    <AiShell time={time}>
      <p className="mb-3 text-muted-foreground">{intro}</p>
      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-white/60">
        <table className="w-full min-w-[320px] text-left text-xs md:text-sm">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2.5 font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((row, i) => (
              <tr key={i} className="bg-white/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 font-medium">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-xs font-medium leading-relaxed text-amber-950/80">
        {warn}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">● {foot}</p>
    </AiShell>
  );
}

function MidRefusalBlock({ body, time }: { body: string; time?: string }) {
  return (
    <AiShell time={time}>
      <p className="text-sm font-semibold text-foreground">无法按此问题回答</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● 权限同步 · Mid · 隐私与主体路径未开放
      </p>
    </AiShell>
  );
}

function MidTextBlock({ title, body, time }: { title?: string; body: string; time?: string }) {
  return (
    <AiShell time={time}>
      {title ? (
        <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      ) : null}
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        {body}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● Master Agent · Mid · 定性说明
      </p>
    </AiShell>
  );
}

function CredibilityBlock({
  tier,
  chat,
  midSummaryLines,
  time,
}: {
  tier: UiTier;
  chat: ProjectChatSnippet;
  /** Mid：在报告卡片前逐条回应用户多问 */
  midSummaryLines?: string[];
  time?: string;
}) {
  if (tier === "low") {
    return (
      <AiShell time={time}>
        <p className="text-muted-foreground">
          按 Low 权限，无法展示具体合作方名称与金额可信度拆解。核心团队已在内部记录「外部大额意向」的折算规则，您只需知晓：该笔投入在评分中
          <strong className="text-foreground">不会</strong>
          按已确认资金满分计入。
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ● 权限同步 · Low · 隐藏主体与数值
        </p>
      </AiShell>
    );
  }

  if (tier === "mid") {
    return (
      <AiShell time={time}>
        <div className="mb-2 text-base font-bold text-foreground">
          {`可信度检测报告 · ${chat.credibilityTitleSecondary}`}
        </div>
        {midSummaryLines && midSummaryLines.length > 0 ? (
          <div className="mb-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">
              追问要点 · 逐条说明
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-foreground md:text-sm">
              {midSummaryLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Mid 权限：<strong className="text-foreground">评分、折算系数与金额口径的具体数值</strong>
          不对本视图展示，以下为定性摘要。
        </p>
        <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs md:grid-cols-2 md:text-sm">
          <div>
            <p className="text-muted-foreground">可信度评分</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">折算系数</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">有效金额（评分用）</p>
            <p className="font-bold text-muted-foreground">—（数值隐藏）</p>
          </div>
          <div>
            <p className="text-muted-foreground">风险等级</p>
            <p className="font-semibold text-amber-800/90">中</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          建议：补充加盖公章的意向函或资金路径说明，有助于提升折算档位与方案排序（具体系数与分值仅 Admin/Core 可见）。
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          ● Sub-Agent 5 · 吹牛检测与资金分级 · Mid 脱敏
        </p>
      </AiShell>
    );
  }

  return (
    <AiShell time={time}>
      <div className="mb-2 text-base font-bold text-foreground">
        {`可信度检测报告 · ${chat.credibilityTitleCore}`}
      </div>
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs md:grid-cols-2 md:text-sm">
        <div>
          <p className="text-muted-foreground">可信度评分</p>
          <p className="font-bold text-foreground">75 / 100</p>
        </div>
        <div>
          <p className="text-muted-foreground">折算系数</p>
          <p className="font-bold text-foreground">0.8</p>
        </div>
        <div>
          <p className="text-muted-foreground">有效金额（评分用）</p>
          <p className="font-bold text-foreground">2,400 万</p>
        </div>
        <div>
          <p className="text-muted-foreground">风险等级</p>
          <p className="font-semibold text-amber-800/90">中</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        建议：补充加盖公章的意向函或资金路径说明，可将折算系数上调，改善方案排名。
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        ● Sub-Agent 5 · 吹牛检测与资金分级
      </p>
    </AiShell>
  );
}

function RankingBlock({
  tier,
  chat,
  time,
}: {
  tier: UiTier;
  chat: ProjectChatSnippet;
  time?: string;
}) {
  if (tier === "low") {
    return (
      <AiShell time={time}>
        <p className="text-base font-bold text-foreground">
          可行合作路径
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          系统已生成多条理论可行组合，并按环节覆盖情况完成初筛。具体排名、分值与参与方细节仅向 Admin / Core 全量开放。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>若需推进签约，请通过核心对接人发起「方案评审」流程。</li>
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          ● Agent 流水线 · 输出已按权限截断
        </p>
      </AiShell>
    );
  }

  const plans =
    tier === "full" ? chat.rankingPlansCore : chat.rankingPlansSecondary;

  return (
    <AiShell time={time}>
      {tier === "mid" ? (
        <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950/90">
          Mid 权限：仅展示组合与推荐标记，<strong>具体分值隐藏</strong>；不可在本视图
          <strong>触发重新评分</strong>；如需调整维度权重，请联系 Admin 或 Core。
        </p>
      ) : null}
      <p className="mb-3 text-muted-foreground">
        {tier === "mid"
          ? "以下为 Sub-Agent 4 生成的组合地图经 Sub-Agent 5 排序后的前三名（Mid：名次与组合可见，具体分数隐藏）。"
          : "以下为 Sub-Agent 4 生成的组合地图经 Sub-Agent 5 评分后的前三名（最终以人工确认稿为准）。"}
      </p>
      <div className="space-y-2.5">
        {plans.map((p) => (
          <div
            key={p.rank}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-xs transition-all duration-300 md:text-sm",
              p.rec
                ? "border-primary/45 bg-primary/10 shadow-sm"
                : "border-border bg-background/60"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-muted-foreground">#{p.rank}</span>
              <span className="font-semibold text-foreground">{p.name}</span>
              {p.rec && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  推荐
                </span>
              )}
            </div>
            {tier === "mid" ? (
              <span className="text-[11px] font-semibold text-muted-foreground">
                分值 · 隐藏
              </span>
            ) : (
              <span className="font-bold text-primary">{p.score} 分</span>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {chat.rankingBullets.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        ● Agent A（调取）→ Agent B（评分）→ Agent C（决策）→ 输出
      </p>
    </AiShell>
  );
}

function permissionLineFor(role: WorkspaceRole): string {
  switch (role) {
    case "admin":
      return "Master Agent · Admin · 全站管理 / 评分权重可配置";
    case "core":
      return "Master Agent · Core · 财务细节与完整评分";
    case "mid":
      return "Master Agent · Mid · 脱敏视图 · 不可重评";
    case "low":
      return "Master Agent · Low · 最低权限对话";
    default:
      return "";
  }
}

/** 侧栏展示用：去掉前缀「Master Agent ·」 */
function permissionLineSidebar(role: WorkspaceRole): string {
  return permissionLineFor(role).replace(/^Master Agent ·\s*/u, "").trim();
}

export default function ConversationCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, conversationId } = useParams<{
    projectId: string;
    conversationId?: string;
  }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversations, setConversations] = useState<SessionConversation[]>([]);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [conversationFileRecords, setConversationFileRecords] = useState<
    ProjectFileRecord[]
  >([]);
  const [fileTreeRefreshKey, setFileTreeRefreshKey] = useState(0);
  const [deletingSessionFileId, setDeletingSessionFileId] = useState<string | null>(null);
  const [chatSyncReady, setChatSyncReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  /** 仅标记「当前会话」正在等同步 /api/chat 响应；深度任务用 pendingJobId，不占此项 */
  const [sendingConversationId, setSendingConversationId] = useState<string | null>(
    null,
  );
  const [liveMessagesByConversation, setLiveMessagesByConversation] = useState<
    Record<string, LiveChatMessage[]>
  >({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveCitationMap, setLiveCitationMap] = useState<Record<string, string>>({});
  const [newlyAddedConversationId, setNewlyAddedConversationId] = useState<string | null>(null);
  const [entryReady, setEntryReady] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const newConversationTimerRef = useRef<number | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const playbackSeqRef = useRef(0);
  const resumedAgentJobIdsRef = useRef<Set<string>>(new Set());
  const chatPersistTimerRef = useRef<number | null>(null);
  /** 云端 hydrate 后跳过首次自动 PUT，避免用未稳定 state 覆盖 D1 */
  const skipNextAutoPersistRef = useRef(false);
  /** 中文输入法组词中：Enter 仅确认上屏，不触发发送 */
  const chatImeComposingRef = useRef(false);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const persistSnapshotRef = useRef({
    conversations: [] as SessionConversation[],
    liveMessagesByConversation: {} as Record<string, LiveChatMessage[]>,
    isLiveAiMode: false,
  });
  const [searchParams] = useSearchParams();
  /** `.env` 设为 `0` / `false` 时可关闭主对话的「默认逐步演示」 */
  const playbackDisabledByEnv =
    import.meta.env.VITE_CHAT_PLAYBACK === "0" ||
    import.meta.env.VITE_CHAT_PLAYBACK === "false";
  const [playbackMsgs, setPlaybackMsgs] = useState<DemoPlaybackTimelineMsg[]>([]);
  const [playbackRoundIndex, setPlaybackRoundIndex] = useState(0);
  const [playbackThinking, setPlaybackThinking] = useState(false);
  const [chatSyncError, setChatSyncError] = useState<string | null>(null);

  useLayoutEffect(() => {
    resizeChatComposer(chatInputRef.current);
  }, [draftMessage]);

  useEffect(() => {
    const state = location.state as KnowledgeNetworkChatEntryState | null;
    const draft = state?.draftMessage?.trim();
    if (!draft) return;
    setDraftMessage(draft);
    navigate(location.pathname + location.search, { replace: true, state: null });
    requestAnimationFrame(() => chatInputRef.current?.focus());
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const id = loadSessionUserId();
    if (!id) {
      Object.keys(SESSION_CONVERSATION_CACHE).forEach((k) => {
        delete SESSION_CONVERSATION_CACHE[k];
      });
      navigate("/app/login", { replace: true });
      return;
    }
    const u = getUserById(id);
    if (!u) {
      navigate("/app/login", { replace: true });
      return;
    }
    setUserId(id);
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (newConversationTimerRef.current !== null) {
        window.clearTimeout(newConversationTimerRef.current);
      }
      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldPlay = window.sessionStorage.getItem(CHAT_ENTRY_TRANSITION_KEY) === "1";
    if (!shouldPlay) return;
    window.sessionStorage.removeItem(CHAT_ENTRY_TRANSITION_KEY);
    const shouldReduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) {
      setEntryReady(true);
      return;
    }
    setEntryReady(false);
    window.requestAnimationFrame(() => setEntryReady(true));
  }, []);

  const [projectLookupDone, setProjectLookupDone] = useState(false);
  const [apiProjectsTick, setApiProjectsTick] = useState(0);

  useEffect(() => subscribeApiProjects(() => setApiProjectsTick((n) => n + 1)), []);

  useEffect(() => {
    if (!projectId) {
      setProjectLookupDone(true);
      return;
    }
    if (getProjectById(projectId)) {
      setProjectLookupDone(true);
      return;
    }
    if (!ENABLE_LIVE_CHAT) {
      setProjectLookupDone(true);
      return;
    }
    let cancelled = false;
    setProjectLookupDone(false);
    void fetchProjectByIdFromApi(projectId)
      .then((row) => {
        if (!cancelled && row) upsertApiProject(row);
      })
      .finally(() => {
        if (!cancelled) setProjectLookupDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, apiProjectsTick]);

  const project = projectId ? getProjectById(projectId) : undefined;

  const projectRole = useMemo(() => {
    if (!userId || !projectId) return null;
    return getProjectRole(userId, projectId);
  }, [userId, projectId]);

  const tier = projectRole
    ? workspaceRoleToUiTier(projectRole)
    : null;

  useEffect(() => {
    if (!userId || !projectId || !projectLookupDone) return;
    if (getProjectRole(userId, projectId) === "guest") {
      navigate("/app/projects", { replace: true });
      return;
    }
    if (!getProjectById(projectId)) {
      navigate("/app/projects", { replace: true });
    }
  }, [userId, projectId, projectLookupDone, navigate, apiProjectsTick]);

  const resourceDemo = useMemo(
    () => getProjectResourceDemo(projectId ?? ""),
    [projectId]
  );

  const playbackRounds = useMemo(() => {
    if (!project || !tier || !projectRole) return [];
    return buildDemoPlaybackRoundSpecs(project.name, tier, projectRole, resourceDemo.chat);
  }, [project, tier, projectRole, resourceDemo.chat]);

  const permissionSidebarHint = projectRole ? permissionLineSidebar(projectRole) : "";
  const defaultChatTitle = project ? `${project.name} · 全局分析` : "项目对话";
  const timeMeta = projectId ? getProjectTimeMeta(projectId) : getProjectTimeMeta("");
  const todayLabel = timeMeta.dayLabel;

  const effectiveConversationId = useMemo(() => {
    if (!projectId) return "";
    return pickConversationIdForProject(
      projectId,
      conversationId,
      liveMessagesByConversation,
    );
  }, [projectId, conversationId, liveMessagesByConversation]);

  const isCurrentConversationSending = Boolean(
    effectiveConversationId && sendingConversationId === effectiveConversationId,
  );

  const isLiveAiMode =
    ENABLE_LIVE_CHAT && Boolean(AI_CHAT_ENDPOINT) && projectRole !== "guest";

  useLayoutEffect(() => {
    persistSnapshotRef.current = {
      conversations,
      liveMessagesByConversation,
      isLiveAiMode,
    };
  }, [conversations, liveMessagesByConversation, isLiveAiMode]);

  const runChatPersist = useCallback(
    (options?: ChatPersistOptions) => {
      if (!userId || !chatSyncReady) return;
      const snap = persistSnapshotRef.current;
      const messageCount = Object.values(snap.liveMessagesByConversation).reduce(
        (n, arr) => n + (arr?.length ?? 0),
        0,
      );
      if (snap.conversations.length === 0 && messageCount === 0) return;
      const baseConvs = snap.isLiveAiMode
        ? reconcileConversationsWithMessages(
            snap.conversations,
            snap.liveMessagesByConversation,
          )
        : snap.conversations;
      const convsToSave = applyConversationMetadataFromMessages(
        baseConvs,
        snap.liveMessagesByConversation,
      );
      void persistChatStateForUser(
        userId,
        {
          conversations: convsToSave,
          messagesByConversation: snap.liveMessagesByConversation,
        },
        options,
      );
    },
    [userId, chatSyncReady],
  );

  const flushChatPersist = useCallback(
    (options?: ChatPersistOptions) => {
      if (chatPersistTimerRef.current) {
        window.clearTimeout(chatPersistTimerRef.current);
        chatPersistTimerRef.current = null;
      }
      // 等 React 提交 setState 后再读 snapshot（useLayoutEffect 已更新 ref）
      window.setTimeout(() => runChatPersist(options), 0);
    },
    [runChatPersist],
  );

  const scheduleChatPersist = useCallback(() => {
    if (!userId || !chatSyncReady) return;
    if (skipNextAutoPersistRef.current) {
      skipNextAutoPersistRef.current = false;
      return;
    }
    if (chatPersistTimerRef.current) {
      window.clearTimeout(chatPersistTimerRef.current);
    }
    chatPersistTimerRef.current = window.setTimeout(() => {
      chatPersistTimerRef.current = null;
      runChatPersist();
    }, CHAT_PERSIST_DEBOUNCE_MS);
  }, [userId, chatSyncReady, runChatPersist]);

  const activeConversation = useMemo(() => {
    if (!effectiveConversationId || !projectId) return null;
    const found = conversations.find((item) => item.id === effectiveConversationId);
    if (found) return found;
    if (!isLiveAiMode) return null;
    const built = buildConversationFromProject(projectId);
    if (!built) return null;
    return {
      ...built,
      id: effectiveConversationId,
      preview: "尚未发送消息",
      variant: "blank" as const,
    };
  }, [conversations, effectiveConversationId, projectId, isLiveAiMode]);

  const isBlankThread = activeConversation?.variant === "blank";

  const sidebarGroups = useMemo(
    () =>
      groupSidebarByProject(conversations, liveMessagesByConversation, isLiveAiMode),
    [conversations, liveMessagesByConversation, isLiveAiMode],
  );

  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleProjectCollapsed = (pid: string) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setChatSyncReady(false);

    const bootstrap = async () => {
      const cacheKey = userId;

      skipNextAutoPersistRef.current = true;
      setChatSyncError(null);

      const remote = await loadChatStateForUser(userId);
      if (cancelled) return;

      const cached = SESSION_CONVERSATION_CACHE[cacheKey];

      if (remote) {
        const messagesByConversation = sortMessagesByConversation(
          remote.messagesByConversation,
        );
        setLiveMessagesByConversation(messagesByConversation);
        const next = mergeConversationsForBootstrap(
          remote.conversations,
          messagesByConversation,
          isLiveAiMode,
        );
        setConversations(next);
        SESSION_CONVERSATION_CACHE[cacheKey] = {
          conversations: next,
          messagesByConversation,
        };
        setChatSyncReady(true);
        return;
      }

      const cachedMsgs = sortMessagesByConversation(
        cached?.messagesByConversation ?? {},
      );
      const cachedMsgCount = Object.values(cachedMsgs).reduce(
        (n, arr) => n + (arr?.length ?? 0),
        0,
      );

      if (cached && (cached.conversations.length > 0 || cachedMsgCount > 0)) {
        setLiveMessagesByConversation(cachedMsgs);
        const next = mergeConversationsForBootstrap(
          cached.conversations,
          cachedMsgs,
          isLiveAiMode,
        );
        setConversations(next);
        setChatSyncError(
          "云端对话暂未能加载，已用本页会话缓存展示。请检查网络后刷新；勿在多标签同时编辑以免覆盖。",
        );
        setChatSyncReady(true);
        return;
      }

      setLiveMessagesByConversation({});
      const next = mergeConversationsForBootstrap([], {}, isLiveAiMode);
      setConversations(next);
      SESSION_CONVERSATION_CACHE[cacheKey] = {
        conversations: next,
        messagesByConversation: {},
      };
      if (isLiveAiMode) {
        setChatSyncError("云端对话加载失败，请稍后刷新页面。");
      }
      setChatSyncReady(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [userId, isLiveAiMode]);

  /** URL 落在空的 -main 时，自动切到有消息的会话（如 blank- 线程） */
  useEffect(() => {
    if (!projectId || !chatSyncReady) return;
    const picked = pickConversationIdForProject(
      projectId,
      conversationId,
      liveMessagesByConversation,
    );
    const path = conversationRoutePath(projectId, picked);
    const currentPath =
      conversationId && conversationId !== `${projectId}-main`
        ? `/app/chat/${projectId}/${conversationId}`
        : `/app/chat/${projectId}`;
    if (path !== currentPath) {
      navigate(path, { replace: true });
    }
  }, [
    projectId,
    conversationId,
    chatSyncReady,
    liveMessagesByConversation,
    navigate,
  ]);

  useEffect(() => {
    if (!userId || !chatSyncReady) return;
    SESSION_CONVERSATION_CACHE[userId] = {
      conversations,
      messagesByConversation: liveMessagesByConversation,
    };
    scheduleChatPersist();
    return () => {
      if (chatPersistTimerRef.current) {
        window.clearTimeout(chatPersistTimerRef.current);
      }
    };
  }, [
    userId,
    chatSyncReady,
    conversations,
    liveMessagesByConversation,
    isLiveAiMode,
    scheduleChatPersist,
  ]);

  /** 一次性展开原版预设剧本（不经空格步进） */
  const instantStaticDemoPreferred =
    searchParams.get("chatInstant") === "1" || searchParams.get("instant") === "1";

  const playbackActive =
    !playbackDisabledByEnv &&
    searchParams.get("playback") !== "0" &&
    !instantStaticDemoPreferred &&
    !isLiveAiMode &&
    !isBlankThread &&
    Boolean(projectId && tier && projectRole);

  useEffect(() => {
    if (!playbackActive) return;
    setPlaybackMsgs([]);
    setPlaybackRoundIndex(0);
    setPlaybackThinking(false);
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, [playbackActive, effectiveConversationId, playbackRounds]);

  /** 切换侧边对话或路由会话时清空本地「待发送」附件，避免上方气泡已发出、底下仍挂着同一批待发送 */
  useEffect(() => {
    setSelectedFiles([]);
    setShowUploadPanel(false);
  }, [effectiveConversationId]);

  const deleteLiveMessage = useCallback(
    (messageId: string) => {
      if (!userId || !effectiveConversationId) return;
      if (
        !window.confirm(
          "确定删除本条消息？所有设备将不再显示；运维审计日志仍会保留全文（含 AI 回复）。",
        )
      ) {
        return;
      }
      const convId = effectiveConversationId;
      const nextList = (liveMessagesByConversation[convId] ?? []).filter(
        (m) => m.id !== messageId,
      );
      const nextMessages = {
        ...liveMessagesByConversation,
        [convId]: nextList,
      };
      skipNextAutoPersistRef.current = true;
      setLiveMessagesByConversation(nextMessages);
      SESSION_CONVERSATION_CACHE[userId] = {
        conversations,
        messagesByConversation: nextMessages,
      };
      flushChatPersist({
        deletedMessageIds: [{ conversationId: convId, messageId }],
      });
    },
    [
      userId,
      effectiveConversationId,
      liveMessagesByConversation,
      conversations,
      flushChatPersist,
    ],
  );

  const liveMessages = useMemo(() => {
    if (!effectiveConversationId) return EMPTY_LIVE_CHAT_MESSAGES;
    const raw = liveMessagesByConversation[effectiveConversationId] ?? EMPTY_LIVE_CHAT_MESSAGES;
    return sortMessagesChronologically(raw);
  }, [effectiveConversationId, liveMessagesByConversation]);

  const hasStreamingAssistantInThread = liveMessages.some((m) => m.isStreaming);

  useLayoutEffect(() => {
    const root = chatScrollRef.current;
    if (!root) return;
    const run = () => {
      root.scrollTop = root.scrollHeight;
    };
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }, [
    effectiveConversationId,
    liveMessages,
    playbackMsgs,
    playbackThinking,
    isCurrentConversationSending,
    hasStreamingAssistantInThread,
    showUploadPanel,
  ]);

  useEffect(() => {
    if (!isLiveAiMode || !AI_CHAT_ENDPOINT || !projectId) return;
    const base = apiBaseFromChatEndpoint(AI_CHAT_ENDPOINT);
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`${base}/api/projects/${projectId}/citations`);
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { map?: Record<string, string> };
        if (data.map && Object.keys(data.map).length > 0) {
          setLiveCitationMap(data.map);
        }
      } catch {
        /* 无 API 时沿用本地 NANNING 映射 */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isLiveAiMode, projectId, AI_CHAT_ENDPOINT]);

  useEffect(() => {
    if (!isLiveAiMode || !AI_CHAT_ENDPOINT || !projectId || !effectiveConversationId || !userId) {
      setConversationFileRecords([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const all = await fetchProjectFiles(projectId, userId);
        if (cancelled) return;
        const session = filterConversationSessionFiles(all, effectiveConversationId);
        setConversationFileRecords(dedupeFilesByFilename(session));
      } catch {
        if (!cancelled) setConversationFileRecords([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isLiveAiMode,
    projectId,
    userId,
    effectiveConversationId,
    fileTreeRefreshKey,
    AI_CHAT_ENDPOINT,
  ]);

  const conversationFileTreeItems = useMemo(() => {
    if (isLiveAiMode && conversationFileRecords.length > 0) {
      return conversationFileRecords.map((f) => ({
        key: f.id,
        documentId: f.id,
        name: f.filename,
        meta: `${f.chunkCount} 段 · ${new Date(f.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
        canDelete: true,
      }));
    }
    return (activeConversation?.files ?? []).map((name) => ({
      key: name,
      documentId: undefined as string | undefined,
      name,
      meta: undefined as string | undefined,
      canDelete: false,
    }));
  }, [
    isLiveAiMode,
    conversationFileRecords,
    activeConversation,
    projectId,
  ]);

  const handleDeleteSessionFile = useCallback(
    async (documentId: string, filename: string) => {
      if (!projectId || !userId || !effectiveConversationId || !isLiveAiMode) return;
      const ok = window.confirm(
        `确定从本对话中删除「${filename}」？\n删除后检索将不再包含该附件，且无法恢复。`,
      );
      if (!ok) return;
      setDeletingSessionFileId(documentId);
      setLiveError(null);
      try {
        await deleteProjectFile(
          projectId,
          documentId,
          userId,
          AI_CHAT_ENDPOINT,
          effectiveConversationId,
        );
        setFileTreeRefreshKey((k) => k + 1);
      } catch (e) {
        setLiveError(e instanceof Error ? e.message : String(e));
      } finally {
        setDeletingSessionFileId(null);
      }
    },
    [projectId, userId, effectiveConversationId, isLiveAiMode],
  );

  useEffect(() => {
    if (!isLiveAiMode || !AI_CHAT_ENDPOINT) return;
    const healthUrl = buildApiHealthProbeUrl(AI_CHAT_ENDPOINT);
    if (!healthUrl) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(healthUrl, { method: "GET" });
        if (cancelled) return;
        if (!res.ok) {
          setLiveError(
            `无法连接 AI 接口（健康检查 ${res.status}）。请确认 Cloudflare Worker 已部署，且 GitHub Secrets 已配置 VITE_AI_CHAT_ENDPOINT。`,
          );
          return;
        }
        setLiveError((prev) =>
          prev &&
          (prev.includes("无法连接 AI 接口") ||
            prev.includes("Failed to fetch（健康检查）"))
            ? null
            : prev,
        );
      } catch {
        if (cancelled) return;
        setLiveError(
          formatRagflowRequestError("Failed to fetch（健康检查）", healthUrl),
        );
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isLiveAiMode, AI_CHAT_ENDPOINT]);

  useEffect(() => {
    if (!projectId || !userId) return;
    if (!conversationId) return;
    if (conversations.length === 0) return;
    const exists = conversations.some((item) => item.id === conversationId);
    if (!exists) {
      navigate(`/app/chat/${projectId}`, { replace: true });
    }
  }, [projectId, conversationId, conversations, userId, navigate]);

  useEffect(() => {
    setShowHistoryMenu(false);
    setLiveError(null);
  }, [projectId]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...prev];
      Array.from(files).forEach((f) => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) merged.push(f);
      });
      return merged;
    });
    setShowUploadPanel(true);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const appendLiveMessage = (conversationKey: string, message: LiveChatMessage) => {
    setLiveMessagesByConversation((prev) => ({
      ...prev,
      [conversationKey]: appendMessageWithSortIndex(prev[conversationKey] ?? [], message),
    }));
  };

  const updateLiveMessage = (
    conversationKey: string,
    messageId: string,
    patch: Partial<LiveChatMessage>,
  ) => {
    setLiveMessagesByConversation((prev) => ({
      ...prev,
      [conversationKey]: (prev[conversationKey] ?? []).map((m) =>
        m.id === messageId ? { ...m, ...patch } : m,
      ),
    }));
  };

  /** 刷新页面后恢复未完成的 Hermes 异步任务轮询 */
  useEffect(() => {
    if (!userId || !chatSyncReady || !isLiveAiMode || !AI_CHAT_ENDPOINT) return;
    const apiBase = apiBaseFromChatEndpoint(AI_CHAT_ENDPOINT);
    const citationMap = { ...NANNING_CITATION_MAP, ...liveCitationMap };
    for (const [conversationKey, messages] of Object.entries(liveMessagesByConversation)) {
      for (const m of messages) {
        if (m.role !== "assistant" || !m.pendingJobId) continue;
        if (resumedAgentJobIdsRef.current.has(m.pendingJobId)) continue;
        resumedAgentJobIdsRef.current.add(m.pendingJobId);
        void pollAgentJobUntilDone({
          apiBase,
          userId,
          jobId: m.pendingJobId,
          conversationKey,
          assistantMsgId: m.id,
          citationMap,
          onUpdate: updateLiveMessage,
          onError: setLiveError,
          onPersist: () => flushChatPersist(),
        });
      }
    }
  }, [
    userId,
    chatSyncReady,
    isLiveAiMode,
    AI_CHAT_ENDPOINT,
    liveMessagesByConversation,
    liveCitationMap,
    flushChatPersist,
  ]);

  const registerLiveChatActivity = () => {
    if (!projectId || !effectiveConversationId || !isLiveAiMode) return;
    saveLastChatProjectId(projectId);
    setConversations((prev) => {
      if (prev.some((c) => c.id === effectiveConversationId)) return prev;
      const built = buildConversationFromProject(projectId);
      if (!built) return prev;
      return [
        withCurrentPreviewTime({
          ...built,
          id: effectiveConversationId,
          preview: "对话进行中",
          variant: "blank",
        }),
        ...prev,
      ];
    });
  };

  const updateConversationPreview = (preview?: string, fileNames: string[] = []) => {
    setConversations((prev) =>
      prev.map((t) =>
        t.id === effectiveConversationId
          ? {
              ...t,
              files:
                fileNames.length > 0
                  ? Array.from(new Set([...t.files, ...fileNames]))
                  : t.files,
              ...(preview !== undefined ? { preview } : {}),
              updatedAt:
                latestMessageTimeLabel(
                  liveMessagesByConversation[effectiveConversationId],
                ) || getCurrentDateTimeLabel(),
            }
          : t
      )
    );
  };

  const deleteConversation = (target: SessionConversation) => {
    if (!userId) return;
    const label = projectDisplayName(target.projectId);
    if (
      !window.confirm(
        `确定删除「${label}」下的这条对话记录？删除后无法恢复。`,
      )
    ) {
      return;
    }

    const nextMessages = { ...liveMessagesByConversation };
    delete nextMessages[target.id];
    const nextConversations = conversations.filter((c) => c.id !== target.id);

    skipNextAutoPersistRef.current = true;
    SESSION_CONVERSATION_CACHE[userId] = {
      conversations: nextConversations,
      messagesByConversation: nextMessages,
    };
    setConversations(nextConversations);
    setLiveMessagesByConversation(nextMessages);

    void persistChatStateForUser(
      userId,
      {
        conversations: nextConversations,
        messagesByConversation: nextMessages,
      },
      { deletedConversationIds: [target.id], skipMerge: true },
    );

    if (
      target.id === effectiveConversationId &&
      target.projectId === projectId
    ) {
      const sameProject = nextConversations.filter(
        (c) =>
          c.projectId === projectId &&
          Array.isArray(nextMessages[c.id]) &&
          nextMessages[c.id].length > 0,
      );
      if (sameProject[0]) {
        navigate(conversationPath(sameProject[0]), { replace: true });
        return;
      }
      const anyOther = nextConversations.find(
        (c) =>
          Array.isArray(nextMessages[c.id]) && nextMessages[c.id].length > 0,
      );
      if (anyOther) {
        navigate(conversationPath(anyOther), { replace: true });
        return;
      }
      if (projectId) {
        navigate(`/app/chat/${projectId}`, { replace: true });
      }
    }
  };

  const handleSend = async () => {
    if (!projectId) return;
    const trimmed = draftMessage.trim();
    const fileNames = selectedFiles.map((f) => f.name);

    /** 仅附件、无文字：演示剧本模式下也可发送（更新侧栏预览）；Live 走下方正式上传 */
    if (fileNames.length > 0 && !trimmed && !isLiveAiMode) {
      if (isCurrentConversationSending) return;
      setLiveError(null);
      updateConversationPreview(`已选择 ${fileNames.length} 个文件`, fileNames);
      setSelectedFiles([]);
      setShowUploadPanel(false);
      if (!AI_CHAT_ENDPOINT) {
        setLiveError(
          "演示模式：附件仅本地展示。请在 GitHub Secrets 配置 VITE_ENABLE_LIVE_CHAT=1 与 VITE_AI_CHAT_ENDPOINT 后重新部署，即可真实上传并由 AI 引用。",
        );
      }
      return;
    }

    if (playbackActive) {
      if (playbackThinking || !trimmed) return;
      const round = playbackRounds[playbackRoundIndex];
      if (!round || trimmed !== round.userLine.trim()) return;

      playbackSeqRef.current += 1;
      const uid = `pb-u-${playbackSeqRef.current}`;
      const slot = Math.min(playbackRoundIndex, 2);
      const userTime = timeMeta.userTimes[slot];
      const aiTime = timeMeta.aiTimes[slot];

      setPlaybackMsgs((prev) => [
        ...prev,
        {
          id: uid,
          kind: "user",
          text: round.userLine,
          files: round.files,
          time: userTime,
        },
      ]);
      updateConversationPreview(deriveConversationTopicHeuristic(round.userLine));
      setDraftMessage("");
      setSelectedFiles([]);
      setShowUploadPanel(false);
      setPlaybackThinking(true);

      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
      const delay = demoThinkingDelayMs(round.userLine);
      playbackTimeoutRef.current = window.setTimeout(() => {
        playbackSeqRef.current += 1;
        const base = playbackSeqRef.current;
        const additions: DemoPlaybackTimelineMsg[] = round.assistantPieces.map((piece, i) => ({
          id: `pb-a-${base}-${i}`,
          kind: "assistant",
          piece,
          time: aiTime,
        }));
        setPlaybackMsgs((prev) => [...prev, ...additions]);
        setPlaybackThinking(false);
        setPlaybackRoundIndex((n) => n + 1);
        playbackTimeoutRef.current = null;
      }, delay);
      return;
    }

    if (!isLiveAiMode) {
      if (trimmed && fileNames.length === 0) {
        const hint = AI_CHAT_ENDPOINT
          ? "真 AI 未开启：请在 GitHub Actions Secrets 设置 VITE_ENABLE_LIVE_CHAT=1，并重新部署 Pages 后强刷页面（Ctrl+F5）。"
          : "真 AI 未配置：请在 GitHub Actions Secrets 添加 VITE_ENABLE_LIVE_CHAT=1 与 VITE_AI_CHAT_ENDPOINT（Worker 的 /api/chat 地址），并重新部署 Pages。";
        setLiveError(hint);
        return;
      }
      if (fileNames.length === 0) return;
      return;
    }

    if (
      !effectiveConversationId ||
      (!trimmed && fileNames.length === 0) ||
      isCurrentConversationSending
    ) {
      return;
    }

    registerLiveChatActivity();

    setLiveError(null);
    const filesToUpload = [...selectedFiles];
    const displayText =
      trimmed ||
      (fileNames.length > 0 ? `已发送 ${fileNames.length} 个文件` : "");
    const apiMessage =
      trimmed || (fileNames.length > 0 ? buildFileUploadApiMessage(fileNames) : "");

    const priorUserCount = (
      liveMessagesByConversation[effectiveConversationId] ?? []
    ).filter((m) => m.role === "user").length;
    const isFirstUserTurn = priorUserCount === 0;

    if (isLiveAiMode && project && !conversations.some((c) => c.id === effectiveConversationId)) {
      const blankConv = buildBlankSessionConversation(
        projectId,
        effectiveConversationId,
        project.name,
      );
      setConversations((prev) => [blankConv, ...prev.filter((c) => c.id !== effectiveConversationId)]);
    }

    appendLiveMessage(effectiveConversationId, {
      id: `user-${Date.now()}`,
      role: "user",
      content: displayText,
      files: fileNames.length > 0 ? fileNames.map((name) => ({ name })) : undefined,
      time: getCurrentDateTimeLabel(),
    });
    flushChatPersist();
    if (isFirstUserTurn) {
      updateConversationPreview(
        deriveConversationTopicHeuristic(apiMessage || displayText),
        fileNames,
      );
    } else {
      updateConversationPreview(undefined, fileNames);
    }
    setDraftMessage("");
    setSelectedFiles([]);
    setShowUploadPanel(false);

    if (!AI_CHAT_ENDPOINT) {
      const msg =
        "尚未配置 AI 接口。请在 GitHub Secrets 或 `.env.local` 中设置 VITE_AI_CHAT_ENDPOINT（Cloudflare Worker /api/chat）。";
      setLiveError(msg);
      appendLiveMessage(effectiveConversationId, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: msg,
        time: getCurrentDateTimeLabel(),
      });
      return;
    }

    if (!userId) return;

    const sendConversationId = effectiveConversationId;
    let streamAssistantId: string | null = null;
    let streamAccumulated = "";
    let mergedCitationMap: Record<string, string> = {
      ...NANNING_CITATION_MAP,
      ...liveCitationMap,
    };
    setSendingConversationId(sendConversationId);
    try {
      let uploadNotes = "";
      if (filesToUpload.length > 0) {
        const uploaded = await uploadSessionFilesToApi(
          AI_CHAT_ENDPOINT,
          projectId,
          userId!,
          effectiveConversationId,
          filesToUpload,
        );
        const warnings = uploaded
          .filter((u) => u.pdfWarning || !u.parsed || u.chunks === 0)
          .map((u) => {
            if (u.pdfWarning) return `${u.filename}：${u.pdfWarning}`;
            if (!u.parsed || u.chunks === 0) {
              return `${u.filename}：未解析出可检索正文，建议改传 .txt/.md 或可选中文字的 PDF`;
            }
            return "";
          })
          .filter(Boolean);
        if (warnings.length > 0) {
          uploadNotes = `\n\n【上传提示】\n${warnings.join("\n")}`;
          setLiveError(warnings[0]);
        }
        setFileTreeRefreshKey((k) => k + 1);
      }

      const history = liveMessages.map((m) => ({ role: m.role, content: m.content }));
      const requestBody =
        RAGFLOW_MODE === "native"
          ? {
              question: apiMessage,
              stream: false,
              user_id: userId,
            }
          : RAGFLOW_MODE === "openai"
            ? {
                stream: false,
                model: "qwen-plus",
                messages: [...history, { role: "user", content: apiMessage }],
              }
            : {
                projectId,
                conversationId: effectiveConversationId,
                userId,
                role: projectRole,
                message: apiMessage,
                files: fileNames,
                history,
                stream: true,
              };

      const deepSkill = isDeepSkillMessage(apiMessage);
      const useWorkerJson =
        RAGFLOW_MODE !== "native" &&
        RAGFLOW_MODE !== "openai" &&
        Boolean(requestBody && typeof requestBody === "object" && "projectId" in requestBody);
      const useWorkerStream = useWorkerJson && !deepSkill;

      if (useWorkerStream) {
        streamAssistantId = `assistant-${Date.now()}`;
        setLiveError(null);
        appendLiveMessage(effectiveConversationId, {
          id: streamAssistantId,
          role: "assistant",
          content: "",
          time: getCurrentDateTimeLabel(),
          isStreaming: true,
        });
      } else if (deepSkill && useWorkerJson) {
        streamAssistantId = `assistant-${Date.now()}`;
        setLiveError(null);
        appendLiveMessage(effectiveConversationId, {
          id: streamAssistantId,
          role: "assistant",
          content: "",
          time: getCurrentDateTimeLabel(),
          isStreaming: true,
          streamStatusLabel: "正在提交深度分析任务…",
        });
      }

      const res = await fetch(AI_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(RAGFLOW_API_KEY ? { Authorization: `Bearer ${RAGFLOW_API_KEY}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      mergedCitationMap = {
        ...NANNING_CITATION_MAP,
        ...liveCitationMap,
      };

      if (
        useWorkerStream &&
        streamAssistantId &&
        (res.headers.get("Content-Type") ?? "").includes("text/event-stream")
      ) {
        const assistantId = streamAssistantId;

        let streamPayload: {
          async?: boolean;
          jobId?: string;
          assistantMessageId?: string;
          answer?: string;
          truncated?: boolean;
        } | null = null;
        streamAccumulated = "";

        await consumeChatSse(res, {
          onMeta: (meta) => {
            if (meta.citationMap && Object.keys(meta.citationMap).length > 0) {
              mergedCitationMap = { ...mergedCitationMap, ...meta.citationMap };
              setLiveCitationMap((prev) => ({ ...prev, ...meta.citationMap! }));
            }
            const topic = meta.conversationTopic?.trim();
            if (topic) updateConversationPreview(topic);
          },
          onStatus: (label) => {
            updateLiveMessage(effectiveConversationId, assistantId, {
              streamStatusLabel: label,
            });
          },
          onDelta: (text) => {
            streamAccumulated += text;
            setLiveMessagesByConversation((prev) => ({
              ...prev,
              [effectiveConversationId]: (prev[effectiveConversationId] ?? []).map((m) =>
                m.id === assistantId ? { ...m, content: `${m.content}${text}` } : m,
              ),
            }));
          },
          onDone: (done) => {
            streamPayload = {
              answer: done.answer,
              truncated: done.truncated,
              ...(done.knowledgeNetworkHtml ? { knowledgeNetworkHtml: done.knowledgeNetworkHtml } : {}),
            };
          },
          onError: (msg) => {
            throw new Error(msg);
          },
        });

        const payload = streamPayload as Record<string, unknown> | null;
        if (
          payload &&
          payload.async === true &&
          typeof payload.jobId === "string"
        ) {
          const jobId = payload.jobId as string;
          const assistantIdJob =
            typeof payload.assistantMessageId === "string"
              ? payload.assistantMessageId
              : `assistant-job-${jobId}`;
          updateLiveMessage(effectiveConversationId, assistantId, {
            id: assistantIdJob,
            content: formatCitationMarkers(
              String(payload.answer ?? "正在深度分析…"),
              mergedCitationMap,
            ),
            pendingJobId: jobId,
            jobProgressLabel: "任务已提交，正在连接引擎…",
            isStreaming: false,
            streamStatusLabel: undefined,
          });
          resumedAgentJobIdsRef.current.add(jobId);
          void pollAgentJobUntilDone({
            apiBase: apiBaseFromChatEndpoint(AI_CHAT_ENDPOINT),
            userId,
            jobId,
            conversationKey: effectiveConversationId,
            assistantMsgId: assistantIdJob,
            citationMap: mergedCitationMap,
            onUpdate: updateLiveMessage,
            onError: setLiveError,
            onPersist: () => flushChatPersist(),
          });
          flushChatPersist();
          return;
        }

        let rawAnswer =
          (payload && typeof payload.answer === "string" ? payload.answer : "") ||
          "已收到消息，但未返回可展示答案。";
        if (payload?.truncated === true) {
          rawAnswer += STREAM_TRUNCATED_FOOTER;
          setLiveError("模型输出因上游超时提前结束，已保留上文内容。");
        }
        const answer = formatCitationMarkers(rawAnswer + uploadNotes, mergedCitationMap);
        const knFromApi =
          payload && typeof payload.knowledgeNetworkHtml === "string"
            ? payload.knowledgeNetworkHtml
            : null;
        const prepared = prepareKnowledgeNetworkMessageDisplay(answer, knFromApi);
        const knVerStream =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { projectKnowledgeNetworkVersion?: unknown })
            .projectKnowledgeNetworkVersion === "number"
            ? (payload as { projectKnowledgeNetworkVersion: number })
                .projectKnowledgeNetworkVersion
            : undefined;
        updateLiveMessage(effectiveConversationId, assistantId, {
          content: prepared.displayContent,
          knowledgeNetworkHtml: prepared.html || undefined,
          projectKnowledgeNetworkVersion: knVerStream,
          isStreaming: false,
          streamStatusLabel: undefined,
        });
        flushChatPersist();
        return;
      }

      const payload: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const bodyAnswer =
          payload && typeof payload === "object" && "answer" in payload
            ? String((payload as { answer?: string }).answer ?? "")
            : "";
        const bodyError =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: string }).error ?? "")
            : "";
        throw new Error(
          bodyAnswer.trim() || bodyError.trim() || `AI 接口返回 ${res.status}`,
        );
      }
      const citationFromApi =
        payload && typeof payload === "object" && "citationMap" in payload
          ? (payload as { citationMap?: Record<string, string> }).citationMap
          : undefined;
      mergedCitationMap = {
        ...mergedCitationMap,
        ...citationFromApi,
      };
      if (citationFromApi && Object.keys(citationFromApi).length > 0) {
        setLiveCitationMap((prev) => ({ ...prev, ...citationFromApi }));
      }

      const topicFromApi =
        payload && typeof payload === "object" && "conversationTopic" in payload
          ? String((payload as { conversationTopic?: string }).conversationTopic ?? "").trim()
          : "";
      if (topicFromApi) updateConversationPreview(topicFromApi);

      const isAsyncJob =
        payload &&
        typeof payload === "object" &&
        (payload as { async?: boolean }).async === true &&
        typeof (payload as { jobId?: unknown }).jobId === "string";

      if (isAsyncJob) {
        const jobId = (payload as { jobId: string }).jobId;
        const assistantId =
          typeof (payload as { assistantMessageId?: unknown }).assistantMessageId ===
          "string"
            ? (payload as { assistantMessageId: string }).assistantMessageId
            : `assistant-job-${jobId}`;
        const placeholderAnswer = formatCitationMarkers(
          String((payload as { answer?: string }).answer ?? "正在深度分析…"),
          mergedCitationMap,
        );
        setLiveError(null);
        if (streamAssistantId) {
          updateLiveMessage(effectiveConversationId, streamAssistantId, {
            id: assistantId,
            content: placeholderAnswer,
            pendingJobId: jobId,
            jobProgressLabel: "任务已提交，正在连接引擎…",
            isStreaming: false,
            streamStatusLabel: undefined,
          });
        } else {
          appendLiveMessage(effectiveConversationId, {
            id: assistantId,
            role: "assistant",
            content: placeholderAnswer,
            time: getCurrentDateTimeLabel(),
            pendingJobId: jobId,
            jobProgressLabel: "任务已提交，正在连接引擎…",
          });
        }
        resumedAgentJobIdsRef.current.add(jobId);
        void pollAgentJobUntilDone({
          apiBase: apiBaseFromChatEndpoint(AI_CHAT_ENDPOINT),
          userId,
          jobId,
          conversationKey: effectiveConversationId,
          assistantMsgId: assistantId,
          citationMap: mergedCitationMap,
          onUpdate: updateLiveMessage,
          onError: setLiveError,
          onPersist: () => flushChatPersist(),
        });
        flushChatPersist();
        return;
      }

      const rawAnswer = extractRagflowAnswer(payload) || "已收到消息，但未返回可展示答案。";
      const answer = formatCitationMarkers(rawAnswer + uploadNotes, mergedCitationMap);
      const knFromApi =
        payload &&
        typeof payload === "object" &&
        typeof (payload as { knowledgeNetworkHtml?: unknown }).knowledgeNetworkHtml ===
          "string"
          ? (payload as { knowledgeNetworkHtml: string }).knowledgeNetworkHtml
          : null;
      const prepared = prepareKnowledgeNetworkMessageDisplay(answer, knFromApi);
      const knVerJson =
        payload &&
        typeof payload === "object" &&
        typeof (payload as { projectKnowledgeNetworkVersion?: unknown })
          .projectKnowledgeNetworkVersion === "number"
          ? (payload as { projectKnowledgeNetworkVersion: number })
              .projectKnowledgeNetworkVersion
          : undefined;
      setLiveError(null);
      if (streamAssistantId) {
        updateLiveMessage(effectiveConversationId, streamAssistantId, {
          content: prepared.displayContent,
          knowledgeNetworkHtml: prepared.html || undefined,
          projectKnowledgeNetworkVersion: knVerJson,
          isStreaming: false,
          streamStatusLabel: undefined,
        });
      } else {
        appendLiveMessage(effectiveConversationId, {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: prepared.displayContent,
          time: getCurrentDateTimeLabel(),
          knowledgeNetworkHtml: prepared.html || undefined,
          projectKnowledgeNetworkVersion: knVerJson,
        });
      }
      flushChatPersist();
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "未知错误";
      const errMsg = formatRagflowRequestError(raw, AI_CHAT_ENDPOINT);
      const partialStream =
        streamAssistantId &&
        streamAccumulated.trim().length > 80 &&
        isStreamDisconnectError(raw);
      if (partialStream) {
        setLiveError("生成过程中网络中断，已保留上文内容。");
        updateLiveMessage(effectiveConversationId, streamAssistantId!, {
          content: formatCitationMarkers(
            streamAccumulated + STREAM_TRUNCATED_FOOTER,
            mergedCitationMap,
          ),
          isStreaming: false,
          streamStatusLabel: undefined,
        });
        flushChatPersist();
      } else {
        setLiveError(errMsg);
        if (streamAssistantId) {
          updateLiveMessage(effectiveConversationId, streamAssistantId, {
            content: errMsg,
            isStreaming: false,
            streamStatusLabel: undefined,
          });
        } else {
          appendLiveMessage(effectiveConversationId, {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: errMsg,
            time: getCurrentDateTimeLabel(),
          });
        }
      }
    } finally {
      setSendingConversationId((cur) =>
        cur === sendConversationId ? null : cur,
      );
    }
  };

  if (!user || !userId || !tier || !projectRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!projectId || projectRole === "guest") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        正在跳转项目总览…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {projectLookupDone ? "正在跳转项目总览…" : "正在加载项目…"}
      </div>
    );
  }

  const chatTitle = activeConversation?.title ?? defaultChatTitle;
  const chatDayLabel =
    isBlankThread
      ? new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
      : todayLabel;

  const playbackRound = playbackActive ? playbackRounds[playbackRoundIndex] : undefined;
  const playbackSendAllowed =
    playbackActive &&
    !playbackThinking &&
    playbackRoundIndex < playbackRounds.length &&
    draftMessage.trim() === playbackRound?.userLine.trim();

  return (
    <WorkspaceShell
      shellClassName="h-screen overflow-hidden"
      contentClassName="overflow-hidden pb-3"
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col overflow-hidden md:rounded-[1.75rem] md:border md:border-border/45 md:bg-white/55 md:shadow-[0_28px_90px_-48px_rgba(73,45,41,0.22)] md:backdrop-blur-xl",
          "transition-[opacity,transform,filter] duration-220",
          entryReady
            ? "opacity-100 translate-y-0 scale-100 blur-0"
            : "opacity-0 translate-y-2 scale-[0.995] blur-[1px]",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-border/60 bg-white/70 backdrop-blur-md md:w-[17rem] md:rounded-tl-[1.75rem] md:border-b-0 md:border-r md:border-border/50">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--wine-deep)/0.14)] to-[hsl(var(--wine-deep)/0.05)] text-[hsl(var(--wine-deep))] shadow-inner shadow-[hsl(var(--wine-deep)/0.06)] transition-colors hover:from-[hsl(var(--wine-deep)/0.2)]">
              <Sparkles size={24} strokeWidth={2} />
            </div>
            <div>
              <p className="font-display text-sm font-bold leading-tight text-foreground">
                对话中心
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                合域 · Joint Office
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => {
              if (!projectId || !project || !userId) return;
              const newId = `${projectId}-blank-${userId}-${Date.now()}`;
              const newConv = buildBlankSessionConversation(
                projectId,
                newId,
                project.name,
              );
              skipNextAutoPersistRef.current = true;
              setConversations((prev) => [
                newConv,
                ...prev.filter((c) => c.id !== newId),
              ]);
              setLiveMessagesByConversation((prev) => ({
                ...prev,
                [newId]: prev[newId] ?? [],
              }));
              setNewlyAddedConversationId(newId);
              if (newConversationTimerRef.current !== null) {
                window.clearTimeout(newConversationTimerRef.current);
              }
              newConversationTimerRef.current = window.setTimeout(() => {
                setNewlyAddedConversationId((prev) => (prev === newId ? null : prev));
              }, 260);
              navigate(`/app/chat/${projectId}/${newId}`);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.08)] px-3 py-2.5 text-xs font-semibold text-[hsl(var(--wine-deep))] transition-colors hover:bg-[hsl(var(--wine-deep)/0.14)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            新增对话
          </button>
          {sidebarGroups.length === 0 ? (
            <p className="px-2 py-3 text-[11px] leading-relaxed text-muted-foreground">
              暂无对话记录。选择项目后发送消息即可开始。
            </p>
          ) : null}
          {sidebarGroups.map((group) => {
            const collapsed = collapsedProjectIds.has(group.projectId);
            return (
              <div key={group.projectId} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleProjectCollapsed(group.projectId)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50"
                >
                  {collapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-foreground">
                    {group.projectName}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {group.conversations.length}
                  </span>
                </button>
                {!collapsed
                  ? group.conversations.map((conversation) => {
                      const active =
                        conversation.id === effectiveConversationId &&
                        conversation.projectId === projectId;
                      return (
                        <div
                          key={conversation.id}
                          className={cn(
                            "group/item relative ml-2 w-[calc(100%-0.5rem)] rounded-xl border px-3 py-2.5 text-left transition-colors",
                            conversation.id === newlyAddedConversationId &&
                              "animate-in fade-in slide-in-from-top-1 duration-200",
                            active
                              ? "border-[hsl(var(--wine-deep)/0.32)] bg-[hsl(var(--wine-deep)/0.08)]"
                              : "border-transparent bg-white/70 hover:border-border/80 hover:bg-white",
                          )}
                        >
                          {active ? (
                            <span
                              aria-hidden
                              className="absolute bottom-1.5 right-0 top-1.5 w-[3px] rounded-full bg-[hsl(var(--wine-deep)/0.9)]"
                            />
                          ) : null}
                          <div className="flex items-start gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                saveLastChatProjectId(conversation.projectId);
                                navigate(conversationPath(conversation));
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className={cn(
                                    "line-clamp-1 break-words pr-1 text-[12px] leading-snug",
                                    active
                                      ? "font-semibold text-[hsl(var(--wine-deep))]"
                                      : "text-foreground",
                                  )}
                                >
                                  {conversation.preview}
                                </p>
                                <p className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatSidebarDateLabel(conversation.updatedAt)}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              title="删除此对话"
                              onClick={() => deleteConversation(conversation)}
                              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/item:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border/60 px-4 py-3 md:rounded-bl-[1.65rem]">
          {permissionSidebarHint ? (
            <p className="mb-2 text-[10px] font-medium leading-snug text-muted-foreground">
              当前权限：{permissionSidebarHint}
            </p>
          ) : null}
          <Link
            to="/"
            className="flex items-center gap-1 rounded-full px-1 py-1 text-[11px] font-semibold text-muted-foreground hover:text-[hsl(var(--wine-deep))]"
          >
            <ArrowLeft className="h-3 w-3" />
            返回官网
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-background/30 to-background/5 md:rounded-tr-[1.75rem]">
        <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-white/65 px-4 py-4 backdrop-blur-md md:px-6">
          <div>
            <Link
              to="/"
              className="mb-1 inline-block text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-[hsl(var(--wine-deep))]"
            >
              合域
            </Link>
            <h1 className="text-lg font-bold text-foreground md:text-xl">
              {chatTitle}
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Master Agent 在线
            </p>
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistoryMenu((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/85 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-[hsl(var(--wine-deep)/0.25)] hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              本对话文件
            </button>
            {showHistoryMenu ? (
              <div className="absolute right-0 top-10 z-20 w-[18rem] rounded-2xl border border-border/70 bg-white/95 p-2 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.35)] backdrop-blur-md">
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  本对话文件（{conversationFileTreeItems.length}）
                </p>
                <p className="px-2 pb-1 text-[10px] leading-snug text-muted-foreground">
                  仅含当前对话内上传、已入库的附件（非项目总览里的资料包）。
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-background/50 p-2">
                  {conversationFileTreeItems.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      暂无文件。请用输入栏回形针上传。
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {conversationFileTreeItems.map((item) => {
                        const isDeleting = deletingSessionFileId === item.documentId;
                        return (
                          <li
                            key={item.key}
                            className="rounded-lg border border-border/50 bg-white/80 px-2 py-1.5"
                          >
                            <div className="flex items-start gap-1.5 text-[11px] text-foreground">
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--wine-deep)/0.8)]" />
                              <span className="min-w-0 flex-1 leading-snug">{item.name}</span>
                              {item.canDelete && item.documentId ? (
                                <button
                                  type="button"
                                  disabled={Boolean(deletingSessionFileId)}
                                  onClick={() =>
                                    void handleDeleteSessionFile(item.documentId!, item.name)
                                  }
                                  className={cn(
                                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600",
                                    isDeleting && "pointer-events-none opacity-50",
                                  )}
                                  aria-label={`删除 ${item.name}`}
                                  title="从本对话删除"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  )}
                                </button>
                              ) : null}
                            </div>
                            {item.meta ? (
                              <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">
                                {item.meta}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div
          ref={chatScrollRef}
          className={cn(
            "flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8",
            showUploadPanel && "pb-[min(42vh,22rem)]",
          )}
        >
          <div className="flex justify-center">
            <span className="rounded-full border border-border/70 bg-white/80 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {chatDayLabel}
            </span>
          </div>
          {isBlankThread && !isLiveAiMode ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-white/40 px-6 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">空白对话</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                在下方输入消息或上传文件，开始与 Master Agent 对话。
              </p>
            </div>
          ) : isLiveAiMode ? (
            <>
              <AiShell>
                <p className="text-sm font-semibold text-[hsl(var(--wine-deep))]">
                  AI 助手已接入
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  经 Cloudflare API 调用千问。可上传 .txt / .md / 电子版 PDF；仅发附件后请再提一个具体问题。
                </p>
              </AiShell>
              {liveMessages.length === 0 ? (
                <AiShell>
                  <p className="text-sm text-muted-foreground">
                    还没有消息。先发送一条问题试试，例如：「给出南宁港项目的首期招商优先级建议」。
                  </p>
                </AiShell>
              ) : (
                liveMessages.map((m) => {
                  const streaming = Boolean(m.isStreaming);
                  const rawAssistantText =
                    m.role === "assistant"
                      ? streamingAssistantDisplayText(m.content, streaming)
                      : m.content;
                  const knPrepared =
                    m.role === "assistant"
                      ? prepareKnowledgeNetworkMessageDisplay(
                          rawAssistantText,
                          streaming ? null : m.knowledgeNetworkHtml,
                        )
                      : null;
                  const canDeleteMessage = !streaming;
                  const deleteThisMessage = canDeleteMessage
                    ? () => deleteLiveMessage(m.id)
                    : undefined;
                  const userCopyText =
                    m.content.trim() && !isGenericFileOnlyUserText(m.content)
                      ? m.content
                      : (m.files?.length ?? 0) > 0
                        ? m.files!.map((f) => f.name).join("\n")
                        : "";
                  const assistantCopyText = (knPrepared?.displayContent ?? rawAssistantText).trim();
                  return m.role === "user" ? (
                    <div key={m.id} className="flex flex-col items-end gap-3">
                      {m.files && m.files.length > 0 ? (
                        <ChatSentFilesPanel files={m.files} />
                      ) : null}
                      {m.content.trim() && !isGenericFileOnlyUserText(m.content) ? (
                        <UserBubble
                          time={m.time}
                          copyText={userCopyText}
                          onDeleteMessage={deleteThisMessage}
                        >
                          <ChatMarkdown text={m.content} variant="user" />
                        </UserBubble>
                      ) : (m.files?.length ?? 0) > 0 &&
                        (!m.content.trim() || isGenericFileOnlyUserText(m.content)) ? (
                        <div className="group flex justify-end">
                          <MessageBubbleToolbar
                            copyText={userCopyText}
                            onDeleteMessage={deleteThisMessage}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <AiShell
                      key={m.id}
                      time={m.time}
                      copyText={assistantCopyText}
                      onDeleteMessage={deleteThisMessage}
                    >
                      {m.isStreaming ? (
                        <ChatThinkingBadge className="mb-3">思考中…</ChatThinkingBadge>
                      ) : null}
                      {m.content.trim() ? (
                        <div
                          className={cn(
                            "text-sm",
                            m.isStreaming && "max-h-80 overflow-y-auto pr-1",
                          )}
                        >
                          <ChatMarkdown
                            text={knPrepared?.displayContent ?? rawAssistantText}
                            variant="assistant"
                          />
                        </div>
                      ) : m.isStreaming ? (
                        <p className="text-xs text-muted-foreground/80">
                          {m.streamStatusLabel?.trim() ||
                            "正在连接引擎并检索资料，请稍候…"}
                        </p>
                      ) : null}
                      {m.pendingJobId ? (
                        <div className="mt-3 flex flex-col gap-1.5">
                          <ChatThinkingBadge>
                            {m.jobProgressLabel?.trim() || "深度分析中，请稍候…"}
                          </ChatThinkingBadge>
                          <p className="text-[11px] text-muted-foreground/90">
                            可保持本页打开；刷新后会自动继续等待结果。
                          </p>
                        </div>
                      ) : null}
                      {knPrepared?.html ? (
                        <>
                          <KnowledgeNetworkPreview html={knPrepared.html} />
                          {typeof m.projectKnowledgeNetworkVersion === "number" ? (
                            <p className="mt-2 text-[11px] font-medium text-primary">
                              已同步至项目知识网络 v{m.projectKnowledgeNetworkVersion}
                            </p>
                          ) : null}
                        </>
                      ) : /知识网络交付失败|未检测到 curl PUT|知识网络未通过 API/i.test(
                          m.content,
                        ) ? (
                        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm leading-relaxed text-amber-950">
                          本次未生成可预览的知识网络（回复末尾缺少完整{" "}
                          <span className="font-medium">```html</span> 整页）。请点击「生成知识网络」重试；系统已要求<strong>一次回复</strong>即含整页 HTML，无需再发第二条消息。
                        </p>
                      ) : null}
                      <ChatAgentStatusLine>
                        ● Master Agent · AI {m.isStreaming ? "处理中" : "返回"}
                        {m.pendingJobId ? " · 后台分析" : ""}
                        {knPrepared?.html ? " · 含知识网络 HTML" : ""}
                      </ChatAgentStatusLine>
                    </AiShell>
                  );
                })
              )}
              {isCurrentConversationSending && !hasStreamingAssistantInThread ? (
                <AiShell>
                  <ChatThinkingBadge>思考中…</ChatThinkingBadge>
                  <ChatAgentStatusLine>● Master Agent · AI 处理中</ChatAgentStatusLine>
                </AiShell>
              ) : null}
            </>
          ) : playbackActive ? (
            <>
              {playbackMsgs.map((m) =>
                m.kind === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-3">
                    {m.files && m.files.length > 0 ? (
                      <ChatSentFilesPanel files={m.files} />
                    ) : null}
                    <UserBubble time={m.time}>{m.text}</UserBubble>
                  </div>
                ) : (
                  <PlaybackAssistantRenderer
                    key={m.id}
                    piece={m.piece}
                    tier={tier}
                    workspaceRole={projectRole}
                    projectId={project.id}
                    projectName={project.name}
                    chat={resourceDemo.chat}
                    time={m.time}
                  />
                ),
              )}
              {playbackThinking ? (
                <AiShell>
                  <ChatThinkingBadge>思考中…</ChatThinkingBadge>
                  <ChatAgentStatusLine>● Master Agent · 处理中</ChatAgentStatusLine>
                </AiShell>
              ) : null}
            </>
          ) : (
            <>
          {projectRole === "admin" ? (
            <AiShell>
              <p className="text-sm font-semibold text-[hsl(var(--wine-deep))]">
                Admin 控制台
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                您可调整各维度评分权重。示例：供应链因素占比{" "}
                <span className="font-mono text-foreground">20% → 25%</span>{" "}
                已写入当前项目草稿；Core 用户可在本项目中维护本家族数据。
              </p>
            </AiShell>
          ) : null}
          <UserBubble time={timeMeta.userTimes[0]}>
            请概述「{project.name}」目前的资源配置全貌
          </UserBubble>
          <ResourceTableBlock
            tier={tier}
            workspaceRole={projectRole}
            projectId={project.id}
            projectName={project.name}
            time={timeMeta.aiTimes[0]}
          />

          {tier === "full" &&
          resourceDemo.chat.supplyExchanges &&
          resourceDemo.chat.supplyExchanges.length > 0
            ? resourceDemo.chat.supplyExchanges.map((ex, i) => (
                <div key={`supply-${i}`} className="space-y-6">
                  <div className="flex flex-col items-end gap-3">
                    {ex.attachments && ex.attachments.length > 0 ? (
                      <ChatSentFilesPanel files={ex.attachments} />
                    ) : null}
                    <UserBubble time={timeMeta.userTimes[1]}>{ex.userLine}</UserBubble>
                  </div>
                  {ex.confirmation ? (
                    <>
                      <AiShell time={timeMeta.aiTimes[1]}>
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                          {ex.confirmation.agentPrompt}
                        </p>
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          ● Master Agent · 待您确认
                        </p>
                      </AiShell>
                      <UserBubble time={timeMeta.userTimes[1]}>
                        {ex.confirmation.userConfirmLine}
                      </UserBubble>
                    </>
                  ) : null}
                  <AiShell time={timeMeta.aiTimes[1]}>
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                      {ex.aiBody}
                    </p>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      ● Master Agent · 已入库 · 与本项目智库字段联动
                    </p>
                  </AiShell>
                </div>
              ))
            : null}

          {tier === "mid" &&
          resourceDemo.chat.midFollowUp &&
          resourceDemo.chat.midFollowUp.length > 0 ? (
            <>
              {resourceDemo.chat.midFollowUp.map((step, i) => (
                <div key={i} className="space-y-6">
                  <div className="flex flex-col items-end gap-3">
                    {step.kind === "text" &&
                    step.attachments &&
                    step.attachments.length > 0 ? (
                      <ChatSentFilesPanel files={step.attachments} />
                    ) : null}
                    <UserBubble time={timeMeta.userTimes[1]}>{step.userLine}</UserBubble>
                  </div>
                  {step.kind === "credibility" ? (
                    <CredibilityBlock
                      tier={tier}
                      chat={resourceDemo.chat}
                      time={timeMeta.aiTimes[1]}
                      midSummaryLines={
                        step.summaryLines && step.summaryLines.length > 0
                          ? step.summaryLines
                          : undefined
                      }
                    />
                  ) : step.kind === "refusal" ? (
                    <MidRefusalBlock body={step.body} time={timeMeta.aiTimes[1]} />
                  ) : (
                    <MidTextBlock title={step.title} body={step.body} time={timeMeta.aiTimes[1]} />
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <UserBubble time={timeMeta.userTimes[1]}>
                {tier === "low"
                  ? resourceDemo.chat.credibilityUserLineLow
                  : tier === "mid"
                    ? resourceDemo.chat.credibilityUserLineMid
                    : resourceDemo.chat.credibilityUserLine}
              </UserBubble>
              <CredibilityBlock tier={tier} chat={resourceDemo.chat} time={timeMeta.aiTimes[1]} />
            </>
          )}

          <UserBubble time={timeMeta.userTimes[2]}>推荐最佳合作方案</UserBubble>
          <RankingBlock tier={tier} chat={resourceDemo.chat} time={timeMeta.aiTimes[2]} />
            </>
          )}
        </div>

        <footer className="relative shrink-0 border-t border-border/50 bg-white/70 px-4 py-4 backdrop-blur-md md:rounded-br-[1.65rem] md:px-6">
          <input
            id="jfo-chat-file-input"
            ref={fileInputRef}
            type="file"
            multiple
            tabIndex={-1}
            className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
            accept=".pdf,.txt,.md,.html,.htm,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,text/html"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          {showUploadPanel || selectedFiles.length > 0 ? (
            <div className="absolute bottom-full left-4 right-4 z-30 mb-3 rounded-2xl border border-dashed border-[hsl(var(--wine-deep)/0.45)] bg-white/95 p-3 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md md:left-6 md:right-6">
              <div
                className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
              >
                {showUploadPanel ? (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <FileUp
                          className="h-4 w-4 shrink-0 text-[hsl(var(--wine-deep))]"
                          strokeWidth={2}
                          aria-hidden
                        />
                        拖拽文件到此处上传
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        AI 检索优先支持 .txt / .md；亦可上传 .htm / .html、PDF、Word、Excel、图片（PDF 等暂仅入库摘要）
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[hsl(var(--wine-deep))] px-4 text-sm font-semibold text-[hsl(var(--wine-deep))] transition-colors hover:bg-[hsl(var(--wine-deep)/0.08)]"
                    >
                      选择文件
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      已选 {selectedFiles.length} 个文件（点击回形针展开拖拽区）
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowUploadPanel(true)}
                      className="text-[11px] font-semibold text-[hsl(var(--wine-deep))] underline-offset-2 hover:underline"
                    >
                      添加更多
                    </button>
                  </div>
                )}

                {selectedFiles.length > 0 ? (
                  <div className={cn(showUploadPanel ? "mt-4 border-t border-border/60 pt-4" : "mt-3")}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      已添加 {selectedFiles.length} 个文件
                    </p>
                    <ul className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
                      {selectedFiles.map((f, idx) => (
                        <li key={`${f.name}-${f.size}-${f.lastModified}`}>
                          <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--wine-deep)/0.15)] bg-white px-3 py-2.5 text-xs shadow-sm">
                            <UploadSelectedFileIcon name={f.name} />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>
                            <span className="shrink-0 text-[10px] font-semibold text-[hsl(var(--wine-deep))]">待发送</span>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label="移除文件"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {chatSyncError ? (
            <div className="mb-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {chatSyncError}
            </div>
          ) : null}
          {liveError ? (
            <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-700">
              {liveError}
            </div>
          ) : null}

          {isLiveAiMode ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {CHAT_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={isCurrentConversationSending || playbackThinking}
                  onClick={() => setDraftMessage(item.message)}
                  className="rounded-full border border-border/80 bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[hsl(var(--wine-deep)/0.3)] hover:bg-[hsl(var(--wine-deep)/0.05)] hover:text-foreground disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              ref={chatInputRef}
              rows={1}
              value={draftMessage}
              onChange={(e) => {
                setDraftMessage(e.target.value);
                resizeChatComposer(e.target);
              }}
              onCompositionStart={() => {
                chatImeComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                chatImeComposingRef.current = false;
              }}
              onKeyDown={(e) => {
                if (
                  playbackActive &&
                  !playbackThinking &&
                  playbackRoundIndex < playbackRounds.length &&
                  draftMessage === "" &&
                  e.key === " "
                ) {
                  e.preventDefault();
                  setDraftMessage(playbackRounds[playbackRoundIndex].userLine);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  if (
                    e.nativeEvent.isComposing ||
                    chatImeComposingRef.current ||
                    e.keyCode === 229
                  ) {
                    return;
                  }
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={isCurrentConversationSending || playbackThinking}
              autoComplete="off"
              spellCheck={false}
              aria-label="对话输入"
              placeholder={
                isLiveAiMode
                  ? "输入消息；Shift+Enter 换行，Enter 发送；可说「查外部资料」触发联网"
                  : playbackActive
                    ? "按空格填入下一句演示问题；Shift+Enter 换行，Enter 发送"
                    : isBlankThread
                      ? "输入消息（需开启 Live 后才能真正发送）"
                      : "可直接输入；演示项目请按空格填入预设问题"
              }
              className={cn(
                "min-h-12 max-h-[88px] min-w-0 flex-1 resize-none overflow-x-hidden overflow-y-auto rounded-2xl border border-input bg-white px-5 py-2.5 text-sm font-medium leading-relaxed break-words whitespace-pre-wrap shadow-inner [overflow-wrap:anywhere] placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--wine-deep)/0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                draftMessage ? "text-foreground" : "text-muted-foreground",
                (isCurrentConversationSending || playbackThinking) && "opacity-70",
              )}
            />
            <button
              type="button"
              onClick={() => setShowUploadPanel((open) => !open)}
              className={cn(
                "inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border text-muted-foreground transition-colors",
                showUploadPanel || selectedFiles.length > 0
                  ? "border-[hsl(var(--wine-deep)/0.35)] bg-[hsl(var(--wine-deep)/0.1)] text-[hsl(var(--wine-deep))]"
                  : "border-input bg-white hover:bg-muted hover:text-foreground",
              )}
              aria-label="展开或收起文件上传区"
              aria-expanded={showUploadPanel}
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={
                isCurrentConversationSending ||
                playbackThinking ||
                (playbackActive ? !playbackSendAllowed : false) ||
                (!playbackActive &&
                  !isLiveAiMode &&
                  selectedFiles.length === 0 &&
                  draftMessage.trim().length === 0) ||
                (isLiveAiMode &&
                  draftMessage.trim().length === 0 &&
                  selectedFiles.length === 0)
              }
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-[hsl(var(--wine-deep))] bg-[hsl(var(--wine-deep))] px-8 text-sm font-semibold text-[hsl(var(--wine-deep-foreground))] shadow-[0_8px_22px_-10px_hsl(var(--wine-deep)/0.55)] transition-all hover:bg-[hsl(353_42%_28%)] active:scale-[0.98]"
            >
              <Plane className="h-4 w-4" strokeWidth={2} />
              {isCurrentConversationSending ? "发送中…" : "发送"}
            </button>
          </div>
        </footer>
      </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
