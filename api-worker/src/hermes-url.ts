/** 规范化 Railway / Hermes 根地址，避免缺协议或粘贴错误导致 Invalid URL */
export function normalizeHermesBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/u, "");
  if (!base) return "";

  // 粘贴事故：字面量 undefined、多余引号、换行
  base = base.replace(/undefined/giu, "").replace(/ndefined/giu, "").replace(/["'\s]+/gu, "");
  // uhttps://、https://uhttps:// 等
  base = base.replace(/^u+(?=https?:\/\/)/iu, "");
  base = base.replace(/^(?:https?:\/\/)+(?:u+)?(?:https?:\/\/)+/iu, "https://");

  // 从污染字符串中提取 Railway 公网域名（如 …appndefined → …app）
  const railwayHost = base.match(/([a-z0-9-]+\.up\.railway\.app)/iu);
  if (railwayHost) {
    return `https://${railwayHost[1].toLowerCase()}`;
  }

  if (!/^https?:\/\//iu.test(base)) {
    base = `https://${base.replace(/^\/+/u, "")}`;
  }

  try {
    const u = new URL(base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}

/** 8642 API Server 根路径为域名本身；勿默认加 /api（Dashboard 代理时代才需要） */
export function resolveHermesApiRoot(base: string): string {
  return normalizeHermesBaseUrl(base).replace(/\/api$/iu, "");
}

export function hermesChatCompletionsUrl(base: string): string {
  const root = resolveHermesApiRoot(base);
  return root ? `${root}/v1/chat/completions` : "";
}

/** Hermes 原生为 /v1/...；部分 Railway 模板多一层 /api。优先裸路径（与 probe 一致）。 */
export function listHermesRunsBaseUrls(base: string): string[] {
  const root = normalizeHermesBaseUrl(base).replace(/\/+$/u, "");
  if (!root) return [];
  const bare = root.replace(/\/api$/iu, "");
  const withApi = `${bare}/api`;
  return [...new Set([bare, withApi])];
}

export function listHermesChatCompletionsUrls(base: string): string[] {
  return listHermesRunsBaseUrls(base).map((b) => `${b}/v1/chat/completions`);
}

export function listHermesRunsPostUrls(base: string): string[] {
  return listHermesRunsBaseUrls(base).map((b) => `${b}/v1/runs`);
}

export function listHermesRunPollUrls(base: string, runId: string): string[] {
  const enc = encodeURIComponent(runId);
  return listHermesRunsBaseUrls(base).map((b) => `${b}/v1/runs/${enc}`);
}

export function assertValidHermesBaseUrl(base: string): void {
  const normalized = normalizeHermesBaseUrl(base);
  if (!normalized) {
    throw new Error("HERMES_BASE_URL 为空");
  }
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("协议须为 http 或 https");
    }
  } catch {
    throw new Error(
      `HERMES_BASE_URL 无效：${base}。请使用完整地址，例如 https://hermes-agent-production-02eb.up.railway.app`,
    );
  }
}
