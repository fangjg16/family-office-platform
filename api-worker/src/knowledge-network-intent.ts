import { isKnowledgeNetworkSlotDeliveryIntent } from "./knowledge-network-slot-aliases";
import { formatKnVersionDisplay } from "./knowledge-network-version";
import type { ProjectKnowledgeNetworkMeta } from "./project-knowledge-network";

const KN_TOPIC_RE =
  /知识网络|知识底座|knowledge\s*base|knowledge\s*network|项目知识网络/u;

/**
 * 仅当用户明确要求生成/更新/重做 HTML 知识网络时走 Hermes 深度任务（正向匹配，不用「提到知识网络」即触发）。
 */
const KNOWLEDGE_NETWORK_DELIVERY_RE =
  /(?:全量重做|完整重做|从零生成|重新生成|全部重做|整页重做|重做).{0,20}(?:项目)?知识网络|(?:按板块|增量).{0,24}(?:更新|修改).{0,20}(?:项目)?知识网络|(?:生成|创建|产出|更新|修改|重建|写入|刷新).{0,28}(?:项目)?知识网络(?:\s*html)?|(?:项目)?知识网络.{0,16}(?:生成|创建|更新|修改|重做|重建|刷新|html|HTML|整页)|(?:调整|修改|重排).{0,16}(?:展示顺序|章节顺序|章节排列|知识网络.{0,8}顺序)|(?:把|将).{0,32}(?:移到|放到|提前).{0,32}(?:前面|之后|后面|前)|display[\s-]*order|reset\s+display\s+order|\/kb\b|生成\s*kb|更新\s*kb|\[AI\][^\n]{0,48}知识网络|```html\s*整页|kb-template|build project profile|organize what we know|(?:generat|creat|updat|rebuild|deliver|refresh).{0,32}knowledge\s*network|regenerate\s+from\s+scratch|full\s+rebuild|rebuild\s+from\s+scratch/u;

/** 阅读/摘要/版本状态：走轻问或同步读库，不生成新 HTML */
const KN_READ_RE =
  /总结|概述|概况|介绍|讲讲|说说|解释|说一下|捋|梳理|主要内容|有什么内容|内容是什么|讲了什么|涵盖|包含哪些|简单.{0,10}(?:说|看|讲|介绍|总结)|帮我看|看一下|看看|要点|精华|提炼|摘要|什么意思|是什么|怎么样|如何理解|哪一版|哪个版|什么版本|哪版|当前版|最新版|版本号|第几版|v\s*\d|有没有|是否已有|有没有生成|谁更新|谁改的|什么时候|何时|多久前|更新时间|更新于|预览|在哪看|哪里看|怎么查看|如何查看|打开方式|目前|现在是|当前是|latest version|which version|what version|current version|when.*updated|who.*updated|published|exist/u;

const KN_STATUS_ONLY_RE =
  /哪一版|哪个版|什么版本|哪版|当前版|最新版|版本号|第几版|有没有|是否已有|有没有生成|谁更新|谁改的|什么时候|何时|多久前|更新时间|更新于|预览|在哪看|哪里看|怎么查看|如何查看|打开方式|目前.{0,8}(?:是|有)|现在是|当前是|latest version|which version|what version|current version|when.*updated|who.*updated|published|exist/u;

const KN_SUMMARIZE_OR_CONTENT_RE =
  /总结|概述|概况|介绍|讲讲|说说|解释|说一下|捋|梳理|主要内容|有什么内容|内容是什么|讲了什么|涵盖|包含哪些|简单.{0,10}(?:说|看|讲|介绍|总结)|帮我看|看一下|看看|要点|精华|提炼|摘要|什么意思|怎么样|如何理解/u;

export function isKnowledgeNetworkDeliveryIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  if (KNOWLEDGE_NETWORK_DELIVERY_RE.test(m)) return true;
  return isKnowledgeNetworkSlotDeliveryIntent(m);
}

export function isKnowledgeNetworkReadQuery(message: string): boolean {
  const m = message.trim();
  if (!m || !KN_TOPIC_RE.test(m)) return false;
  if (isKnowledgeNetworkDeliveryIntent(m)) return false;
  return KN_READ_RE.test(m);
}

/** 仅问版本/入口，不需调 LLM 摘要 */
export function isKnowledgeNetworkStatusOnlyQuery(message: string): boolean {
  const m = message.trim();
  if (!isKnowledgeNetworkReadQuery(m)) return false;
  if (KN_SUMMARIZE_OR_CONTENT_RE.test(m)) return false;
  return KN_STATUS_ONLY_RE.test(m);
}

export function stripHtmlToPlainTextForSummary(html: string, maxLen = 28_000): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (t.length > maxLen) {
    t = `${t.slice(0, maxLen)}…（正文过长已截断，完整内容请在项目详情预览）`;
  }
  return t;
}

export function buildKnowledgeNetworkMetaAnswerText(
  meta: ProjectKnowledgeNetworkMeta | null,
  projectTitleHint: string,
  updatedByDisplayName?: string,
): string {
  if (!meta) {
    return [
      `项目「${projectTitleHint}」**尚未发布**项目知识网络。`,
      "",
      "可在 **项目详情 → 项目知识网络** 点击「生成知识网络」进入对话；或使用「上传 HTML 覆盖」发布本地成品。",
    ].join("\n");
  }

  const who =
    (updatedByDisplayName ?? "").trim() || meta.updatedBy || "—";
  let updatedAt = meta.updatedAt;
  try {
    const d = new Date(meta.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      updatedAt = d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {
    /* 保留 ISO */
  }

  const lines = [
    `当前项目知识网络为 **v${formatKnVersionDisplay(meta.version, meta.versionLabel)}**（项目：${projectTitleHint}）。`,
    "",
    `- **更新时间**：${updatedAt}`,
    `- **更新人**：${who}`,
  ];
  if (meta.changelog?.trim()) {
    lines.push(`- **版本摘要**：${meta.changelog.trim()}`);
  }
  if (meta.lastJobId) {
    lines.push(`- **最近任务 ID**：${meta.lastJobId}`);
  }
  lines.push(
    "",
    "完整 HTML 预览与历史归档请在 **项目详情 → 项目知识网络** 查看；本条为状态查询，**不会**重新生成 HTML。",
  );
  return lines.join("\n");
}

export function buildKnowledgeNetworkSummarySystemPrompt(): string {
  return [
    "你是家办平台项目助手。",
    "用户询问的是**已发布**项目知识网络的内容，不是让你生成新的 HTML。",
    "仅根据【知识网络正文摘录】作答，勿编造摘录中不存在的事实。",
    "用简体中文 Markdown，条理清晰（可分点或短段），不要输出 HTML 代码块。",
    "若摘录不足以回答，如实说明并建议用户在项目详情打开完整预览。",
  ].join("");
}
