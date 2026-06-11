/** 与 api-worker/src/knowledge-network-intent.ts 保持同步 */

const KN_TOPIC_RE =
  /知识网络|知识底座|knowledge\s*base|knowledge\s*network|项目知识网络/u;

const KNOWLEDGE_NETWORK_DELIVERY_RE =
  /(?:全量重做|完整重做|从零生成|重新生成|全部重做|整页重做|重做).{0,20}(?:项目)?知识网络|(?:按板块|增量).{0,24}(?:更新|修改).{0,20}(?:项目)?知识网络|(?:生成|创建|产出|更新|修改|重建|写入).{0,28}(?:项目)?知识网络(?:\s*html)?|(?:项目)?知识网络.{0,16}(?:生成|创建|更新|修改|重做|重建|html|HTML|整页)|(?:调整|修改|重排).{0,16}(?:展示顺序|章节顺序|章节排列|知识网络.{0,8}顺序)|(?:把|将).{0,32}(?:移到|放到|提前).{0,32}(?:前面|之后|后面|前)|display[\s-]*order|reset\s+display\s+order|生成\s*kb|更新\s*kb|\[AI\][^\n]{0,48}知识网络|```html\s*整页|kb-template|build project profile|organize what we know|(?:generat|creat|updat|rebuild|deliver).{0,32}knowledge\s*network|regenerate\s+from\s+scratch|full\s+rebuild|rebuild\s+from\s+scratch/u;

const KN_READ_RE =
  /总结|概述|概况|介绍|讲讲|说说|解释|说一下|捋|梳理|主要内容|有什么内容|内容是什么|讲了什么|涵盖|包含哪些|简单.{0,10}(?:说|看|讲|介绍|总结)|帮我看|看一下|看看|要点|精华|提炼|摘要|什么意思|是什么|怎么样|如何理解|哪一版|哪个版|什么版本|哪版|当前版|最新版|版本号|第几版|v\s*\d|有没有|是否已有|有没有生成|谁更新|谁改的|什么时候|何时|多久前|更新时间|更新于|预览|在哪看|哪里看|怎么查看|如何查看|打开方式|目前|现在是|当前是|latest version|which version|what version|current version|when.*updated|who.*updated|published|exist/u;

export function isKnowledgeNetworkDeliveryIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return KNOWLEDGE_NETWORK_DELIVERY_RE.test(m);
}

export function isKnowledgeNetworkReadQuery(message: string): boolean {
  const m = message.trim();
  if (!m || !KN_TOPIC_RE.test(m)) return false;
  if (isKnowledgeNetworkDeliveryIntent(m)) return false;
  return KN_READ_RE.test(m);
}
