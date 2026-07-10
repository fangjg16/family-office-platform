import { KNOWN_WORKSPACE_USER_IDS } from "./workspace-known-users";
import { workspaceUserDisplayName } from "./workspace-display-names";
import { workspaceUserProfile } from "./workspace-user-profiles";
import type { WorkspaceRole } from "./workspace-roles";

type Env = { DB: D1Database };

export type TokenUsageRecordInput = {
  userId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  source: string;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  isEstimated?: boolean;
};

export type AdminTokenDailyRow = {
  date: string;
  input: number;
  output: number;
  total: number;
  cost: number;
};

export type AdminTokenUserRow = {
  userId: string;
  displayName: string;
  orgTitle: string;
  role: string;
  totalTokens: number;
  conversations: number;
  avgPerConv: number;
  lastActive: string;
};

export type AdminTokenRoleGroupRow = {
  label: string;
  totalTokens: number;
  conversations: number;
};

export type AdminTokenUsageStats = {
  periodDays: number;
  monthTotalTokens: number;
  monthEstimatedCost: number;
  meteredEventCount: number;
  estimatedEventCount: number;
  daily: AdminTokenDailyRow[];
  byUser: AdminTokenUserRow[];
  byRoleGroup: AdminTokenRoleGroupRow[];
};

const COST_PER_TOKEN = 0.00003;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `tok-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3.5));
}

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatChartDate(day: string): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function formatLastActive(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseUsageFromLlmRaw(
  raw: unknown,
): { promptTokens: number; completionTokens: number; totalTokens: number } | null {
  const usage = (raw as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") return null;
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const total = Number(usage.total_tokens ?? prompt + completion);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    promptTokens: Math.max(0, Math.round(prompt)),
    completionTokens: Math.max(0, Math.round(completion)),
    totalTokens: Math.round(total),
  };
}

export function estimateUsageFromMessages(
  messages: { role: string; content: string }[],
): { promptTokens: number; completionTokens: number; totalTokens: number } {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const m of messages) {
    const t = estimateTokensFromText(m.content ?? "");
    if (m.role === "assistant") completionTokens += t;
    else promptTokens += t;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export async function recordTokenUsage(
  env: Env,
  input: TokenUsageRecordInput,
): Promise<void> {
  const promptTokens = Math.max(0, Math.round(input.promptTokens));
  const completionTokens = Math.max(0, Math.round(input.completionTokens));
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens <= 0) return;

  await env.DB.prepare(
    `INSERT INTO token_usage_log (
       id, user_id, project_id, conversation_id, source, model,
       prompt_tokens, completion_tokens, total_tokens, is_estimated, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      input.userId?.trim() || null,
      input.projectId?.trim() || null,
      input.conversationId?.trim() || null,
      input.source,
      input.model?.trim() || null,
      promptTokens,
      completionTokens,
      totalTokens,
      input.isEstimated ? 1 : 0,
      nowIso(),
    )
    .run();
}

type MeteredRow = {
  user_id: string | null;
  project_id: string | null;
  conversation_id: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  is_estimated: number;
  created_at: string;
};

type MessageRow = {
  user_id: string;
  conversation_id: string;
  role: string;
  content: string;
  updated_at: string;
};

async function loadMeteredRows(env: Env, sinceIso: string): Promise<MeteredRow[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT user_id, project_id, conversation_id, prompt_tokens, completion_tokens,
              total_tokens, is_estimated, created_at
       FROM token_usage_log
       WHERE created_at >= ?
       ORDER BY created_at ASC`,
    )
      .bind(sinceIso)
      .all<MeteredRow>();
    return results ?? [];
  } catch {
    return [];
  }
}

async function loadMessageRowsForEstimate(env: Env, sinceIso: string): Promise<MessageRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT user_id, conversation_id, role, content, updated_at
     FROM user_chat_messages
     WHERE updated_at >= ?`,
  )
    .bind(sinceIso)
    .all<MessageRow>();
  return results ?? [];
}

function roleGroupLabel(role: WorkspaceRole): string {
  if (role === "admin") return "管理 / Admin";
  if (role === "core" || role === "mid") return "Core / Mid";
  if (role === "low") return "Low / 研究";
  return "访客 Guest";
}

function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "core":
      return "Core";
    case "mid":
      return "Mid";
    case "low":
      return "Low";
    case "guest":
      return "Guest";
    default:
      return role;
  }
}

export async function buildAdminTokenUsageStats(
  env: Env,
  periodDays = 30,
): Promise<AdminTokenUsageStats> {
  const days = Math.min(Math.max(periodDays, 7), 90);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  const sinceIso = start.toISOString();

  const meteredRows = await loadMeteredRows(env, sinceIso);
  const hasMetered = meteredRows.length > 0;

  const dailyMap = new Map<string, { input: number; output: number; total: number }>();
  const userMap = new Map<
    string,
    { total: number; conversations: Set<string>; lastActive: string }
  >();
  const roleGroupMap = new Map<string, { total: number; conversations: Set<string> }>();

  let meteredEventCount = 0;
  let estimatedEventCount = 0;

  const addUsage = (
    userId: string | null,
    conversationId: string | null,
    day: string,
    input: number,
    output: number,
    isEstimated: boolean,
  ) => {
    const total = input + output;
    if (total <= 0) return;
    if (isEstimated) estimatedEventCount += 1;
    else meteredEventCount += 1;

    const daily = dailyMap.get(day) ?? { input: 0, output: 0, total: 0 };
    daily.input += input;
    daily.output += output;
    daily.total += total;
    dailyMap.set(day, daily);

    const uid = (userId ?? "unknown").trim() || "unknown";
    const user = userMap.get(uid) ?? {
      total: 0,
      conversations: new Set<string>(),
      lastActive: day,
    };
    user.total += total;
    if (conversationId) user.conversations.add(conversationId);
    if (day > user.lastActive) user.lastActive = day;
    userMap.set(uid, user);

    const profile = workspaceUserProfile(uid);
    const group = roleGroupLabel(profile.defaultRole);
    const roleRow = roleGroupMap.get(group) ?? { total: 0, conversations: new Set<string>() };
    roleRow.total += total;
    if (conversationId) roleRow.conversations.add(conversationId);
    roleGroupMap.set(group, roleRow);
  };

  if (hasMetered) {
    for (const row of meteredRows) {
      const day = dayKeyFromIso(row.created_at);
      addUsage(
        row.user_id,
        row.conversation_id,
        day,
        Number(row.prompt_tokens) || 0,
        Number(row.completion_tokens) || 0,
        row.is_estimated === 1,
      );
    }
  } else {
    const messages = await loadMessageRowsForEstimate(env, sinceIso);
    for (const row of messages) {
      const day = dayKeyFromIso(row.updated_at);
      const tokens = estimateTokensFromText(row.content ?? "");
      if (row.role === "assistant") {
        addUsage(row.user_id, row.conversation_id, day, 0, tokens, true);
      } else {
        addUsage(row.user_id, row.conversation_id, day, tokens, 0, true);
      }
    }
  }

  const daily: AdminTokenDailyRow[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = dailyMap.get(key) ?? { input: 0, output: 0, total: 0 };
    daily.push({
      date: formatChartDate(key),
      input: row.input,
      output: row.output,
      total: row.total,
      cost: +(row.total * COST_PER_TOKEN).toFixed(2),
    });
  }

  const byUser: AdminTokenUserRow[] = KNOWN_WORKSPACE_USER_IDS.map((userId) => {
    const profile = workspaceUserProfile(userId);
    const agg = userMap.get(userId);
    const totalTokens = agg?.total ?? 0;
    const conversations = agg?.conversations.size ?? 0;
    return {
      userId,
      displayName: profile.displayName,
      orgTitle: profile.orgTitle,
      role: roleLabel(profile.defaultRole),
      totalTokens,
      conversations,
      avgPerConv: conversations > 0 ? Math.round(totalTokens / conversations) : 0,
      lastActive: formatLastActive(agg?.lastActive ?? null),
    };
  }).sort((a, b) => b.totalTokens - a.totalTokens);

  const byRoleGroup: AdminTokenRoleGroupRow[] = [
    "管理 / Admin",
    "Core / Mid",
    "Low / 研究",
    "访客 Guest",
  ].map((label) => {
    const row = roleGroupMap.get(label);
    return {
      label,
      totalTokens: row?.total ?? 0,
      conversations: row?.conversations.size ?? 0,
    };
  });

  const monthTotalTokens = daily.reduce((s, d) => s + d.total, 0);

  return {
    periodDays: days,
    monthTotalTokens,
    monthEstimatedCost: +(monthTotalTokens * COST_PER_TOKEN).toFixed(2),
    meteredEventCount,
    estimatedEventCount,
    daily,
    byUser,
    byRoleGroup,
  };
}
