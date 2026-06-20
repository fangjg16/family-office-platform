/**
 * KB HTML 质量对比审计（通用 CLI，不进 Worker bundle）
 *
 * 用法：
 *   cd api-worker
 *   npx tsx scripts/compare-kb-quality.ts label1=path/to/a.html label2=path/to/b.html
 *   npx tsx scripts/compare-kb-quality.ts --baseline v3.html --candidate v5.html
 *
 * 可选：--compare-components  对比 baseline 与 candidate 缺失的专属组件
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  countEmptyHtmlCells,
  countEmptyHtmlRows,
} from "../src/knowledge-network-content-row-quality.ts";
import { CANONICAL_KB_SLOTS } from "../src/knowledge-network-html-validation.ts";

type SlotAudit = {
  slot: string;
  chars: number;
  tableRows: number;
  emptyCells: number;
  emptyRows: number;
  callouts: number;
  cites: number;
  components: string[];
};

type LabeledHtml = { label: string; path: string; html: string; rows: SlotAudit[] };

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/compare-kb-quality.ts label=path [label2=path2 ...]
  npx tsx scripts/compare-kb-quality.ts --baseline path --candidate path [--compare-components]

Examples:
  npx tsx scripts/compare-kb-quality.ts v3=./snapshots/v3.html v5=./snapshots/v5.html
  npx tsx scripts/compare-kb-quality.ts --baseline v3.html --candidate v5.html --compare-components`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  files: { label: string; path: string }[];
  compareComponents: boolean;
  baseline?: string;
  candidate?: string;
} {
  const files: { label: string; path: string }[] = [];
  let compareComponents = false;
  let baseline: string | undefined;
  let candidate: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--compare-components") {
      compareComponents = true;
      continue;
    }
    if (arg === "--baseline") {
      baseline = argv[++i];
      continue;
    }
    if (arg === "--candidate") {
      candidate = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") usage();
    const eq = arg.indexOf("=");
    if (eq > 0) {
      files.push({ label: arg.slice(0, eq), path: resolve(arg.slice(eq + 1)) });
    } else {
      files.push({ label: `file${files.length + 1}`, path: resolve(arg) });
    }
  }

  if (baseline) files.unshift({ label: "baseline", path: resolve(baseline) });
  if (candidate) files.push({ label: "candidate", path: resolve(candidate) });

  if (files.length === 0) usage();
  return { files, compareComponents, baseline, candidate };
}

function extractSection(html: string, slot: string): string {
  const re = new RegExp(
    `<section[^>]*\\bid=["']${slot}["'][^>]*>([\\s\\S]*?)<\\/section>`,
    "i",
  );
  return re.exec(html)?.[1] ?? "";
}

function countTableRows(section: string): number {
  let n = 0;
  for (const m of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (!m[1]!.includes("<th")) n += 1;
  }
  return n;
}

const COMPONENT_CHECKS: [string, RegExp][] = [
  ["details.topic", /<details class="topic"/i],
  ["oq-group", /class="oq-group"/i],
  ["scenario-cards", /class="scenario-cards"/i],
  ["scenario-card", /class="scenario-card"/i],
  ["risk-level", /class="risk-level/i],
  ["journey", /class="journey/i],
  ["journey-wrap", /class="journey-wrap"/i],
  ["valuation-grid", /class="valuation-grid"/i],
  ["callout", /class="callout/i],
  ["project-timeline", /class="[^"]*project-timeline/i],
  ["topic-count", /class="topic-count"/i],
  ["badge-red", /badge-red/i],
  ["badge-amber", /badge-amber/i],
];

function detectComponents(section: string): string[] {
  const out: string[] = [];
  for (const [name, re] of COMPONENT_CHECKS) {
    if (re.test(section)) out.push(name);
  }
  return out;
}

function auditHtml(label: string, path: string): LabeledHtml | null {
  if (!existsSync(path)) {
    console.warn(`SKIP ${label}: ${path} not found`);
    return null;
  }
  const html = readFileSync(path, "utf8");
  const rows: SlotAudit[] = [];
  for (const slot of CANONICAL_KB_SLOTS) {
    const section = extractSection(html, slot);
    rows.push({
      slot,
      chars: section.length,
      tableRows: countTableRows(section),
      emptyCells: countEmptyHtmlCells(section),
      emptyRows: countEmptyHtmlRows(section),
      callouts: (section.match(/class="callout/gi) ?? []).length,
      cites: (section.match(/class="cite-ref"/gi) ?? []).length,
      components: detectComponents(section),
    });
  }
  return { label, path, html, rows };
}

function printTable(entry: LabeledHtml): void {
  console.log(`\n=== ${entry.label} (${entry.path}) ===`);
  console.log(
    "slot".padEnd(22) +
      "chars".padStart(7) +
      "rows".padStart(6) +
      "emptyC".padStart(7) +
      "emptyR".padStart(7) +
      "callout".padStart(8) +
      "cite".padStart(6) +
      "  components",
  );
  for (const r of entry.rows) {
    console.log(
      r.slot.padEnd(22) +
        String(r.chars).padStart(7) +
        String(r.tableRows).padStart(6) +
        String(r.emptyCells).padStart(7) +
        String(r.emptyRows).padStart(7) +
        String(r.callouts).padStart(8) +
        String(r.cites).padStart(6) +
        "  " +
        r.components.join(", "),
    );
  }
  const tot = entry.rows.reduce(
    (a, r) => ({
      chars: a.chars + r.chars,
      emptyCells: a.emptyCells + r.emptyCells,
      emptyRows: a.emptyRows + r.emptyRows,
    }),
    { chars: 0, emptyCells: 0, emptyRows: 0 },
  );
  console.log(
    `TOTAL${" ".repeat(16)}${String(tot.chars).padStart(7)}${" ".repeat(6)}${String(tot.emptyCells).padStart(7)}${String(tot.emptyRows).padStart(7)}`,
  );
  const qc = entry.html.match(/quality-coverage:\s*(\d+)/i);
  if (qc) console.log(`KB-CONFIG quality-coverage: ${qc[1]}`);
}

function listEmptyTableRows(entry: LabeledHtml): void {
  console.log(`\n=== ${entry.label} 空表/空行 ===`);
  for (const r of entry.rows) {
    if (r.emptyRows > 0 || r.emptyCells > 0) {
      console.log(`- ${r.slot}: ${r.emptyRows} 空行, ${r.emptyCells} 空单元格`);
    }
  }
  for (const slot of CANONICAL_KB_SLOTS) {
    const section = extractSection(entry.html, slot);
    let rowIdx = 0;
    for (const m of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = m[1]!;
      if (row.includes("<th")) continue;
      rowIdx += 1;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
        c[1]!.replace(/<[^>]+>/g, "").trim(),
      );
      if (cells.length > 0 && cells.every((c) => !c)) {
        console.log(`  · ${slot} tbody row #${rowIdx}: 全空 <td>`);
      }
    }
  }
}

function compareMissingComponents(base: LabeledHtml, cand: LabeledHtml): void {
  console.log(`\n=== ${base.label} 有而 ${cand.label} 缺失的组件 ===`);
  const checks = [
    "details.topic",
    "risk-level",
    "scenario-cards",
    "journey",
    "topic-count",
    "badge-amber",
  ];
  for (const slot of CANONICAL_KB_SLOTS) {
    const bc = base.rows.find((r) => r.slot === slot)?.components ?? [];
    const cc = cand.rows.find((r) => r.slot === slot)?.components ?? [];
    const missing = checks.filter((c) => bc.includes(c) && !cc.includes(c));
    if (missing.length) {
      console.log(`- ${slot}: ${missing.join(", ")}`);
    }
  }
}

function main(): void {
  const { files, compareComponents } = parseArgs(process.argv.slice(2));
  const audited: LabeledHtml[] = [];
  for (const f of files) {
    const entry = auditHtml(f.label, f.path);
    if (entry) audited.push(entry);
  }
  if (!audited.length) {
    console.error("No readable HTML files.");
    process.exit(1);
  }
  for (const entry of audited) printTable(entry);
  for (const entry of audited) {
    if (entry.rows.some((r) => r.emptyRows > 0 || r.emptyCells > 0)) {
      listEmptyTableRows(entry);
    }
  }
  if (compareComponents && audited.length >= 2) {
    compareMissingComponents(audited[0]!, audited[audited.length - 1]!);
  }
}

main();
