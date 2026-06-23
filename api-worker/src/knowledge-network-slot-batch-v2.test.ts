import { describe, expect, it } from "vitest";
import { mergeSourceProposalsIntoRegistry } from "./knowledge-network-source-proposals";
import { stripStructuredKbPayloadFromDisplayAnswer } from "./knowledge-network-structured-kb-data";

describe("mergeSourceProposalsIntoRegistry", () => {
  it("dedupes proposals by title and assigns new ids", () => {
    const base = [{ id: "U-1", type: "用户上传", title: "BP.pdf" }];
    const { registry, added } = mergeSourceProposalsIntoRegistry(base, [
      {
        batchIndex: 1,
        proposals: [
          { type: "用户上传", title: "BP.pdf", sourceKey: "prop-bp" },
          { type: "第三方", title: "行业研报 2025", sourceKey: "prop-report" },
        ],
      },
    ]);
    expect(added).toBe(1);
    expect(registry).toHaveLength(2);
    expect(registry.some((s) => s.title === "行业研报 2025")).toBe(true);
  });
});

describe("slot-batch v2 display strip", () => {
  it("still strips structured-slot-batch json from chat", () => {
    const answer = `完成\n\`\`\`json\n{"type":"structured-slot-batch","batchIndex":1}\n\`\`\``;
    expect(stripStructuredKbPayloadFromDisplayAnswer(answer)).toBe("完成");
  });
});
