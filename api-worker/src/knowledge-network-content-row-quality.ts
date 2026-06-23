import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  ROW_SPECS,
  SLOT_TABLE_FIELDS,
  type RowColumnSpec,
  type RowSpecKey,
} from "./knowledge-network-row-columns";
import type { TableRow } from "./knowledge-network-structured-patch-types";

const PLACEHOLDER_RE =
  /^(待补充|待核实|待收集|待确认|待查|待定|—|--|-|\.{2,}|n\/a|na|tbd|unknown|暂无|无)$/i;

/** 单元格是否有业务含义（非空、非占位符） */
export function isMeaningfulCell(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (s.length < 2) {
    return /^(高|中|低)$/i.test(s);
  }
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

/** row 有原始内容但列别名映射后全空 */
export function rowHasContentButNoMapping(
  row: Record<string, unknown>,
  columns: readonly (readonly string[])[],
): boolean {
  const any = Object.entries(row).some(
    ([k, v]) => k !== "evidenceSourceIds" && isMeaningfulCell(v),
  );
  if (!any) return false;
  const mapped = columns.filter((keys) =>
    isMeaningfulCell(pickRowCell(row, [...keys])),
  ).length;
  return mapped === 0;
}

/** 有效 row + 分析/影响/缺口列至少一列有内容 */
export function isRichTableRowForSpec(
  row: Record<string, unknown>,
  spec: RowColumnSpec,
  minRatio = 0.65,
): boolean {
  if (!isValidTableRowForColumns(row, spec.columns, minRatio)) return false;
  const idxs = spec.analysisColumnIndexes;
  if (!idxs?.length) return true;
  return idxs.some((i) => {
    const keys = spec.columns[i];
    return keys ? isMeaningfulCell(pickRowCell(row, [...keys])) : false;
  });
}

export function countRichRowsForSpec(rows: unknown, spec: RowColumnSpec, minRatio = 0.65): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter(
    (r) =>
      typeof r === "object" &&
      r !== null &&
      isRichTableRowForSpec(r as Record<string, unknown>, spec, minRatio),
  ).length;
}

export type UnmappedRowIssue = {
  path: string;
  index: number;
  sampleKeys: string[];
};

export function findUnmappedRowsInArray(
  arr: unknown[],
  path: string,
  columns: readonly (readonly string[])[],
): UnmappedRowIssue[] {
  const issues: UnmappedRowIssue[] = [];
  arr.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const row = item as Record<string, unknown>;
    if (rowHasContentButNoMapping(row, columns)) {
      issues.push({
        path: `${path}[${index}]`,
        index,
        sampleKeys: Object.keys(row).filter((k) => isMeaningfulCell(row[k])).slice(0, 4),
      });
    }
  });
  return issues;
}

export type EmptyRowIssue = {
  path: string;
  index: number;
  fillRatio: number;
};

/** 行是否显式标注为 gap（不得伪装成事实） */
export function isGapMarkedRow(row: Record<string, unknown>): boolean {
  const conf = String(row.confidence ?? row.kind ?? row.rowType ?? "").trim().toLowerCase();
  if (conf === "gap" || conf === "缺口" || row.gap === true) return true;
  const markers = [
    pickRowCell(row, ["证据/缺口", "evidence", "status", "状态", "强度/可验证性", "verifiability"]),
    pickRowCell(row, ["可比对象", "comp", "name"]),
    pickRowCell(row, ["缺口", "gap", "missing"]),
    pickRowCell(row, ["主体/权利", "entity", "subject"]),
  ].join(" ");
  return /缺口|待确认|未提供|待验证|gap|unavailable|why unavailable|待补充|^[-—–]$/i.test(markers);
}

function scanArrayForColumnEmptyRows(
  arr: unknown[],
  path: string,
  columns: readonly (readonly string[])[],
  issues: EmptyRowIssue[],
): void {
  arr.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const row = item as Record<string, unknown>;
    if (isGapMarkedRow(row)) return;
    if (Object.keys(row).length === 0) {
      issues.push({ path: `${path}[${index}]`, index, fillRatio: 0 });
      return;
    }
    if (!Object.values(row).some((v) => isMeaningfulCell(v))) {
      issues.push({ path: `${path}[${index}]`, index, fillRatio: 0 });
      return;
    }
    if (isValidTableRowForColumns(row, columns)) return;
    if (Object.keys(row).length > 0 && Object.values(row).some((v) => isMeaningfulCell(v))) {
      const filled = columns.filter((keys) =>
        isMeaningfulCell(pickRowCell(row, [...keys])),
      ).length;
      issues.push({
        path: `${path}[${index}]`,
        index,
        fillRatio: Math.round((filled / Math.max(columns.length, 1)) * 100),
      });
    }
  });
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

/** 扫描 payload 中的无效/空 table rows（列别名感知） */
export function findEmptyRowIssuesInPayload(
  slot: string,
  payload: unknown,
  columnSpecs?: Record<string, readonly (readonly string[])[]>,
): EmptyRowIssue[] {
  const issues: EmptyRowIssue[] = [];
  if (typeof payload !== "object" || payload === null) return issues;
  const p = payload as Record<string, unknown>;

  for (const key of TABLE_ARRAY_KEYS) {
    const arr = p[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const cols = columnSpecs?.[key];
    if (cols) scanArrayForColumnEmptyRows(arr, `${slot}.${key}`, cols, issues);
    else {
      arr.forEach((item, index) => {
        if (typeof item !== "object" || item === null) return;
        const row = item as Record<string, unknown>;
        if (isGapMarkedRow(row)) return;
        if (!isValidTableRow(row) && Object.keys(row).length > 0) {
          issues.push({
            path: `${slot}.${key}[${index}]`,
            index,
            fillRatio: Math.round(rowFillRatio(row) * 100),
          });
        }
      });
    }
  }

  const groups = p.questionGroups;
  if (Array.isArray(groups)) {
    groups.forEach((g, gi) => {
      if (typeof g !== "object" || g === null) return;
      const qs = (g as Record<string, unknown>).questions;
      if (Array.isArray(qs)) {
        scanArrayForColumnEmptyRows(
          qs,
          `${slot}.questionGroups[${gi}].questions`,
          [
            ["question", "claim", "item"],
            ["owner"],
            ["action", "requiredEvidence"],
          ],
          issues,
        );
      }
    });
  }

  return issues;
}

export function columnSpecsForSlotPayload(
  slot: CanonicalKbSlot,
  payload: unknown,
): Record<string, readonly (readonly string[])[]> {
  const mapping: Record<string, readonly (readonly string[])[]> = {};
  const fields = SLOT_TABLE_FIELDS[slot];
  if (!fields || typeof payload !== "object" || payload === null) return mapping;
  const p = payload as Record<string, unknown>;
  for (const { field, spec } of fields) {
    if (Array.isArray(p[field]) && p[field]!.length > 0) {
      mapping[field] = ROW_SPECS[spec].columns;
    }
  }
  return mapping;
}

/** 扫描 slot payload 中有内容但列别名无法映射的 rows */
export function findUnmappedRowIssuesInPayload(
  slot: string,
  payload: unknown,
): UnmappedRowIssue[] {
  const slotKey = slot as CanonicalKbSlot;
  const fields = SLOT_TABLE_FIELDS[slotKey];
  if (!fields || typeof payload !== "object" || payload === null) return [];
  const p = payload as Record<string, unknown>;
  const issues: UnmappedRowIssue[] = [];
  for (const { field, spec } of fields) {
    const arr = p[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    issues.push(
      ...findUnmappedRowsInArray(arr, `${slot}.${field}`, ROW_SPECS[spec].columns),
    );
  }
  return issues;
}

export function rowSpecForField(slot: CanonicalKbSlot, field: string): RowSpecKey | null {
  const fields = SLOT_TABLE_FIELDS[slot];
  return fields?.find((f) => f.field === field)?.spec ?? null;
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
