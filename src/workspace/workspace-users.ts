import { ALL_PROJECTS } from "./projects";
import type { WorkspaceRole, WorkspaceUser } from "./types";

/** 内部预览环境统一密码 */
export const MOCK_PASSWORD = "jfo2026";

function fillRoles(role: WorkspaceRole): Record<string, WorkspaceRole> {
  return Object.fromEntries(ALL_PROJECTS.map((p) => [p.id, role]));
}

/** 用户在各项目中的权限（主档位 + 项目级覆盖） */
const PROJECT_ROLES: Record<string, Record<string, WorkspaceRole>> = {
  "candice-guo": fillRoles("admin"),
  "jimmy-huang": {
    ...fillRoles("core"),
    shrimp: "core",
    "natgeo-rwa": "core",
    "offshore-trust": "core",
    "ip-invest": "mid",
  },
  "jessica-hu": {
    ...fillRoles("mid"),
    "digital-portal": "core",
    "ip-invest": "core",
    "edu-ma": "core",
    "cross-trade": "low",
  },
  "jensen-fang": {
    ...fillRoles("low"),
    shrimp: "core",
    "hk-us-equity": "mid",
    "energy-ma": "mid",
    "med-channel": "mid",
  },
  "janice-hi": fillRoles("guest"),
};

export const WORKSPACE_USERS: Record<string, WorkspaceUser> = {
  "candice-guo": {
    id: "candice-guo",
    displayName: "CandiceGuo",
    orgTitle: "合域 · Admin",
    avatarChar: "C",
    avatarClass:
      "bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-sm",
  },
  "jimmy-huang": {
    id: "jimmy-huang",
    displayName: "JimmyHuang",
    orgTitle: "家族办公室 · Core",
    avatarChar: "J",
    avatarClass: "bg-primary text-primary-foreground shadow-sm",
  },
  "jessica-hu": {
    id: "jessica-hu",
    displayName: "JessicaHu",
    orgTitle: "投资顾问 · Mid",
    avatarChar: "S",
    avatarClass:
      "bg-[hsl(24,32%,44%)] text-[hsl(40,45%,98%)] shadow-sm",
  },
  "jensen-fang": {
    id: "jensen-fang",
    displayName: "JensenFang",
    orgTitle: "研究部 · Low",
    avatarChar: "N",
    avatarClass: "bg-stone-400 text-stone-900 shadow-sm",
  },
  "janice-hi": {
    id: "janice-hi",
    displayName: "JaniceHi",
    orgTitle: "访客 · Guest",
    avatarChar: "J",
    avatarClass: "bg-slate-300 text-slate-800 shadow-sm",
  },
};

/** 登录名 → 用户 id（不区分大小写；键均为 normalizeLoginKey 归一化后的小写串） */
const LOGIN_ALIASES: Record<string, string> = {
  candiceguo: "candice-guo",
  "candice-guo": "candice-guo",
  jimmyhuang: "jimmy-huang",
  "jimmy-huang": "jimmy-huang",
  jessicahu: "jessica-hu",
  "jessica-hu": "jessica-hu",
  jensenfang: "jensen-fang",
  "jensen-fang": "jensen-fang",
  "guset-janicehi": "janice-hi",
  "guest-janicehi": "janice-hi",
  gusetjanicehi: "janice-hi",
  guestjanicehi: "janice-hi",
  janicehi: "janice-hi",
  "janice-hi": "janice-hi",
};

function normalizeAliasKey(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  return t.replace(/\s+/g, "").replace(/_/g, "-");
}

export function normalizeLoginKey(raw: string): string | null {
  const key = normalizeAliasKey(raw);
  if (!key) return null;
  if (LOGIN_ALIASES[key]) return LOGIN_ALIASES[key];
  return null;
}

export function verifyLogin(
  username: string,
  password: string
): string | null {
  const id = normalizeLoginKey(username);
  if (!id) return null;
  if (!WORKSPACE_USERS[id]) return null;
  if (password !== MOCK_PASSWORD) return null;
  return id;
}

export function getUserById(id: string | null): WorkspaceUser | undefined {
  if (!id) return undefined;
  return WORKSPACE_USERS[id];
}

export function getProjectRole(
  userId: string,
  projectId: string
): WorkspaceRole {
  const map = PROJECT_ROLES[userId];
  if (!map) return "guest";
  return map[projectId] ?? "guest";
}

/** 对话区与表格的展示档位（与旧 core/secondary/broker 对齐） */
export type UiTier = "full" | "mid" | "low";

export function workspaceRoleToUiTier(role: WorkspaceRole): UiTier {
  if (role === "admin" || role === "core") return "full";
  if (role === "mid") return "mid";
  return "low";
}

export function roleLabelForProject(role: WorkspaceRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "core":
      return "Core（核心级）";
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

export function canEnterChat(role: WorkspaceRole): boolean {
  return role !== "guest";
}

/** 访客账号 id（用于导航与弹窗判断） */
export const GUEST_USER_ID = "janice-hi";
