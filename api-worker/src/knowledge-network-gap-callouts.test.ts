import { describe, expect, it } from "vitest";
import { normalizeGapCallouts } from "./knowledge-network-gap-callouts";
import { normalizeSlotPayload } from "./knowledge-network-slot-normalizer";
import { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";

describe("normalizeGapCallouts", () => {
  it("coerces string to single gap callout", () => {
    expect(normalizeGapCallouts("资料不足")).toEqual([
      { text: "资料不足", confidence: "gap" },
    ]);
  });

  it("returns [] for null/undefined", () => {
    expect(normalizeGapCallouts(null)).toEqual([]);
    expect(normalizeGapCallouts(undefined)).toEqual([]);
  });

  it("keeps array items", () => {
    const arr = [{ text: "缺口 A", confidence: "low" as const }];
    expect(normalizeGapCallouts(arr)).toEqual(arr);
  });
});

describe("gaps string render", () => {
  it("renders timeline slot with string gaps without gaps.map throw", () => {
    const raw = {
      occurred: [{ date: "2026-01-01", title: "签约", detail: "—", phase: "occurred" }],
      inProgress: [],
      future: [],
      gaps: "项目级时间轴仍有资料缺口",
    };
    const norm = normalizeSlotPayload("timeline-milestones", raw);
    expect(norm.payload.gaps).toEqual([
      { text: "项目级时间轴仍有资料缺口", confidence: "gap" },
    ]);
    expect(() => renderSlotPayloadByCanonicalSlot("timeline-milestones", raw)).not.toThrow();
    const html = renderSlotPayloadByCanonicalSlot("timeline-milestones", raw);
    expect(html).toContain("缺乏资料");
    expect(html).toContain("项目级时间轴仍有资料缺口");
  });
});
