import { describe, expect, it } from "vitest";
import { auditCodexParity, CODEX_SLOT_COMPONENT_MARKERS } from "./knowledge-network-codex-parity";
import { adaptStructuredKbDataFromCodexKeys } from "./knowledge-network-codex-payload-adapter";
import { computeSlotEvidenceMaturity } from "./knowledge-network-slot-evidence-maturity";
import { buildCodexParityFixture } from "./fixtures/codex-parity-structured-kb";
import { applyDeterministicMaturity } from "./knowledge-network-deterministic-maturity";
import { renderFullStructuredKnowledgeNetwork } from "./knowledge-network-full-renderer";
import { evaluateStructuredKbPublishGate } from "./knowledge-network-structured-kb-data";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";

describe("Codex v2.93 parity", () => {
  const fixture = buildCodexParityFixture();

  it("adapts Codex legacy keys to Worker canonical payload", () => {
    const normalized = adaptStructuredKbDataFromCodexKeys(fixture);
    const snap = normalized.slots.snapshot;
    expect(snap.keyFacts?.length).toBeGreaterThan(0);

    const biz = normalized.slots["business-operations"];
    expect(biz.journeyMap?.stages?.length).toBeGreaterThanOrEqual(3);
    expect(biz.customerBuyer?.length).toBeGreaterThan(0);

    const val = normalized.slots["valuation-returns"];
    expect(val.benchmarkMetrics?.length).toBeGreaterThan(0);
    expect(val.cashflowGaps?.length).toBeGreaterThan(0);
  });

  it("renders slot components aligned with Codex render_kb_html.py semantics", () => {
    for (const slot of CANONICAL_KB_SLOTS) {
      const html = renderSlotPayloadByCanonicalSlot(slot, fixture.slots[slot]);
      for (const re of CODEX_SLOT_COMPONENT_MARKERS[slot]) {
        expect(html, `${slot} missing ${re}`).toMatch(re);
      }
    }

    const bizHtml = renderSlotPayloadByCanonicalSlot(
      "business-operations",
      fixture.slots["business-operations"],
    );
    expect(bizHtml).toContain("journey-wrap");

    const valHtml = renderSlotPayloadByCanonicalSlot(
      "valuation-returns",
      fixture.slots["valuation-returns"],
    );
    expect(valHtml).toContain("scenario-cards");
    expect(valHtml).toContain("valuation-box");

    const dilHtml = renderSlotPayloadByCanonicalSlot("diligence-gaps", fixture.slots["diligence-gaps"]);
    expect(dilHtml).toContain("oq-group");

    const tlHtml = renderSlotPayloadByCanonicalSlot(
      "timeline-milestones",
      fixture.slots["timeline-milestones"],
    );
    expect(tlHtml).toContain("PROJECT TIMELINE");
    expect(tlHtml).toMatch(/缺乏资料|暂无已记录的项目级/);
  });

  it("full HTML passes Codex parity audit (13 slots, appendices, maturity, citations)", () => {
    const html = renderFullStructuredKnowledgeNetwork(applyDeterministicMaturity(fixture), {
      versionDisplay: "v1",
    });
    const report = auditCodexParity(html);

    if (!report.ok) {
      console.log(report.violations);
    }

    expect(report.checks.schemaVersion).toBe(true);
    expect(report.checks.kbShell).toBe(true);
    expect(report.checks.maturity_labels).toBe(true);
    expect(report.checks.maturity_percentages).toBe(true);
    expect(report.checks.citations).toBe(true);
    for (const slot of CANONICAL_KB_SLOTS) {
      expect(report.checks[`slot_${slot}`], slot).toBe(true);
    }
    expect(report.checks["appendix_source-index"]).toBe(true);
    expect(report.checks["appendix_glossary"]).toBe(true);
    expect(report.ok, report.violations.map((v) => v.message).join("; ")).toBe(true);
  });

  it("gap-first fixture passes publish hard gate but keeps Factor A low", () => {
    const normalized = adaptStructuredKbDataFromCodexKeys(fixture);
    const gate = evaluateStructuredKbPublishGate(normalized);
    expect(gate.ok, gate.ok ? "" : "message" in gate ? gate.message : "").toBe(true);

    const maturity = computeSlotEvidenceMaturity(normalized);
    expect(maturity.score).toBeLessThan(45);
    expect(maturity.capsApplied.length).toBeGreaterThan(3);
  });
});
