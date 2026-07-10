import type { WorkspaceRole } from "./workspace-roles";

export type WorkspaceUserProfile = {
  displayName: string;
  orgTitle: string;
  avatarChar: string;
  email: string;
  organization: string;
  defaultRole: WorkspaceRole;
};

/** 与前端 workspace-users.ts / 管理后台 platform.ts 对齐 */
export const WORKSPACE_USER_PROFILES: Record<string, WorkspaceUserProfile> = {
  "candice-guo": {
    displayName: "CandiceGuo",
    orgTitle: "合域 · Admin",
    avatarChar: "C",
    email: "candice.guo@jfo.ai",
    organization: "合域",
    defaultRole: "admin",
  },
  "jimmy-huang": {
    displayName: "JimmyHuang",
    orgTitle: "家族办公室 · Core 核心级",
    avatarChar: "J",
    email: "jimmy.huang@jfo.ai",
    organization: "家族办公室",
    defaultRole: "core",
  },
  "jessica-hu": {
    displayName: "JessicaHu",
    orgTitle: "投资顾问 · Advanced 进阶级",
    avatarChar: "S",
    email: "jessica.hu@jfo.ai",
    organization: "投资顾问",
    defaultRole: "mid",
  },
  "jensen-fang": {
    displayName: "JensenFang",
    orgTitle: "研究部 · Basic 基础级",
    avatarChar: "N",
    email: "jensen.fang@jfo.ai",
    organization: "研究部",
    defaultRole: "low",
  },
  "janice-hi": {
    displayName: "JaniceHi",
    orgTitle: "访客 · Guest",
    avatarChar: "J",
    email: "janice.hi@jfo.ai",
    organization: "访客",
    defaultRole: "guest",
  },
  "binghe-su": {
    displayName: "BingheSu",
    orgTitle: "研究部 · Basic 基础级",
    avatarChar: "B",
    email: "binghe.su@jfo.ai",
    organization: "研究部",
    defaultRole: "low",
  },
  peptide: {
    displayName: "Peptide",
    orgTitle: "访客 · 多肽项目",
    avatarChar: "P",
    email: "peptide@jfo.ai",
    organization: "访客",
    defaultRole: "guest",
  },
  aishort: {
    displayName: "AIShort",
    orgTitle: "访客 · AI短剧项目",
    avatarChar: "A",
    email: "aishort@jfo.ai",
    organization: "访客",
    defaultRole: "guest",
  },
};

export function workspaceUserProfile(userId: string): WorkspaceUserProfile {
  const id = userId.trim();
  const known = WORKSPACE_USER_PROFILES[id];
  if (known) return known;
  const displayName = id
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return {
    displayName: displayName || id,
    orgTitle: "工作台用户",
    avatarChar: (displayName || id).charAt(0).toUpperCase() || "?",
    email: `${id}@jfo.ai`,
    organization: "—",
    defaultRole: "guest",
  };
}
