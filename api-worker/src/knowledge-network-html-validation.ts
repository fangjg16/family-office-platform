import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

export type KnHtmlValidationOptions = {
  mode?: KnowledgeNetworkUpdateMode;
  previousHtml?: string | null;
};

export type KnHtmlValidationResult = {
  ok: boolean;
  error?: string;
  warning?: string;
};

const MAX_KN_HTML_BYTES = 2_500_000;

/** reorder 模式下允许的正文体积波动比例（超出则拒绝） */
const REORDER_MAX_LENGTH_DRIFT_RATIO = 0.08;

export function validateKnowledgeNetworkHtml(
  html: string,
  options?: KnHtmlValidationOptions,
): KnHtmlValidationResult {
  const t = html.trim();
  if (t.length < 200) {
    return { ok: false, error: "HTML 过短（少于 200 字符）" };
  }
  if (t.length > MAX_KN_HTML_BYTES) {
    return { ok: false, error: "HTML 超过 2.5MB 上限" };
  }
  if (!/<!DOCTYPE\s+html/i.test(t) && !/<html[\s>]/i.test(t)) {
    return { ok: false, error: "须为完整 HTML（含 <!DOCTYPE html> 或 <html>）" };
  }
  if (!/kb-shell/i.test(t)) {
    return { ok: false, error: "缺少 kb-shell 容器（非知识网络单页）" };
  }
  if (!/<!--\s*KB-CONFIG/i.test(t)) {
    return {
      ok: false,
      error: "缺少 <!-- KB-CONFIG --> 块（v2.7 必填：display-order、project-type 等）",
    };
  }
  const hasCanonicalAnchor =
    /id=["']snapshot["']/i.test(t) ||
    /id=["']assets["']/i.test(t) ||
    /#snapshot\b/i.test(t) ||
    /#assets\b/i.test(t);
  if (!hasCanonicalAnchor) {
    return { ok: false, error: "缺少 canonical slot 锚点（如 id=\"snapshot\"）" };
  }

  if (options?.mode === "reorder" && options.previousHtml) {
    const prev = options.previousHtml.trim();
    if (prev.length > 0) {
      const drift = Math.abs(t.length - prev.length) / prev.length;
      if (drift > REORDER_MAX_LENGTH_DRIFT_RATIO) {
        return {
          ok: false,
          error: `重排模式下 HTML 体积变化 ${(drift * 100).toFixed(1)}%，疑似改写了内容面板（仅允许调整 KB-CONFIG/nav/编号）`,
        };
      }
    }
  }

  return { ok: true };
}
