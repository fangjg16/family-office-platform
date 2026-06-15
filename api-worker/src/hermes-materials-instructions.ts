import type { SkillIntent } from "./chat-modes";
import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

/** Hermes 版「项目资料读取层」说明：先确认来源，再按需拉正文 */
export function buildJfoMaterialsInstructions(
  jfoBase: string,
  projectId: string,
  intent: SkillIntent,
  userId: string,
  conversationId: string,
  knMode?: KnowledgeNetworkUpdateMode,
): string {
  const knUrl = `${jfoBase}/api/hermes/projects/${encodeURIComponent(projectId)}/knowledge-network/current?format=raw`;
  const packageManifest = `${jfoBase}/api/hermes/projects/${encodeURIComponent(projectId)}/manifest?scope=package`;
  const sessionManifest =
    userId && conversationId
      ? `${jfoBase}/api/hermes/projects/${encodeURIComponent(projectId)}/manifest?scope=session&userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId)}`
      : null;
  const allManifest =
    userId && conversationId
      ? `${jfoBase}/api/hermes/projects/${encodeURIComponent(projectId)}/manifest?scope=all&userId=${encodeURIComponent(userId)}&conversationId=${encodeURIComponent(conversationId)}`
      : null;

  const readingByTask = taskReadingGuidance(intent, knMode);

  const lines = [
    "",
    "【项目资料来源确认（jfo-r2-materials · 按需读取）】",
    "目的：先确认项目事实来源，再分析、再写入 KB——不是机械全文拉取所有文件。",
    "",
    "必须先确认：",
    `- projectId=${projectId}`,
    `- 项目资料包 manifest（轻量，默认 GET）：${packageManifest}`,
    ...(sessionManifest
      ? [
          `- 本对话 session manifest（用户若在对话上传附件，必须查；不可只读 package）：${sessionManifest}`,
          `- scope=all = 资料包 + 当前对话 session 附件：${allManifest}`,
        ]
      : ["- 本对话无 conversationId：仍查 package；若用户称刚上传附件，向 Worker 确认 userId/conversationId"]),
    `- 当前版知识网络 KB（若任务涉及 KB）：GET ${knUrl}`,
    "",
    "规则：",
    "- manifest 是轻量步骤，默认执行；据此决定哪些文件需要 GET textUrl 正文。",
    "- 禁止只凭文件名、用户一句话或未读取资料做结论。",
    "- 引用与事实须可追溯到 KB、上传资料摘录或公开来源。",
    "- 用户刚在对话上传文件时：必须 scope=session 或 scope=all，不能只读 package。",
    "- 若上方有【Worker 预注入 · 项目资料摘录】：可作起点，不足时仍须 manifest + 按需 textUrl。",
    "",
    `本任务正文读取策略：${readingByTask.summary}`,
    ...readingByTask.bullets.map((b) => `- ${b}`),
    "",
    "textUrl 拉取：Header Authorization: Bearer $JFO_INTERNAL_KEY；仅对 manifest 中 parsed=true 且与本任务相关的文件 GET。",
    "完成资料确认后，再执行主分析 skill 交付用户可见结果。",
  ];

  return lines.join("\n");
}

function taskReadingGuidance(
  intent: SkillIntent,
  knMode?: KnowledgeNetworkUpdateMode,
): { summary: string; bullets: string[] } {
  if (intent === "knowledge_network") {
    if (knMode === "reorder") {
      return {
        summary: "reorder · 仅当前 KB",
        bullets: [
          "只 GET 当前知识网络 HTML，读取 <!-- KB-CONFIG -->",
          "不拉项目资料包/session 正文",
          "只更新 display-order、nav、section 编号",
        ],
      };
    }
    if (knMode === "incremental") {
      return {
        summary: "incremental · 当前 KB + 相关片段",
        bullets: [
          "GET 当前 KB；读取 KB-CONFIG",
          "仅拉取用户点名 slot 相关的资料片段",
          "本对话新附件（session）优先全文读取",
        ],
      };
    }
    if (knMode === "full") {
      return {
        summary: "full · 主要资料 + 从零写 KB",
        bullets: [
          "manifest 后读取主要项目资料（核心尽调文件，非机械全文）",
          "本对话 session 附件全部纳入",
          "按 kb-template 写入完整 KB-CONFIG",
        ],
      };
    }
    return {
      summary: "initial · manifest + 核心资料 + 首次 KB",
      bullets: [
        "manifest 后读取核心入驻/尽调文件（按需 textUrl，非全文灌入）",
        "本对话 session 附件全部纳入",
        "project-intake 识别 project-type 后写入 KB-CONFIG",
      ],
    };
  }

  if (intent === "project_intake") {
    return {
      summary: "入驻 · 主要资料",
      bullets: [
        "读取尽调/推介/财务等核心文件正文",
        "session 附件优先于 package",
        "无 KB 时准备写入首版 KB-CONFIG",
      ],
    };
  }

  if (intent === "ic_memo") {
    return {
      summary: "IC 备忘录 · KB 优先",
      bullets: [
        "优先 GET 当前知识网络 KB 作为事实底座",
        "仅当 KB 缺关键数字/条款时，再按需拉相关原始资料 textUrl",
        "输出 Markdown 草稿（非 Word 文件）",
      ],
    };
  }

  if (intent === "public_info_search") {
    return {
      summary: "公开检索 · 上下文轻读",
      bullets: [
        "manifest + 当前 KB（若有）作项目上下文",
        "再执行外部检索并与内部材料对照",
        "勿无差别拉取全部 package 正文",
      ],
    };
  }

  if (
    intent === "returns_analysis" ||
    intent === "sensitivity_analysis" ||
    intent === "value_creation_plan" ||
    intent === "risk_matrix" ||
    intent === "dd_checklist" ||
    intent === "dd_claim_audit" ||
    intent === "comp_analysis" ||
    intent === "background_check"
  ) {
    return {
      summary: "尽调/估值/风险 · KB + 相关片段",
      bullets: [
        "先 GET 当前 KB（若存在）",
        "仅拉取与本任务相关的资料片段（财务、法律、合同等）",
        "session 新附件若与任务相关则全文读取",
      ],
    };
  }

  return {
    summary: "深度任务 · 相关节选",
    bullets: [
      "manifest 确认清单",
      "按任务主题节选 textUrl，非全文灌入",
      "session 附件优先级高于 package",
    ],
  };
}
