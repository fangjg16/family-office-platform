/** 项目状态（英文标签 + 中文说明） */
export type ProjectPhase =
  | "Active（资源筹备中）"
  | "Completed（已签约）"
  | "Paused（暂停）"
  | "Cancelled（已取消）";

export type WorkspaceProject = {
  id: string;
  name: string;
  category: string;
  phase: ProjectPhase;
  /** 总览卡片摘要（含可量化信息，供非 Guest 角色） */
  summary: string;
  /** Guest 在卡片上仅见该句（不含具体机构/金额） */
  guestSummary: string;
  /** 云端新建项目：创建人 userId，用于编辑/删除鉴权 */
  createdBy?: string | null;
  /** public=全开放；invite=仅限邀请 */
  visibility?: "public" | "invite";
  /** 云端项目创建时间（ISO） */
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** 演示种子项目已移除；列表仅来自 D1 API（proj-*） */
export const ALL_PROJECTS: WorkspaceProject[] = [];

export const TOTAL_PROJECT_COUNT = 0;

export const DEFAULT_PROJECT_PHASE: ProjectPhase = "Active（资源筹备中）";

export function normalizeProjectPhase(raw: string | undefined | null): ProjectPhase {
  const phases: ProjectPhase[] = [
    "Active（资源筹备中）",
    "Completed（已签约）",
    "Paused（暂停）",
    "Cancelled（已取消）",
  ];
  const p = (raw ?? "").trim() as ProjectPhase;
  return phases.includes(p) ? p : DEFAULT_PROJECT_PHASE;
}
