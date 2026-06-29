import { describe, expect, it } from "vitest";
import {
  normalizeFragmentCitations,
  rewriteFragmentHtmlCitations,
} from "./knowledge-network-fragment-citations";

const CITE = (id: string) =>
  `<sup class="cite-ref"><a href="#source-${id}">[${id}]</a></sup>`;

describe("knowledge-network-fragment-citations", () => {
  it("rewrites proposal sourceKey to assigned U/A id", () => {
    const html =
      '<section id="snapshot"><a href="#source-prop-bp">BP</a></section>';
    const out = rewriteFragmentHtmlCitations(html, { "prop-bp": "U-2" });
    expect(out).toContain("#source-U-2");
    expect(out).not.toContain("prop-bp");
  });

  it("normalizes bare #source-A-1 to cite-ref", () => {
    const html = "<td>产能数据 #source-A-1</td>";
    expect(normalizeFragmentCitations(html)).toBe(`<td>产能数据 ${CITE("A-1")}</td>`);
  });

  it("normalizes parenthesized (#source-A-1)", () => {
    const html = "<td>依据 (#source-U-7)</td>";
    expect(normalizeFragmentCitations(html)).toBe(`<td>依据 ${CITE("U-7")}</td>`);
  });

  it("normalizes bare [A-1] and #U-1", () => {
    const html = "<td>BP #U-1 · 公开 [A-2]</td>";
    const out = normalizeFragmentCitations(html);
    expect(out).toContain(CITE("U-1"));
    expect(out).toContain(CITE("A-2"));
  });

  it("wraps unstyled source links", () => {
    const html = '<td><a href="#source-A-3">A-3</a></td>';
    expect(normalizeFragmentCitations(html)).toBe(`<td>${CITE("A-3")}</td>`);
  });

  it("does not double-wrap existing cite-ref", () => {
    const html = `<td>${CITE("A-1")}</td>`;
    expect(normalizeFragmentCitations(html)).toBe(html);
  });

  it("supports suffix ids like A-10b and S12", () => {
    const html = "<td>#source-A-10b · [S12]</td>";
    const out = normalizeFragmentCitations(html);
    expect(out).toContain(CITE("A-10b"));
    expect(out).toContain(CITE("S12"));
  });

  it("rewrites proposal then normalizes to cite-ref", () => {
    const html = '<section id="snapshot"><td>#source-prop-bp</td></section>';
    const rewritten = rewriteFragmentHtmlCitations(html, { "prop-bp": "U-2" });
    const out = normalizeFragmentCitations(rewritten);
    expect(out).toContain(CITE("U-2"));
    expect(out).not.toContain(">#source-U-2<");
  });
});
