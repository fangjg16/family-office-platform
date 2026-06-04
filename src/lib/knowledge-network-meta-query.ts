/** 与 api-worker knowledge-network-meta-query.ts 保持同步 */

const KN_TOPIC_RE =
  /知识网络|知识底座|knowledge\s*base|knowledge\s*network|项目知识网络/u;

const KN_DELIVERY_RE =
  /生成|创建|产出|更新|修改|重做|重建|全量|增量|按板块|regenerate|rebuild|build\s+.*profile|organize|写入|输出.*html|附.*html|```html|\[AI\]/u;

const KN_META_RE =
  /哪一版|哪个版|什么版本|哪版|当前版|最新版|版本号|第几版|v\s*\d|有没有|是否已有|有没有生成|谁更新|谁改的|什么时候|何时|多久前|更新时间|更新于|预览|在哪看|哪里看|怎么查看|如何查看|打开方式|目前|现在是|当前是|latest version|which version|what version|how many version|current version|when.*updated|who.*updated|published|exist/u;

export function isKnowledgeNetworkMetaQuery(message: string): boolean {
  const m = message.trim();
  if (!m || !KN_TOPIC_RE.test(m)) return false;
  if (KN_DELIVERY_RE.test(m)) return false;
  return KN_META_RE.test(m);
}
