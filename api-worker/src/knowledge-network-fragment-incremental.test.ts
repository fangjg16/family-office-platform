import { describe, expect, it } from "vitest";
import { buildKbFragmentFixtureFromCodexParity } from "./fixtures/kb-fragment-fixture";
import {
  applyKbFragmentIncrementalToKnowledgeNetworkHtml,
  extractKbFragmentIncrementalFromAnswer,
  parseStructuredKbSourcesFromAppendixA,
  shouldUseKbFragmentIncrementalMode,
} from "./knowledge-network-fragment-incremental";
import { extractSectionHtmlById } from "./knowledge-network-fragment-validation";
import { validateMergedKnowledgeNetworkAfterFragmentIncremental } from "./knowledge-network-fragment-incremental";

describe("kb-fragment incremental (D6)", () => {
  const { referenceHtml } = buildKbFragmentFixtureFromCodexParity();

  it("shouldUseKbFragmentIncrementalMode when fragment + single slot", () => {
    expect(
      shouldUseKbFragmentIncrementalMode("fragment", "incremental", ["business-operations"]),
    ).toBe(true);
    expect(
      shouldUseKbFragmentIncrementalMode("structured", "incremental", ["business-operations"]),
    ).toBe(false);
    expect(shouldUseKbFragmentIncrementalMode("fragment", "incremental", [])).toBe(false);
  });

  it("parses Appendix A sources from reference HTML", () => {
    const sources = parseStructuredKbSourcesFromAppendixA(referenceHtml);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((s) => /^U-\d+$/.test(s.id) || /^A-\d+$/.test(s.id))).toBe(true);
  });

  it("applies single-slot kb-fragment-batch incremental patch", () => {
    const slot = "business-operations" as const;
    const original = extractSectionHtmlById(referenceHtml, slot);
    expect(original).toBeTruthy();

    const patchedSection = original!.replace(
      "journey-wrap",
      "journey-wrap patched-incremental",
    );

    const answer = [
      "更新了业务模式板块。",
      "```json",
      JSON.stringify({
        type: "kb-fragment-batch",
        schemaVersion: "2.91",
        mode: "incremental",
        batchIndex: 0,
        summary: "仅更新 business-operations",
        fragments: { [slot]: patchedSection },
      }),
      "```",
    ].join("\n");

    const extracted = extractKbFragmentIncrementalFromAnswer(answer, slot);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const applied = applyKbFragmentIncrementalToKnowledgeNetworkHtml(
      referenceHtml,
      extracted.batch,
      extracted.slot,
      extracted.sectionHtml,
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.html).toContain("patched-incremental");
    expect(applied.html).not.toEqual(referenceHtml);

    const validation = validateMergedKnowledgeNetworkAfterFragmentIncremental(applied.html, {
      previousHtml: referenceHtml,
      slot,
    });
    expect(validation.ok).toBe(true);
  });

  it("rejects wrong slot in incremental batch", () => {
    const answer = `\`\`\`json
{"type":"kb-fragment-batch","schemaVersion":"2.91","mode":"incremental","batchIndex":0,"fragments":{"snapshot":"<section id=\\"snapshot\\"></section>"}}
\`\`\``;
    const result = extractKbFragmentIncrementalFromAnswer(answer, "business-operations");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("business-operations");
  });
});
