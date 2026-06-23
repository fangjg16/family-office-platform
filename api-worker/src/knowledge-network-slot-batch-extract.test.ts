import { describe, expect, it } from "vitest";
import { extractStructuredSlotBatchFromAnswer } from "./knowledge-network-slot-batch-extract";

describe("extractStructuredSlotBatchFromAnswer", () => {
  it("accepts batch 2 envelope with slots object", () => {
    const answer = `\`\`\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "full",
  "batchIndex": 1,
  "summary": "test",
  "slots": {
    "legal-ownership": {
      "entities": [{ "主体/权利": "待确认", "角色/归属": "—", "限制/负担": "—", "证据/缺口": "—" }],
      "unresolvedLegalIssues": []
    }
  }
}
\`\`\``;
    const r = extractStructuredSlotBatchFromAnswer(answer);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.batch.slots).toHaveLength(1);
      expect(r.batch.slots[0]?.slot).toBe("legal-ownership");
      expect(r.batch.mode).toBe("full");
      expect(r.batch.batchIndex).toBe(1);
    }
  });

  it("recognizes status blocked", () => {
    const answer = `\`\`\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "full",
  "batchIndex": 1,
  "status": "blocked",
  "blockedReason": "缺合同原件",
  "summary": "无法修复",
  "slots": {}
}
\`\`\``;
    const r = extractStructuredSlotBatchFromAnswer(answer);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.blocked).toBe(true);
      expect(r.blockedReason).toContain("缺合同");
    }
  });
});
