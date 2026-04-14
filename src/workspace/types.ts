/** 项目内权限（同一人可在不同项目不同级别） */
export type WorkspaceRole =
  | "admin"
  | "core"
  | "mid"
  | "low"
  | "guest";

export type WorkspaceUser = {
  id: string;
  displayName: string;
  orgTitle: string;
  avatarChar: string;
  avatarClass: string;
};

export const SESSION_KEY = "fo-workspace-session";
