/** 仅询问「能不能查外部」，不是要发起检索 */
const EXTERNAL_CAPABILITY_PATTERN =
  /(?:能否|是否可以|能不能|可不可以|可以).{0,20}(?:查|搜索|检索|查找|获取).{0,12}(?:外部|联网|网上|网络)|(?:外部|联网).{0,12}(?:资料|信息).{0,6}(?:吗|么|？|\?)/u;

/** 用户明确要求查外部 / 联网时触发 Tavily（与上传资料 RAG 并存） */
const EXTERNAL_SEARCH_PATTERN =
  /查外部|查找外部|外部资料|外部信息|外部检索|联网查|联网搜|网上搜|网上查查|网络搜索|上网查|检索外部|搜索外部|网上查|查实|核实|属不属实|是否属实|验证.{0,6}真实|交叉验证|交叉核验|帮我查|请查.*外部|web\s*search|tavily/i;

export function isExternalCapabilityQuestion(message: string): boolean {
  return EXTERNAL_CAPABILITY_PATTERN.test(message);
}

export function wantsExternalSearch(message: string): boolean {
  if (isExternalCapabilityQuestion(message)) return false;
  return EXTERNAL_SEARCH_PATTERN.test(message);
}

/** 写入 system，说明内外部依据分层（与合域 skills 外部调研精神一致，网站侧为对话级 Tavily） */
export function tavilyCapabilitySystemLines(configured: boolean): string[] {
  if (!configured) {
    return [
      "联网公开信息：当前未配置（TAVILY_API_KEY）。仍可基于【资料摘录】与合理推论作答；若用户需要网页核实，说明联网能力待开通，并建议其用明确表述发起检索或走 Hermes 完整调研流程。",
    ];
  }
  return [
    "联网公开信息：已接入 Tavily。用户消息含「查外部资料」「网上查查」「核实是否属实」等时，本轮会注入【外部检索】。",
    "若用户只问「能不能查外部」，回答：可以；请其用「查外部资料：具体主题」或「网上查查 xxx 是否属实」发起。勿称「永远不能上网」。",
    "若本轮含【外部检索】：须先用 [WEB:n]+URL 概括网页要点，再与【资料摘录】对照（一致/差异/待核）。勿写「我无法上网」「请您自行去官网查」。",
    "[ID:n] 仅指上传资料；[WEB:n] 仅指本轮网页检索。勿混淆演示用 [ID:1]～[ID:5] 与联网来源。",
  ];
}

type HistoryLine = { role: string; content: string };

/** 从近期对话抽取项目名/关键数字，避免「网上查查这个资料」这类空泛 query */
function enrichQueryFromHistory(q: string, history: HistoryLine[]): string {
  const blob = history
    .slice(-6)
    .map((m) => m.content)
    .join("\n");
  const project =
    blob.match(/南宁[\u4e00-\u9fa5]{0,24}智慧港|东盟生鲜[\u4e00-\u9fa5]{0,16}港/u)?.[0] ??
    blob.match(/南宁生鲜港|南宁生鲜智慧港/u)?.[0];
  const area =
    blob.match(/182[,，]?\s*834[\.\d]*/u)?.[0] ??
    blob.match(/\d{2,3}\.?\d*\s*万\s*平方米/u)?.[0];
  const parts = [project, area, q].filter(Boolean);
  return parts.join(" ").trim();
}

/** 去掉触发用语，保留实质检索词 */
export function buildTavilyQuery(
  message: string,
  fileHint = "",
  history: HistoryLine[] = [],
): string {
  let q = message
    .replace(
      /请?(务必|必须)?(用)?(网络|网上|外部|联网|在线)\s*(搜|查|搜索|检索|查查|查一下|查询|查找|搜一下)/gi,
      " ",
    )
    .replace(/查外部(资料|信息|检索)?/gi, " ")
    .replace(/这个|该份|上述|这份/g, " ")
    .replace(/资料属实吗|是否属实|属不属实/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 4) q = message.trim();
  if (/^(资料|属实|真假|核实|验证)$/u.test(q) || q.length < 12) {
    q = enrichQueryFromHistory(q, history);
  }
  if (fileHint.trim()) q = `${q} ${fileHint.trim()}`.trim();
  if (q.length < 8) q = enrichQueryFromHistory(message, history);
  return q.slice(0, 400);
}

export type TavilyHit = {
  title: string;
  url: string;
  content: string;
};

type TavilyResponse = {
  results?: {
    title?: string;
    url?: string;
    content?: string;
  }[];
  error?: string;
};

export async function searchTavily(
  apiKey: string,
  query: string,
  maxResults = 5,
): Promise<{ hits: TavilyHit[]; error?: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { hits: [], error: "未配置 TAVILY_API_KEY" };
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: Math.min(maxResults, 8),
      include_answer: false,
    }),
  });

  const rawText = await res.text();
  let raw: TavilyResponse = {};
  try {
    raw = rawText ? (JSON.parse(rawText) as TavilyResponse) : {};
  } catch {
    return { hits: [], error: `Tavily 返回非 JSON（HTTP ${res.status}）` };
  }

  if (!res.ok) {
    const err =
      raw.error ||
      (typeof raw === "object" && "detail" in raw
        ? String((raw as { detail?: string }).detail)
        : "") ||
      `Tavily HTTP ${res.status}`;
    return { hits: [], error: err };
  }

  const hits: TavilyHit[] = (raw.results ?? [])
    .map((r) => ({
      title: (r.title ?? "").trim() || "无标题",
      url: (r.url ?? "").trim(),
      content: (r.content ?? "").trim().slice(0, 1200),
    }))
    .filter((h) => h.url.length > 0);

  return { hits };
}

export function formatTavilyBlock(hits: TavilyHit[], error?: string): string {
  if (error) {
    return `（外部检索失败：${error}；请说明无法联网，可建议用户稍后重试或改查已上传资料。）`;
  }
  if (hits.length === 0) {
    return "（外部检索无结果；请说明未找到可靠网页来源，勿编造链接。）";
  }
  return hits
    .map(
      (h, i) =>
        `[WEB:${i + 1}] 标题：${h.title}\nURL：${h.url}\n摘要：${h.content || "（无摘要）"}`,
    )
    .join("\n\n---\n\n");
}
