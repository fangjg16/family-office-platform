import { describe, expect, it } from "vitest";
import { auditCodexParity } from "./knowledge-network-codex-parity";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import { assembleKbFromFragments } from "./knowledge-network-fragment-assembler";
import {
  buildFragmentRegistryContext,
  validateCanonicalSlotFragment,
} from "./knowledge-network-fragment-validation";
import { validateKnowledgeNetworkHtmlForWrite } from "./knowledge-network-html-validation";
import { buildKbFragmentFixtureFromCodexParity } from "./fixtures/kb-fragment-fixture";
import { KB_FRAGMENT_BATCH_TYPE } from "./knowledge-network-fragment-types";

describe("kb-fragment D1 assembler", () => {
  const { input, referenceHtml } = buildKbFragmentFixtureFromCodexParity();

  it("assembles 13 fragments + appendix B/C into strict-valid HTML", () => {
    const assembled = assembleKbFromFragments(input, { versionDisplay: "v1" });
    expect(assembled.ok, assembled.ok ? "" : assembled.error).toBe(true);
    if (!assembled.ok) return;

    const strict = validateKnowledgeNetworkHtmlForWrite(assembled.html, {
      mode: "full",
      strict: true,
    });
    expect(strict.ok, strict.error).toBe(true);

    const parity = auditCodexParity(assembled.html);
    expect(parity.checks.kbShell).toBe(true);
    expect(parity.checks.schemaVersion).toBe(true);
  });

  it("assembled HTML preserves all canonical section ids", () => {
    const assembled = assembleKbFromFragments(input, { versionDisplay: "v1" });
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    for (const slot of Object.keys(input.fragments)) {
      expect(assembled.html).toMatch(new RegExp(`id=["']${slot}["']`, "i"));
    }
    expect(assembled.html).toContain('id="glossary"');
    expect(assembled.html).toContain('id="data-dictionary"');
    expect(assembled.html).toContain("fragment-full | Worker assemble");
  });

  it("rejects fragment with forbidden shell markup (L1)", () => {
    const bad = { ...input.fragments.snapshot! };
    const result = validateCanonicalSlotFragment(
      "snapshot",
      `<section id="snapshot"><html><body>${bad}</body></html></section>`,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.level).toBe("L1");
  });

  it("rejects orphan source citation (L2)", () => {
    const registry = buildFragmentRegistryContext([{ id: "U-1" }]);
    const html =
      `<section class="block kb-panel" id="snapshot">` +
      `<p>引用 <a href="#source-Z-99">Z-99</a> 与足够长的占位正文用于通过 L3 最小长度检测。</p>` +
      `</section>`;
    const result = validateCanonicalSlotFragment("snapshot", html, registry);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.level).toBe("L2");
  });

  it("extracts kb-fragment-batch JSON from fenced answer", () => {
    const answer = [
      "本批完成 snapshot 与 target-overview。",
      "```json",
      JSON.stringify({
        type: KB_FRAGMENT_BATCH_TYPE,
        schemaVersion: "2.91",
        mode: "full",
        batchIndex: 0,
        fragments: {
          snapshot: input.fragments.snapshot,
          "target-overview": input.fragments["target-overview"],
        },
        appendixFragments: { glossary: null, "data-dictionary": null },
        summary: "batch 0",
      }),
      "```",
    ].join("\n");

    const extracted = extractKbFragmentBatchFromAnswer(answer);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.batch.batchIndex).toBe(0);
    expect(Object.keys(extracted.batch.fragments)).toHaveLength(2);
  });

  it("fails assemble when a canonical slot is missing", () => {
    const partial = {
      ...input,
      fragments: { ...input.fragments },
    };
    delete partial.fragments["decision-framework"];
    const assembled = assembleKbFromFragments(partial, { versionDisplay: "v1" });
    expect(assembled.ok).toBe(false);
    if (assembled.ok) return;
    expect(assembled.missingSlots).toContain("decision-framework");
  });

  it("reference structured render remains available as parity baseline", () => {
    expect(referenceHtml).toContain('class="kb-shell"');
    expect(referenceHtml).toContain('id="snapshot"');
  });
});
