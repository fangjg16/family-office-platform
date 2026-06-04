import type { ProjectKnowledgeNetworkMeta } from "./project-knowledge-network";

const KN_TOPIC_RE =
  /知识网络|知识底座|knowledge\s*base|knowledge\s*network|项目知识网络/u;

/** 生成/更新/交付类话术 → 仍走深度任务 */
const KN_DELIVERY_RE =
  /生成|创建|产出|更新|修改|重做|重建|全量|增量|按板块|regenerate|rebuild|build\s+.*profile|organize|写入|输出.*html|附.*html|```html|\[AI\]/u;

/** 查询已发布版本、是否存在、预览入口等 */
const KN_META_RE =
  /哪一版|哪个版|什么版本|哪版|当前版|最新版|版本号|第几版|v\s*\d|有没有|是否已有|有没有生成|谁更新|谁改的|什么时候|何时|多久前|更新时间|更新于|预览|在哪看|哪里看|怎么查看|如何查看|打开方式|目前|现在是|当前是|latest version|which version|what version|how many version|current version|when.*updated|who.*updated|published|exist/u;

/** 用户仅询问已发布知识网络状态，不应触发 Hermes 深度任务 */
export function isKnowledgeNetworkMetaQuery(message: string): boolean {
  const m = message.trim();
  if (!m || !KN_TOPIC_RE.test(m)) return false;
  if (KN_DELIVERY_RE.test(m)) return false;
  return KN_META_RE.test(m);
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
    `当前项目知识网络为 **v${meta.version}**（项目：${projectTitleHint}）。`,
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
    "完整 HTML 预览与历史归档请在 **项目详情 → 项目知识网络** 查看；本条为状态查询，无需重新生成。",
  );
  return lines.join("\n");
}
