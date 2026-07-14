import { describe, expect, it } from "vitest";
import {
  extractSnapshotOverviewFallback,
  sanitizeDocumentExcerpt,
} from "./knowledge-network-fragment-normalize";
import { validateCanonicalSlotFragment } from "./knowledge-network-fragment-validation";

describe("knowledge-network-fragment-normalize", () => {
  it("strips PDF extraction header from excerpt", () => {
    const raw =
      "【源天生物bp 2026年4月 简版.pdf · PDF 提取正文】 源天生物科技（天津）有限公司 废弃PET";
    expect(sanitizeDocumentExcerpt(raw, 80)).toBe("源天生物科技（天津）有限公司 废弃PET");
  });

  it("extracts snapshot callout as overview fallback", () => {
    const html =
      '<section id="snapshot"><aside class="callout info"><div class="callout-title">一句话判断</div><p>酶法 rPET 项目处于产业化前期。</p></aside></section>';
    const out = extractSnapshotOverviewFallback(html);
    expect(out.lead).toContain("酶法 rPET");
    expect(out.autoSummary).toContain("产业化前期");
  });

  it("validates envelope without rewriting h2", () => {
    const html =
      '<section class="block kb-panel" id="business-operations">' +
      "<h2>业务模式与运营假设</h2><table><tr><td>x</td><td>y</td><td>z</td><td>w</td></tr></table></section>";
    const result = validateCanonicalSlotFragment("business-operations", html);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.html).toContain("<h2>业务模式");
  });
});
