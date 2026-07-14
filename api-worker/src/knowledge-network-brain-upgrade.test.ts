import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_KB_DEEP_REF_FILES } from "./knowledge-network-deep-refs";
import { countFragmentBatchDeepRefs } from "./knowledge-network-fragment-batch-reads";
import { scoreFragmentHtmlEvidence } from "./knowledge-network-fragment-maturity";
import { resolveWorkflowDepthRoutes } from "./knowledge-network-workflow-routing";
import {
  KN_MATURITY_POLICY_LINES,
  KN_PUBLIC_SEARCH_POLICY_LINES,
} from "./knowledge-network-kn-policy";

describe("codex→hermes workflow map drift", () => {
  it("map lists 26 workflows + schema 2.91", () => {
    const path = join(
      process.cwd(),
      "..",
      "hermes-railway",
      "codex-hermes-workflow-map.v293.json",
    );
    const map = JSON.parse(readFileSync(path, "utf8")) as {
      kbSchemaVersion: string;
      workflows: { id: string }[];
    };
    expect(map.kbSchemaVersion).toBe("2.91");
    expect(map.workflows).toHaveLength(26);
  });
});

describe("kn policy unification", () => {
  it("public search policy forbids fabricating project facts", () => {
    expect(KN_PUBLIC_SEARCH_POLICY_LINES).toContain("禁止");
    expect(KN_PUBLIC_SEARCH_POLICY_LINES).toContain("允许");
    expect(KN_MATURITY_POLICY_LINES).toContain("Worker");
  });
});

describe("fragment deep-ref count", () => {
  it("reports union size for industry batch (not capped at 2)", () => {
    const n = countFragmentBatchDeepRefs([
      "snapshot",
      "target-overview",
      "industry-market",
    ]);
    expect(n).toBeGreaterThan(2);
    expect(n).toBeLessThanOrEqual(DEFAULT_KB_DEEP_REF_FILES.length);
  });
});

describe("fragment maturity scoring", () => {
  it("caps gap-heavy stubs", () => {
    const html =
      '<section id="snapshot" class="worker-gap-stub"><p>缺乏资料</p></section>';
    expect(scoreFragmentHtmlEvidence(html)).toBeLessThan(20);
  });

  it("scores richer evidence higher", () => {
    const html = `<section id="valuation-returns"><table><tr><td>IRR 18%</td><td>source-U-1</td></tr></table><div class="valuation-grid">MOIC 2.1x</div></section>`;
    expect(scoreFragmentHtmlEvidence(html)).toBeGreaterThan(40);
  });
});

describe("workflow depth routing", () => {
  it("loads comp-analysis when comps evidence thin", () => {
    const routes = resolveWorkflowDepthRoutes({
      batchSlots: ["comps-benchmark"],
      evidenceInventory: [
        {
          id: "1",
          sourceId: "U-1",
          title: "bp",
          type: "用户上传",
          excerpt: "项目简介",
          relevantSlots: ["comps-benchmark"],
        },
      ],
    });
    expect(routes.some((r) => r.skillPath.includes("comp-analysis"))).toBe(true);
  });
});
