import { describe, expect, it } from "vitest";
import {
  buildKnVersionLedgerRows,
  formatKnVersionTag,
  injectKnVersionLedger,
} from "./knowledge-network-version-ledger";

const SAMPLE_LEDGER_SECTION = `<section class="block kb-panel" id="version-ledger"><h2>附录 D</h2><table><thead><tr><th>版本</th><th>时间</th><th>父版本</th><th>来源</th><th>变更摘要</th></tr></thead><tbody><tr><td>v6</td><td>2026-06-18</td><td>none</td><td>Hermes</td><td>only current</td></tr></tbody></table></section>`;

describe("buildKnVersionLedgerRows", () => {
  it("chains parent versions oldest to newest", () => {
    const rows = buildKnVersionLedgerRows(
      [
        {
          version: 1,
          versionLabel: null,
          updatedAt: "2026-06-04T08:01:19.168Z",
          updatedBy: "jensen-fang",
          changelog: "本地上传 HTML 覆盖",
        },
        {
          version: 2,
          versionLabel: null,
          updatedAt: "2026-06-05T02:10:02.712Z",
          updatedBy: "jessica-hu",
          changelog: "本地上传 HTML 覆盖",
        },
      ],
      {
        version: 3,
        versionLabel: "5.5",
        updatedAt: "2026-06-05T03:27:34.538Z",
        updatedBy: "jessica-hu",
        changelog: "本地上传 HTML 覆盖",
      },
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]?.parent).toBe("none");
    expect(rows[1]?.parent).toBe("v1");
    expect(rows[2]?.version).toBe("v5.5");
    expect(rows[2]?.parent).toBe("v2");
    expect(rows[0]?.source).toBe("本地上传");
  });
});

const CALLOUT_LEDGER_SECTION = `<section class="block kb-panel" id="version-ledger">
  <h2 class="section-title">附录D · 版本账本</h2>
  <p class="section-sub">Version Ledger</p>
  <div class="callout info">
    <p>版本变更追踪详见各板块底部 Changelog 表格。v6.0 为当前最新版本（2026-06-18）。</p>
  </div>
</section>`;

describe("injectKnVersionLedger", () => {
  it("replaces tbody with full history", () => {
    const rows = buildKnVersionLedgerRows(
      [
        {
          version: 4,
          versionLabel: "5.8",
          updatedAt: "2026-06-09T03:34:23.919Z",
          updatedBy: "jessica-hu",
          changelog: "本地上传 HTML 覆盖",
        },
      ],
      {
        version: 5,
        versionLabel: null,
        updatedAt: "2026-06-18T07:21:19.867Z",
        updatedBy: "jessica-hu",
        changelog: "hermes-file-put",
      },
    );
    const { html, applied } = injectKnVersionLedger(SAMPLE_LEDGER_SECTION, rows);
    expect(applied).toBe(true);
    expect(html).toContain("v5.8");
    expect(html).toContain("v5");
    expect(html).not.toContain("only current");
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
  });

  it("replaces callout-only appendix D with version table", () => {
    const rows = buildKnVersionLedgerRows(
      [
        {
          version: 1,
          versionLabel: null,
          updatedAt: "2026-06-04T08:01:19.168Z",
          updatedBy: "jensen-fang",
          changelog: "本地上传 HTML 覆盖",
        },
      ],
      {
        version: 5,
        versionLabel: null,
        updatedAt: "2026-06-18T07:21:19.867Z",
        updatedBy: "jessica-hu",
        changelog: "hermes-file-put",
      },
    );
    const { html, applied } = injectKnVersionLedger(CALLOUT_LEDGER_SECTION, rows);
    expect(applied).toBe(true);
    expect(html).toContain("<tbody>");
    expect(html).toContain("v1");
    expect(html).toContain("v5");
    expect(html).not.toContain("callout");
  });
});

describe("formatKnVersionTag", () => {
  it("prefixes v when missing", () => {
    expect(formatKnVersionTag(3, "5.5")).toBe("v5.5");
    expect(formatKnVersionTag(1, null)).toBe("v1");
  });
});
