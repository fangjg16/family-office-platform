import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_KB_DEEP_REF_FILES } from "./knowledge-network-deep-refs";
import { countFragmentBatchDeepRefs } from "./knowledge-network-fragment-batch-reads";
import { scoreFragmentHtmlEvidence } from "./knowledge-network-fragment-maturity";
import {
  buildAllSlotsCompressedCorpus,
  compressFragmentHtmlForAppendixScan,
} from "./knowledge-network-appendix-wrapup";
import { CANONICAL_KB_SLOTS } from "./knowledge-network-html-validation";
import {
  clearWorkflowMapCache,
  listInstalledHermesSkillIds,
  loadCodexHermesWorkflowMap,
  resolveWorkflowDepthRoutes,
  routesRequestPublicInfoSearch,
} from "./knowledge-network-workflow-routing";
import {
  KN_MATURITY_POLICY_LINES,
  KN_PUBLIC_SEARCH_POLICY_LINES,
} from "./knowledge-network-kn-policy";

const HERMES_RAILWAY = join(process.cwd(), "..", "hermes-railway");
const MAP_PATH = join(HERMES_RAILWAY, "codex-hermes-workflow-map.v293.json");
const SKILLS_DIR = join(HERMES_RAILWAY, "skills");

describe("codex→hermes workflow map drift", () => {
  it("map lists 26 workflows + schema 2.91", () => {
    const map = JSON.parse(readFileSync(MAP_PATH, "utf8")) as {
      kbSchemaVersion: string;
      workflows: { id: string }[];
    };
    expect(map.kbSchemaVersion).toBe("2.91");
    expect(map.workflows).toHaveLength(26);
  });

  it("skillInstalled matches local hermes-railway/skills directories", () => {
    clearWorkflowMapCache();
    const map = loadCodexHermesWorkflowMap(
      JSON.parse(readFileSync(MAP_PATH, "utf8")) as ReturnType<
        typeof loadCodexHermesWorkflowMap
      >,
    );
    const localDirs = new Set(
      readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );

    for (const w of map.workflows) {
      const hasDir = localDirs.has(w.id) && existsSync(join(SKILLS_DIR, w.id, "SKILL.md"));
      expect(
        w.hermes.skillInstalled,
        `${w.id}: skillInstalled=${w.hermes.skillInstalled} but dir exists=${hasDir}`,
      ).toBe(hasDir);
    }

    const installed = listInstalledHermesSkillIds(map);
    expect(installed.has("public-info-search")).toBe(true);
    expect(installed.has("compliance-check")).toBe(false);
  });

  it("dynamic routes never require uninstalled Skill.md paths", () => {
    clearWorkflowMapCache();
    const map = loadCodexHermesWorkflowMap(
      JSON.parse(readFileSync(MAP_PATH, "utf8")) as ReturnType<
        typeof loadCodexHermesWorkflowMap
      >,
    );
    const routes = resolveWorkflowDepthRoutes({
      batchSlots: ["regulatory-compliance", "legal-ownership"],
      evidenceInventory: [],
      map,
    });
    const compliance = routes.find((r) => r.skillId === "compliance-check");
    expect(compliance).toBeDefined();
    expect(compliance!.kind).toBe("deep-ref");
    expect(compliance!.skillPath).toContain("references/deep/compliance-check.md");
    expect(compliance!.skillPath).not.toMatch(/\/skills\/compliance-check\/SKILL\.md$/);

    for (const r of routes) {
      if (r.kind === "skill") {
        expect(r.skillPath).toMatch(/\/skills\/[^/]+\/SKILL\.md$/);
        const id = r.skillId;
        expect(map.workflows.find((w) => w.id === id)?.hermes.skillInstalled).toBe(true);
      }
    }
  });
});

describe("appendix B/C full-corpus wrap-up", () => {
  it("compresses all 13 slots, not a 4-slot preview", () => {
    const fragments: Partial<Record<(typeof CANONICAL_KB_SLOTS)[number], string>> = {};
    for (const slot of CANONICAL_KB_SLOTS) {
      fragments[slot] = `<section id="${slot}"><p>${slot} ${"内容".repeat(200)}</p></section>`;
    }
    const { corpus, deliveredCount } = buildAllSlotsCompressedCorpus(fragments);
    expect(deliveredCount).toBe(13);
    for (const slot of CANONICAL_KB_SLOTS) {
      expect(corpus).toContain(`### ${slot}`);
    }
    expect(compressFragmentHtmlForAppendixScan("<b>A</b>  B", 10)).toBe("A B");
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
    clearWorkflowMapCache();
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

  it("marks public-info-search when industry evidence thin", () => {
    clearWorkflowMapCache();
    const routes = resolveWorkflowDepthRoutes({
      batchSlots: ["industry-market"],
      evidenceInventory: [],
    });
    expect(routesRequestPublicInfoSearch(routes)).toBe(true);
  });
});
