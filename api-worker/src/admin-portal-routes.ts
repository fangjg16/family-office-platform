import { loadChatStateData } from "./chat-sync";
import { listKnownWorkspaceUsers } from "./project-member-roles-db";
import { listProjects, type ProjectJson } from "./projects-db";
import { requireAdminPortalAuth } from "./admin-portal-auth";
import { resolveProjectRole, type WorkspaceRole } from "./workspace-roles";
import { workspaceUserProfile } from "./workspace-user-profiles";
import { KNOWN_WORKSPACE_USER_IDS } from "./workspace-known-users";
import { listRecentChatAuditLog, type AuditLogEntry } from "./chat-audit";
import {
  buildProjectDocumentsMap,
  countAllProjectDocuments,
  type AdminProjectDocuments,
} from "./admin-portal-documents";
import { loadProjectCognitionMap } from "./admin-portal-cognition";
import { buildAdminTokenUsageStats } from "./token-usage";

type Env = {
  DB: D1Database;
  ADMIN_PORTAL_USERNAME?: string;
  ADMIN_PORTAL_PASSWORD?: string;
  JFO_INTERNAL_KEY?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const ROLE_ACCESS_LABEL: Record<WorkspaceRole, string> = {
  admin: "Admin",
  core: "Core",
  mid: "Mid",
  low: "Low",
  guest: "Guest",
};

const ROLE_TIER_LABEL: Record<WorkspaceRole, string> = {
  admin: "Admin",
  core: "Core 核心级",
  mid: "Advanced 进阶级",
  low: "Basic 基础级",
  guest: "Guest",
};

type RiskLevel = "正常" | "提示" | "关注" | "拦截";
type LifecycleQueue = "对话跟进中" | "待合规复核" | "已归档";

export type AdminConversationRow = {
  id: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  userOrg: string;
  roleTier: string;
  startedAt: string;
  lastActiveAt: string;
  messages: number;
  tokensEst: number;
  risk: RiskLevel;
  policyHits: string[];
  lastIntent: string;
  lastSnippet: string;
  exported: boolean;
  channel: "项目对话" | "内部评测";
  lifecycleQueue: LifecycleQueue;
  toolsInvoked: string[];
  kbCitations: number;
  turns: { role: "user" | "assistant"; content: string; time: string }[];
};

export type AdminAuditEntry = {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  event: "created" | "deleted";
  role: "user" | "assistant";
  contentPreview: string;
  createdAt: string;
  source: string;
};

export type AdminOverviewStats = {
  projectCount: number;
  projectsByPhase: {
    active: number;
    completed: number;
    paused: number;
    cancelled: number;
  };
  userCount: number;
  conversationCount: number;
  todayActiveUsers: number;
  todayConversations: number;
  documentCount: number;
  auditEventCount: number;
  auditDeletedCount: number;
  pendingReviewCount: number;
};

export type AdminUserRow = {
  id: string;
  displayName: string;
  orgTitle: string;
  avatarChar: string;
  email: string;
  organization: string;
  role: WorkspaceRole;
  projectCount: number;
  lastLogin: string;
  accountStatus: "正常" | "冻结" | "待激活";
  phoneMasked: string;
  conversationCount: number;
  projectAccess: { projectId: string; projectName: string; accessLabel: string }[];
};

function normalizeTimestamp(raw: string): string {
  const t = raw.trim().replace(/\//gu, "-");
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/u);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}`;
  return t;
}

function formatIsoLogin(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isTestProject(projectId: string, title: string): boolean {
  return /测试新建|test/i.test(projectId) || /测试新建/i.test(title);
}

function projectNameMap(projects: ProjectJson[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, p.name]));
}

function estimateTokens(messages: { content: string }[]): number {
  return messages.reduce((s, m) => s + Math.ceil(m.content.length / 3.5), 0);
}

function detectPolicyHits(
  messages: { role: string; content: string; knowledgeNetworkHtml?: string | null }[],
): string[] {
  const hits: string[] = [];
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  if (/生产环境|api\s*key|密钥|密码/i.test(userText)) {
    hits.push("疑似索取生产配置或密钥");
  }
  if (/身份证|护照号|银行卡/i.test(userText)) {
    hits.push("疑似敏感身份信息");
  }
  if (/监管|合规|TGA|CRS/i.test(userText) && userText.length > 200) {
    hits.push("涉及监管合规深度讨论");
  }
  if (messages.some((m) => m.knowledgeNetworkHtml)) {
    hits.push("含知识网络 HTML 产出");
  }
  return hits;
}

function detectTools(
  messages: {
    id?: string;
    files?: { name: string }[];
    content: string;
    knowledgeNetworkHtml?: string | null;
  }[],
): string[] {
  const tools = new Set<string>();
  if (messages.some((m) => m.files?.length)) tools.add("session_upload");
  if (messages.some((m) => /知识网络|knowledge.network/i.test(m.content))) {
    tools.add("knowledge_network");
  }
  if (messages.some((m) => m.id?.includes("assistant-job"))) tools.add("agent_job");
  if (messages.some((m) => m.knowledgeNetworkHtml)) tools.add("kn_html_emit");
  return [...tools];
}

function deriveRisk(
  role: WorkspaceRole,
  policyHits: string[],
  messages: { content: string }[],
): RiskLevel {
  const blocked = messages.some((m) => /已拦截|无权进入|禁止输出/i.test(m.content));
  if (blocked) return "拦截";
  if (role === "guest") return "提示";
  if (policyHits.some((h) => h.includes("敏感") || h.includes("密钥"))) return "关注";
  if (policyHits.length > 0) return "提示";
  return "正常";
}

function deriveQueue(risk: RiskLevel, policyHits: string[]): LifecycleQueue {
  if (risk === "关注" || risk === "拦截" || policyHits.length > 0) {
    return "待合规复核";
  }
  return "对话跟进中";
}

function snippetLine(text: string, max: number): string {
  const one = text.replace(/\s+/gu, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

function buildConversationRow(
  userId: string,
  conv: {
    id: string;
    projectId: string;
    title: string;
    preview: string;
    updatedAt: string;
  },
  messages: {
    id?: string;
    role: "user" | "assistant";
    content: string;
    time: string;
    files?: { name: string }[];
    knowledgeNetworkHtml?: string | null;
  }[],
  projectNames: Map<string, string>,
  defaultRole: WorkspaceRole,
): AdminConversationRow {
  const profile = workspaceUserProfile(userId);
  const policyHits = detectPolicyHits(messages);
  const risk = deriveRisk(defaultRole, policyHits, messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const startedAt =
    messages.length > 0
      ? normalizeTimestamp(messages[0].time)
      : normalizeTimestamp(conv.updatedAt);
  const projectName =
    projectNames.get(conv.projectId) ??
    conv.title.split("·")[0]?.trim() ??
    conv.projectId;

  const TURN_LIMIT = 8;
  const TURN_CHAR_LIMIT = 900;

  return {
    id: `${userId}::${conv.id}`,
    sessionId: conv.id,
    projectId: conv.projectId,
    projectName,
    userId,
    userName: profile.displayName,
    userOrg: profile.orgTitle,
    roleTier: ROLE_TIER_LABEL[defaultRole],
    startedAt,
    lastActiveAt: normalizeTimestamp(conv.updatedAt),
    messages: messages.length,
    tokensEst: estimateTokens(messages),
    risk,
    policyHits,
    lastIntent: lastUser
      ? snippetLine(lastUser.content, 48)
      : snippetLine(conv.preview || "", 48),
    lastSnippet: conv.preview || lastUser?.content || "—",
    exported: false,
    channel: "项目对话",
    lifecycleQueue: deriveQueue(risk, policyHits),
    toolsInvoked: detectTools(messages),
    kbCitations: messages.filter((m) => m.knowledgeNetworkHtml).length,
    turns: messages.slice(-TURN_LIMIT).map((m) => ({
      role: m.role,
      time: m.time.replace(/\//gu, "-").slice(-8) || m.time,
      content:
        m.content.length > TURN_CHAR_LIMIT
          ? `${m.content.slice(0, TURN_CHAR_LIMIT)}…`
          : m.content,
    })),
  };
}

async function buildAdminUsers(
  env: Env,
  projects: ProjectJson[],
): Promise<AdminUserRow[]> {
  const users: AdminUserRow[] = [];

  for (const userId of KNOWN_WORKSPACE_USER_IDS) {
    const profile = workspaceUserProfile(userId);
    const projectAccess: AdminUserRow["projectAccess"] = [];
    let visibleCount = 0;

    for (const project of projects) {
      const role = await resolveProjectRole(env, userId, project.id, project.createdBy);
      if (role === "guest") continue;
      visibleCount += 1;
      projectAccess.push({
        projectId: project.id,
        projectName: project.name,
        accessLabel: ROLE_ACCESS_LABEL[role],
      });
    }

    let conversationCount = 0;
    let lastLoginIso: string | null = null;
    try {
      const state = await loadChatStateData(env, userId);
      conversationCount = state.conversations.length;
      for (const conv of state.conversations) {
        if (!lastLoginIso || conv.updatedAt > lastLoginIso) {
          lastLoginIso = conv.updatedAt;
        }
      }
    } catch {
      /* ignore per-user load errors */
    }

    users.push({
      id: userId,
      displayName: profile.displayName,
      orgTitle: profile.orgTitle,
      avatarChar: profile.avatarChar,
      email: profile.email,
      organization: profile.organization,
      role: profile.defaultRole,
      projectCount: visibleCount,
      lastLogin: formatIsoLogin(lastLoginIso),
      accountStatus: "正常",
      phoneMasked: "—",
      conversationCount,
      projectAccess,
    });
  }

  return users;
}

async function buildAdminConversations(
  env: Env,
  projects: ProjectJson[],
): Promise<AdminConversationRow[]> {
  const projectNames = projectNameMap(projects);
  const allRows: AdminConversationRow[] = [];
  const defaultRoles = Object.fromEntries(
    listKnownWorkspaceUsers().map((u) => [u.userId, u.defaultRole]),
  ) as Record<string, WorkspaceRole>;

  for (const userId of KNOWN_WORKSPACE_USER_IDS) {
    try {
      const state = await loadChatStateData(env, userId);
      for (const conv of state.conversations) {
        if (isTestProject(conv.projectId, conv.title)) continue;
        const messages = state.messagesByConversation[conv.id] ?? [];
        if (messages.length === 0 && !conv.preview?.trim()) continue;
        allRows.push(
          buildConversationRow(
            userId,
            conv,
            messages,
            projectNames,
            defaultRoles[userId] ?? "guest",
          ),
        );
      }
    } catch {
      /* ignore per-user load errors */
    }
  }

  allRows.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  return allRows;
}

function conversationAuditKey(userId: string, conversationId: string): string {
  return `${userId}::${conversationId}`;
}

function mapAuditEntry(entry: AuditLogEntry): AdminAuditEntry {
  const preview = entry.content.replace(/\s+/gu, " ").trim();
  return {
    id: entry.id,
    userId: entry.userId,
    conversationId: entry.conversationId,
    messageId: entry.messageId,
    event: entry.event,
    role: entry.role,
    contentPreview: preview.length > 160 ? `${preview.slice(0, 160)}…` : preview,
    createdAt: entry.createdAt,
    source: entry.source,
  };
}

function buildAuditByConversation(
  entries: AuditLogEntry[],
): Record<string, AdminAuditEntry[]> {
  const map: Record<string, AdminAuditEntry[]> = {};
  for (const entry of entries) {
    const key = conversationAuditKey(entry.userId, entry.conversationId);
    const list = map[key] ?? [];
    list.push(mapAuditEntry(entry));
    map[key] = list;
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return map;
}

function countProjectsByPhase(projects: ProjectJson[]) {
  let active = 0;
  let completed = 0;
  let paused = 0;
  let cancelled = 0;
  for (const p of projects) {
    if (p.phase.startsWith("Active")) active += 1;
    else if (p.phase.startsWith("Completed")) completed += 1;
    else if (p.phase.startsWith("Paused")) paused += 1;
    else if (p.phase.startsWith("Cancelled")) cancelled += 1;
  }
  return { active, completed, paused, cancelled };
}

function buildOverviewStats(
  projects: ProjectJson[],
  users: AdminUserRow[],
  conversations: AdminConversationRow[],
  documentCount: number,
  auditEntries: AuditLogEntry[],
): AdminOverviewStats {
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = conversations.filter((c) => c.lastActiveAt.startsWith(today));
  const todayUserIds = new Set(todayRows.map((c) => c.userId));
  const auditDeletedCount = auditEntries.filter((e) => e.event === "deleted").length;

  return {
    projectCount: projects.length,
    projectsByPhase: countProjectsByPhase(projects),
    userCount: users.length,
    conversationCount: conversations.length,
    todayActiveUsers: todayUserIds.size,
    todayConversations: todayRows.length,
    documentCount,
    auditEventCount: auditEntries.length,
    auditDeletedCount,
    pendingReviewCount: conversations.filter((c) => c.lifecycleQueue === "待合规复核")
      .length,
  };
}

async function buildBootstrapPayload(env: Env) {
  const allProjects = await listProjects(env);
  const projects = allProjects.filter((p) => !isTestProject(p.id, p.name));
  const projectIds = projects.map((p) => p.id);
  const users = await buildAdminUsers(env, projects);
  const conversations = await buildAdminConversations(env, projects);
  const [projectDocuments, documentCount, auditRaw, tokenUsage, projectCognition] =
    await Promise.all([
    buildProjectDocumentsMap(env, projectIds),
    countAllProjectDocuments(env, projectIds),
    listRecentChatAuditLog(env, 400),
    buildAdminTokenUsageStats(env, 90),
    loadProjectCognitionMap(env, projectIds),
  ]);
  const auditByConversation = buildAuditByConversation(auditRaw);
  const overview = buildOverviewStats(
    projects,
    users,
    conversations,
    documentCount,
    auditRaw,
  );

  return {
    ok: true as const,
    syncedAt: new Date().toISOString(),
    projects,
    users,
    conversations,
    projectDocuments,
    auditByConversation,
    overview,
    tokenUsage,
    projectCognition,
    counts: {
      projects: projects.length,
      users: users.length,
      conversations: conversations.length,
      documents: documentCount,
      auditEvents: auditRaw.length,
    },
  };
}

/** GET /api/admin/bootstrap — 管理后台一次性拉取项目、账号、对话 */
export async function handleAdminBootstrap(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;
  return json(await buildBootstrapPayload(env));
}

/** GET /api/admin/projects */
export async function handleAdminListProjects(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;
  const allProjects = await listProjects(env);
  const projects = allProjects.filter((p) => !isTestProject(p.id, p.name));
  return json({ ok: true, projects });
}

/** GET /api/admin/users */
export async function handleAdminListUsers(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;
  const allProjects = await listProjects(env);
  const projects = allProjects.filter((p) => !isTestProject(p.id, p.name));
  const users = await buildAdminUsers(env, projects);
  return json({ ok: true, users });
}

/** GET /api/admin/conversations */
export async function handleAdminListConversations(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAdminPortalAuth(request, env);
  if (auth) return auth;
  const allProjects = await listProjects(env);
  const projects = allProjects.filter((p) => !isTestProject(p.id, p.name));
  const conversations = await buildAdminConversations(env, projects);
  return json({ ok: true, conversations, syncedAt: new Date().toISOString() });
}
