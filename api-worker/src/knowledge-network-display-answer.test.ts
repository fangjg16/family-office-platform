import { describe, expect, it } from "vitest";
import { stripStructuredKbPayloadFromDisplayAnswer } from "./knowledge-network-structured-kb-data";

describe("stripStructuredKbPayloadFromDisplayAnswer", () => {
  it("removes structured-kb-data fenced JSON but keeps prose summary", () => {
    const answer = `已基于《源天生物 BP》重建知识网络，成熟度综合 48%。

\`\`\`json
{
  "type": "structured-kb-data",
  "schemaVersion": "2.91",
  "summary": "内嵌摘要不应重复展示"
}
\`\`\``;

    expect(stripStructuredKbPayloadFromDisplayAnswer(answer)).toBe(
      "已基于《源天生物 BP》重建知识网络，成熟度综合 48%。",
    );
  });

  it("uses payload summary when prose is empty", () => {
    const answer = `\`\`\`json
{
  "type": "structured-kb-data",
  "summary": "仅 JSON 时的展示摘要"
}
\`\`\``;

    expect(stripStructuredKbPayloadFromDisplayAnswer(answer)).toBe("仅 JSON 时的展示摘要");
  });

  it("keeps unrelated json fences", () => {
    const answer = `说明文字

\`\`\`json
{ "type": "other", "value": 1 }
\`\`\``;

    expect(stripStructuredKbPayloadFromDisplayAnswer(answer)).toContain('"type": "other"');
  });
});
