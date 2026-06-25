import { describe, expect, it } from "vitest";
import {
  buildCanonicalSectionTitle,
  normalizeFragmentSectionHtml,
  sanitizeDocumentExcerpt,
} from "./knowledge-network-fragment-normalize";
import { validateCanonicalSlotFragment } from "./knowledge-network-fragment-validation";

describe("knowledge-network-fragment-normalize", () => {
  it("strips PDF extraction header from excerpt", () => {
    const raw =
      "【源天生物bp 2026年4月 简版.pdf · PDF 提取正文】 源天生物科技（天津）有限公司 废弃PET";
    expect(sanitizeDocumentExcerpt(raw, 80)).toBe("源天生物科技（天津）有限公司 废弃PET");
  });

  it("replaces plain h2 with canonical Chinese numeral title", () => {
    const bad =
      '<section class="block kb-panel" id="business-operations">' +
      "<h2>业务模式与运营假设</h2><table><tr><td>x</td></tr></table></section>";
    const fixed = normalizeFragmentSectionHtml("business-operations", bad);
    expect(fixed).toContain('section-num">四</span>业务模式与运营假设');
    expect(fixed).not.toContain("<h2>业务模式");
  });

  it("removes maturity grade leak after title", () => {
    const bad =
      '<section id="timeline-milestones" class="block kb-panel">' +
      '<h2 class="section-title"><span class="section-num">十二</span>项目时间轴</h2>' +
      "<p>C · 22% 单一 BP 提及节点</p>" +
      '<div class="timeline project-timeline"><div class="tl-item"><span class="tl-date">2023</span><span class="tl-text">x</span></div></div>' +
      "</section>";
    const fixed = normalizeFragmentSectionHtml("timeline-milestones", bad);
    expect(fixed).not.toMatch(/C\s*·\s*22%/);
  });

  it("L1 rejects risks without risk-level class", () => {
    const html =
      '<section id="risks-mitigation" class="block kb-panel">' +
      buildCanonicalSectionTitle("risks-mitigation") +
      "<table><tr><td>🔴</td><td>风险</td></tr></table></section>";
    const result = validateCanonicalSlotFragment("risks-mitigation", html);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.level).toBe("L1");
  });
});
