import type { TableRow } from "./knowledge-network-structured-patch-types";

const PLACEHOLDER_RE =
  /^(待补充|待核实|待收集|待确认|待查|待定|—|--|-|\.{2,}|n\/a|na|tbd|unknown|暂无|无)$/i;

/** 单元格是否有业务含义（非空、非占位符） */
export function isMeaningfulCell(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (s.length < 2) return false;
  if (PLACEHOLDER_RE.test(s)) return false;
  return true;
}

/** row 核心字段填充率 0–1 */
export function rowFillRatio(row: Record<string, unknown>, keys?: string[]): number {
  const entries = keys?.length ? keys.map((k) => row[k]) : Object.values(row);
  if (entries.length === 0) return 0;
  const filled = entries.filter((v) => isMeaningfulCell(v)).length;
  return filled / entries.length;
}

/** 按列别名取第一个有含义的值（兼容 Hermes 英文键 vs Worker 中文表头） */
export function pickRowCell(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (isMeaningfulCell(v)) return String(v).trim();
  }
  return "";
}

/** 按渲染列定义校验：至少 minRatio 列在别名组内有有效值 */
export function isValidTableRowForColumns(
  row: Record<string, unknown>,
  columns: readonly (readonly string[])[],
  minRatio = 0.65,
): boolean {
  if (columns.length === 0) return false;
  const filled = columns.filter((keys) => isMeaningfulCell(pickRowCell(row, [...keys]))).length;
  if (filled === 0) return false;
  return filled / columns.length >= minRatio;
}

/** 至少 minRatio（默认 65%）核心字段非空 */
export function isValidTableRow(
  row: Record<string, unknown>,
  minRatio = 0.65,
): boolean {
  const keys = Object.keys(row).filter((k) => k !== "evidenceSourceIds");
  if (keys.length === 0) return false;
  return rowFillRatio(row, keys) >= minRatio;
}

export function filterValidRowsForColumns(
  rows: TableRow[] | undefined,
  columns: readonly (readonly string[])[],
  minRatio = 0.65,
): TableRow[] {
  if (!rows?.length) return [];
  return rows.filter((r) =>
    isValidTableRowForColumns(r as Record<string, unknown>, columns, minRatio),
  );
}

export function filterValidRows(rows: TableRow[] | undefined, minRatio = 0.65): TableRow[] {
  if (!rows?.length) return [];
  return rows.filter((r) => isValidTableRow(r as Record<string, unknown>, minRatio));
}

export function countValidRowsForColumns(
  rows: unknown,
  columns: readonly (readonly string[])[],
  minRatio = 0.65,
): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) =>
    typeof r === "object" &&
    r !== null &&
    isValidTableRowForColumns(r as Record<string, unknown>, columns, minRatio),
  ).length;
}

export function countValidRows(rows: unknown, minRatio = 0.65): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) =>
    typeof r === "object" && r !== null && isValidTableRow(r as Record<string, unknown>, minRatio),
  ).length;
}

export type EmptyRowIssue = {
  path: string;
  index: number;
  fillRatio: number;
};

function scanArrayForEmptyRows(
  arr: unknown[],
  path: string,
  issues: EmptyRowIssue[],
): number {
  let valid = 0;
  arr.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const row = item as Record<string, unknown>;
    if (isValidTableRow(row)) {
      valid += 1;
    } else if (Object.keys(row).length > 0) {
      issues.push({
        path: `${path}[${index}]`,
        index,
        fillRatio: Math.round(rowFillRatio(row) * 100),
      });
    }
  });
  return valid;
}

const TABLE_ARRAY_KEYS = [
  "keyFacts",
  "assetSummary",
  "keyClaims",
  "transactionSummary",
  "marketDrivers",
  "marketSize",
  "valueChain",
  "policyContext",
  "comparableSignals",
  "revenueTree",
  "customerBuyer",
  "pricing",
  "operatingBottlenecks",
  "supplyChain",
  "entities",
  "ownershipClaims",
  "contractRights",
  "licenseRights",
  "jurisdictionRows",
  "complianceRisks",
  "licenseRequirements",
  "approvalPath",
  "parties",
  "resources",
  "capabilities",
  "dependencies",
  "compsRows",
  "transactionCases",
  "benchmarkMetrics",
  "investmentCashflow",
  "sensitivityItems",
  "returnDrivers",
  "downsideCases",
  "riskRows",
  "decisionTable",
  "nextActions",
  "goNoGoConditions",
  "triggers",
  "stopConditions",
] as const;

/** 扫描 payload 中的无效/空 table rows */
export function findEmptyRowIssuesInPayload(
  slot: string,
  payload: unknown,
): EmptyRowIssue[] {
  const issues: EmptyRowIssue[] = [];
  if (typeof payload !== "object" || payload === null) return issues;
  const p = payload as Record<string, unknown>;

  for (const key of TABLE_ARRAY_KEYS) {
    const arr = p[key];
    if (Array.isArray(arr) && arr.length > 0) {
      scanArrayForEmptyRows(arr, `${slot}.${key}`, issues);
    }
  }

  const groups = p.questionGroups;
  if (Array.isArray(groups)) {
    groups.forEach((g, gi) => {
      if (typeof g !== "object" || g === null) return;
      const qs = (g as Record<string, unknown>).questions;
      if (Array.isArray(qs)) scanArrayForEmptyRows(qs, `${slot}.questionGroups[${gi}].questions`, issues);
    });
  }

  return issues;
}

/** 渲染后 HTML 中空 tbody 单元格统计 */
export function countEmptyHtmlCells(sectionHtml: string): number {
  let count = 0;
  for (const m of sectionHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const inner = m[1]!.replace(/<[^>]+>/g, "").trim();
    if (!inner || PLACEHOLDER_RE.test(inner)) count += 1;
  }
  return count;
}

export function countEmptyHtmlRows(sectionHtml: string): number {
  let count = 0;
  for (const m of sectionHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = m[1]!;
    if (row.includes("<th")) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, "").trim(),
    );
    if (cells.length > 0 && cells.every((c) => !c || PLACEHOLDER_RE.test(c))) count += 1;
  }
  return count;
}
