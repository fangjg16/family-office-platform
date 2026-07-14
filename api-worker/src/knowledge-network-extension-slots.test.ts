import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSlotRegistryFromKnowledgeNetworkHtml } from "./knowledge-network-kb-config";
import { resolveKnTouchedSlotsFromMessage } from "./knowledge-network-slot-aliases";
import {
  applyKbFragmentIncrementalToKnowledgeNetworkHtml,
  extractKbFragmentIncrementalFromAnswer,
  shouldUseKbFragmentIncrementalMode,
  validateMergedKnowledgeNetworkAfterFragmentIncremental,
} from "./knowledge-network-fragment-incremental";
import { extractSectionHtmlById } from "./knowledge-network-fragment-validation";
import {
  validateKnowledgeNetworkHtmlForWrite,
} from "./knowledge-network-html-validation";

const V11_FIXTURE_PATH =
  "c:/Users/jensenfang/Downloads/[AI] 演员AI版权投资_知识网络_v11_20260625.html";

function loadV11Fixture(): string | null {
  try {
    return readFileSync(V11_FIXTURE_PATH, "utf8");
  } catch {
    return null;
  }
}

describe("extension slots · scheme B", () => {
  const v11 = loadV11Fixture();

  it("parses v11 extension slots from display-order", () => {
    if (!v11) return;
    const registry = buildSlotRegistryFromKnowledgeNetworkHtml(v11);
    expect(registry.hasExtensions).toBe(true);
    expect(registry.extensions).toEqual([
      "short-drama-heat-analysis",
      "actor-asset-screen",
      "producer-analysis",
      "brand-analysis",
    ]);
    expect(registry.displayOrder.length).toBe(17);
  });

  it("browser upload validation accepts v11 extended KB", () => {
    if (!v11) return;
    const registry = buildSlotRegistryFromKnowledgeNetworkHtml(v11);
    const result = validateKnowledgeNetworkHtmlForWrite(v11, {
      mode: "full",
      strict: true,
      browserUpload: true,
      slotRegistry: registry,
    });
    expect(result.ok, result.error).toBe(true);
  });

  it("resolves extension slot from Chinese message", () => {
    const registry = v11
      ? buildSlotRegistryFromKnowledgeNetworkHtml(v11)
      : {
          displayOrder: [
            "snapshot",
            "target-overview",
            "industry-market",
            "short-drama-heat-analysis",
            "actor-asset-screen",
            "producer-analysis",
            "brand-analysis",
            "business-operations",
            "legal-ownership",
            "regulatory-compliance",
            "resource-network",
            "comps-benchmark",
            "valuation-returns",
            "diligence-gaps",
            "risks-mitigation",
            "timeline-milestones",
            "decision-framework",
          ],
          extensions: [
            "short-drama-heat-analysis",
            "actor-asset-screen",
            "producer-analysis",
            "brand-analysis",
          ],
          canonical: [] as never,
          projectType: "opportunistic",
          hasExtensions: true,
        };

    const slots = resolveKnTouchedSlotsFromMessage("请更新短剧热度分析板块", registry);
    expect(slots).toEqual(["short-drama-heat-analysis"]);
    expect(
      shouldUseKbFragmentIncrementalMode("fragment", "incremental", slots, registry),
    ).toBe(true);
  });

  it("applies extension slot incremental patch on v11", () => {
    if (!v11) return;
    const registry = buildSlotRegistryFromKnowledgeNetworkHtml(v11);
    const slot = "short-drama-heat-analysis";
    const original = extractSectionHtmlById(v11, slot);
    expect(original).toBeTruthy();

    const patched = original!.replace(
      "kb-panel",
      "kb-panel extension-patched",
    );

    const answer = [
      "更新了短剧热度分析。",
      "```json",
      JSON.stringify({
        type: "kb-fragment-batch",
        schemaVersion: "2.91",
        mode: "incremental",
        batchIndex: 0,
        summary: `仅更新 ${slot}`,
        fragments: { [slot]: patched },
      }),
      "```",
    ].join("\n");

    const extracted = extractKbFragmentIncrementalFromAnswer(answer, slot);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const applied = applyKbFragmentIncrementalToKnowledgeNetworkHtml(
      v11,
      extracted.batch,
      extracted.slot,
      extracted.sectionHtml,
    );
    expect(applied.ok, applied.ok ? "" : applied.error).toBe(true);
    if (!applied.ok) return;

    expect(applied.html).toContain("extension-patched");

    const validation = validateMergedKnowledgeNetworkAfterFragmentIncremental(applied.html, {
      previousHtml: v11,
      slot,
      slotRegistry: registry,
    });
    expect(validation.ok, validation.error).toBe(true);
  });
});
