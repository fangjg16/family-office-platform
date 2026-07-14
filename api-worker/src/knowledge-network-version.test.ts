import { describe, expect, it } from "vitest";
import {
  applyKbVersionDisplay,
  formatKnVersionDisplay,
  knVersionDisplayMajor,
  parseKnVersionFromFilename,
  resolveKnVersionOnUpload,
} from "./knowledge-network-version";

describe("parseKnVersionFromFilename", () => {
  it("parses v5.5 from upload name", () => {
    expect(
      parseKnVersionFromFilename("[AI] BPC-157多肽项目_知识网络 v5.5.html"),
    ).toBe("5.5");
  });

  it("uses last v token", () => {
    expect(parseKnVersionFromFilename("draft_v1_final_v2.1.html")).toBe("2.1");
  });

  it("returns null when absent", () => {
    expect(parseKnVersionFromFilename("知识网络.html")).toBeNull();
  });

  it("parses v11 before underscore date suffix", () => {
    expect(
      parseKnVersionFromFilename("[AI] 演员AI版权投资_知识网络_v11_20260625.html"),
    ).toBe("11");
  });
});

describe("resolveKnVersionOnUpload", () => {
  it("upload v11 after v6 keeps semantic v11", () => {
    const r = resolveKnVersionOnUpload(
      { version: 5, versionLabel: "6" },
      "[AI] 演员AI版权投资_知识网络_v11_20260625.html",
    );
    expect(r.version).toBe(6);
    expect(r.versionLabel).toBe("11");
    expect(formatKnVersionDisplay(r.version, r.versionLabel)).toBe("11");
  });

  it("uses filename version label", () => {
    const r = resolveKnVersionOnUpload(
      { version: 2, versionLabel: null },
      "[AI] BPC-157多肽项目_知识网络 v5.5.html",
    );
    expect(r.version).toBe(3);
    expect(r.versionLabel).toBe("5.5");
  });

  it("auto major+1 when no v in filename", () => {
    const r = resolveKnVersionOnUpload(
      { version: 2, versionLabel: "5.5" },
      "知识网络.html",
    );
    expect(r.version).toBe(3);
    expect(r.versionLabel).toBe("6");
  });

  it("first upload without filename", () => {
    const r = resolveKnVersionOnUpload(null, "page.html");
    expect(r.version).toBe(1);
    expect(r.versionLabel).toBe("1");
  });

  it("agent after upload v5.8 yields display v6", () => {
    const r = resolveKnVersionOnUpload({ version: 3, versionLabel: "5.8" }, null);
    expect(r.version).toBe(4);
    expect(r.versionLabel).toBe("6");
    expect(formatKnVersionDisplay(r.version, r.versionLabel)).toBe("6");
  });

  it("agent after upload v6 yields display v7", () => {
    const r = resolveKnVersionOnUpload({ version: 5, versionLabel: "6" }, null);
    expect(r.version).toBe(6);
    expect(r.versionLabel).toBe("7");
    expect(formatKnVersionDisplay(r.version, r.versionLabel)).toBe("7");
  });

  it("agent chain increments semantic major", () => {
    const r = resolveKnVersionOnUpload({ version: 6, versionLabel: "7" }, null);
    expect(r.versionLabel).toBe("8");
  });

  it("prefers internal version when integer label lags", () => {
    expect(formatKnVersionDisplay(3, "2")).toBe("3");
  });
});

describe("applyKbVersionDisplay", () => {
  it("replaces schema version with display version", () => {
    const html =
      '<dt>Version</dt><dd>v2.91-full</dd><span class="ai-badge">AI-Generated · v2.91-full</span>';
    const out = applyKbVersionDisplay(html, "6");
    expect(out).toContain("<dd>v6</dd>");
    expect(out).toContain("AI-Generated · v6 · schema 2.91");
    expect(out).not.toContain("v2.91-full");
  });
});

describe("knVersionDisplayMajor", () => {
  it("reads major from label", () => {
    expect(knVersionDisplayMajor({ version: 3, versionLabel: "5.5" })).toBe(5);
  });
});
