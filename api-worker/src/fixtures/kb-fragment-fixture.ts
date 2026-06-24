import { adaptStructuredKbDataFromCodexKeys } from "../knowledge-network-codex-payload-adapter";
import { applyDeterministicMaturity } from "../knowledge-network-deterministic-maturity";
import { renderFullStructuredKnowledgeNetwork } from "../knowledge-network-full-renderer";
import { CANONICAL_KB_SLOTS, KB_APPENDIX_SLOTS } from "../knowledge-network-html-validation";
import { extractSectionHtmlById } from "../knowledge-network-fragment-validation";
import type { KbFragmentAssemblyInput } from "../knowledge-network-fragment-types";
import { buildCodexParityFixture } from "./codex-parity-structured-kb";

/** 从 structured 渲染 HTML 抽取 fragment，供 D1 assembler 单测使用 */
export function buildKbFragmentFixtureFromCodexParity(): {
  input: KbFragmentAssemblyInput;
  referenceHtml: string;
} {
  const fixture = applyDeterministicMaturity(
    adaptStructuredKbDataFromCodexKeys(buildCodexParityFixture()),
  );
  const referenceHtml = renderFullStructuredKnowledgeNetwork(fixture, {
    versionDisplay: "v1",
  });

  const fragments: KbFragmentAssemblyInput["fragments"] = {};
  for (const slot of CANONICAL_KB_SLOTS) {
    const section = extractSectionHtmlById(referenceHtml, slot);
    if (!section) {
      throw new Error(`fixture 缺少 section: ${slot}`);
    }
    fragments[slot] = section;
  }

  const glossary = extractSectionHtmlById(referenceHtml, "glossary");
  const dataDictionary = extractSectionHtmlById(referenceHtml, "data-dictionary");
  if (!glossary || !dataDictionary) {
    throw new Error("fixture 缺少 appendix B/C");
  }

  for (const slot of KB_APPENDIX_SLOTS) {
    if (slot === "source-index" || slot === "glossary" || slot === "data-dictionary") continue;
    if (!extractSectionHtmlById(referenceHtml, slot)) {
      throw new Error(`fixture 缺少 appendix section: ${slot}`);
    }
  }

  return {
    referenceHtml,
    input: {
      shell: {
        mode: fixture.mode,
        schemaVersion: fixture.schemaVersion,
        summary: fixture.summary,
        config: fixture.config,
        meta: fixture.meta,
        maturity: fixture.maturity,
        sources: fixture.sources,
      },
      fragments,
      appendixFragments: {
        glossary,
        "data-dictionary": dataDictionary,
      },
    },
  };
}
