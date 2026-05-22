/** 用户明确要求查外部 / 联网时触发 Tavily（与上传资料 RAG 并存） */
const EXTERNAL_SEARCH_PATTERN =
  /查外部|外部资料|外部信息|外部检索|联网查|联网搜|网上搜|网络搜索|上网查|检索外部|搜索外部|网上查|web\s*search|tavily/i;

export function wantsExternalSearch(message: string): boolean {
  return EXTERNAL_SEARCH_PATTERN.test(message);
}

/** 去掉触发用语，保留实质检索词 */
export function buildTavilyQuery(message: string, fileHint = ""): string {
  let q = message
    .replace(
      /请?(务必|必须)?(用)?(网络|网上|外部|联网|在线).*?(搜索|检索|查一下|查询|查找|搜一下)/gi,
      " ",
    )
    .replace(/查外部(资料|信息|检索)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 4) q = message.trim();
  if (fileHint.trim()) q = `${q} ${fileHint.trim()}`.trim();
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
