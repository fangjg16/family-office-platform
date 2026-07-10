import { buildAdminSkillCatalog } from "./chat-modes";
import { workspaceUserDisplayName } from "./workspace-display-names";

type Env = { DB: D1Database };

export type AdminAgentJobRow = {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  conversationId: string | null;
  skillIntent: string;
  skillLabel: string;
  status: string;
  hasKnowledgeNetwork: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPermissionRuleRow = {
  role: string;
  label: string;
  capabilities: string[];
};

export type AdminAgentsCatalog = {
  skills: ReturnType<typeof buildAdminSkillCatalog>;
  recentJobs: AdminAgentJobRow[];
  permissionRules: AdminPermissionRuleRow[];
};

type JobRow = {
  id: string;
  project_id: string;
  user_id: string;
  conversation_id: string | null;
  skill_intent: string;
  status: string;
  knowledge_network_html: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const SKILL_LABELS: Record<string, string> = {
  standard: "标准快答",
  project_intake: "项目入驻评估",
  knowledge_network: "项目知识网络",
  ic_memo: "IC 备忘录",
  dd_checklist: "尽调清单",
  dd_claim_audit: "声明审计",
  document_reorganize: "文件索引",
  public_info_search: "公开信息检索",
  term_annotator: "术语注释",
  comp_analysis: "可比分析",
  background_check: "背景调查",
  risk_matrix: "风险矩阵",
  returns_analysis: "回报测算",
  sensitivity_analysis: "敏感性分析",
  value_creation_plan: "增值方案",
  gap_tracking: "信息缺口",
  node_monitoring: "节点监控",
};

function formatJobTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PERMISSION_RULES: AdminPermissionRuleRow[] = [
  {
    role: "admin",
    label: "Admin",
    capabilities: ["全项目运营数据", "管理后台", "发布知识网络", "项目资料包"],
  },
  {
    role: "core",
    label: "Core",
    capabilities: ["授权项目核心数据", "发布知识网络", "项目资料包"],
  },
  {
    role: "mid",
    label: "Mid",
    capabilities: ["授权项目进阶数据", "项目资料包", "脱敏区间答复"],
  },
  {
    role: "low",
    label: "Low",
    capabilities: ["基础流程与风险提示", "项目资料包（只读）"],
  },
  {
    role: "guest",
    label: "Guest",
    capabilities: ["公开级摘要", "不可见项目资料包列表"],
  },
];

export async function buildAdminAgentsCatalog(
  env: Env,
  projects: { id: string; name: string }[],
  limit = 80,
): Promise<AdminAgentsCatalog> {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const skills = buildAdminSkillCatalog();

  const recentJobs: AdminAgentJobRow[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, project_id, user_id, conversation_id, skill_intent, status,
              knowledge_network_html, error, created_at, updated_at
       FROM agent_jobs
       ORDER BY created_at DESC
       LIMIT ?`,
    )
      .bind(Math.min(Math.max(limit, 10), 200))
      .all<JobRow>();

    for (const row of results ?? []) {
      const intent = row.skill_intent.trim() || "standard";
      recentJobs.push({
        id: row.id,
        projectId: row.project_id,
        projectName: nameById.get(row.project_id) ?? row.project_id,
        userId: row.user_id,
        userName: workspaceUserDisplayName(row.user_id),
        conversationId: row.conversation_id,
        skillIntent: intent,
        skillLabel: SKILL_LABELS[intent] ?? intent,
        status: row.status,
        hasKnowledgeNetwork: Boolean(row.knowledge_network_html?.trim()),
        error: row.error,
        createdAt: formatJobTime(row.created_at),
        updatedAt: formatJobTime(row.updated_at),
      });
    }
  } catch {
    /* agent_jobs table missing */
  }

  return {
    skills,
    recentJobs,
    permissionRules: PERMISSION_RULES,
  };
}
