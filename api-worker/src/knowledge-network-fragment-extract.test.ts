import { describe, expect, it } from "vitest";
import { parseJsonLoose } from "./knowledge-network-json-parse-loose";
import { extractKbFragmentBatchFromAnswer } from "./knowledge-network-fragment-extract";
import { KB_FRAGMENT_BATCH_TYPE } from "./knowledge-network-fragment-types";

describe("parseJsonLoose", () => {
  it("parses valid JSON without repair", () => {
    const r = parseJsonLoose('{"a":1}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.repaired).toBe(false);
    expect(r.value).toEqual({ a: 1 });
  });

  it("repairs trailing comma before closing brace", () => {
    const r = parseJsonLoose('{"a":1,}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.repaired).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });
});

describe("extractKbFragmentBatchFromAnswer jsonrepair", () => {
  it("extracts batch when fragment HTML has unescaped quotes (jsonrepair)", () => {
    const broken = [
      "{",
      '  "type": "kb-fragment-batch",',
      '  "schemaVersion": "2.91",',
      '  "mode": "full",',
      '  "batchIndex": 0,',
      '  "fragments": {',
      '    "snapshot": "<section class=\\"block kb-panel\\" id=\\"snapshot\\"><p>ok</p></section>"',
      "  },",
      '  "appendixFragments": { "glossary": null, "data-dictionary": null }',
      "}",
    ].join("\n");
    // Simulate Hermes mistake: inner quotes not escaped
    const hermesBroken = broken.replace(/\\"/g, '"');

    const answer = `摘要\n\`\`\`json\n${hermesBroken}\n\`\`\``;
    const extracted = extractKbFragmentBatchFromAnswer(answer);
    expect(extracted.ok, extracted.ok ? "" : extracted.reason).toBe(true);
    if (!extracted.ok) return;
    expect(extracted.batch.type).toBe(KB_FRAGMENT_BATCH_TYPE);
    expect(extracted.jsonRepaired).toBe(true);
    expect(extracted.batch.fragments.snapshot).toContain('id="snapshot"');
  });
});
