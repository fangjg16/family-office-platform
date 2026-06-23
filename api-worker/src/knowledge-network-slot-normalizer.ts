import { isRecord } from "./knowledge-network-coverage-target";
import {
  findUnmappedRowsInArray,
  isGapMarkedRow,
  isMeaningfulCell,
  isValidTableRow,
  isValidTableRowForColumns,
  pickRowCell,
  rowHasContentButNoMapping,
} from "./knowledge-network-content-row-quality";
import type { SlotQualityIssue } from "./knowledge-network-full-quality-contract";
import { ROW_SPECS } from "./knowledge-network-row-columns";
import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import {
  getSlotModuleSchema,
  tableFieldsFromSchema,
  type ComponentDef,
  type ComponentKind,
} from "./knowledge-network-slot-module-schema";
import type { GapCallout, SlotPayloadBySlot } from "./knowledge-network-structured-patch-types";

/** 唯一 normalize 入口。语义说明见 `knowledge-network-slot-schema-dev.md`。 */

export type NormalizeWarningCode = "dropped_empty_row" | "component_gap_callout";

export type NormalizeWarning = {
  code: NormalizeWarningCode;
  path: string;
  message: string;
};

export type NormalizeHardIssueCode = "unmapped_row_keys" | "invalid_component_type";

export type NormalizeHardIssue = {
  code: NormalizeHardIssueCode;
  path: string;
  message: string;
};

export type NormalizeSlotResult<S extends CanonicalKbSlot = CanonicalKbSlot> = {
  payload: SlotPayloadBySlot[S];
  warnings: NormalizeWarning[];
  hardIssues: NormalizeHardIssue[];
  droppedEmptyCount: number;
};

function asRows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRecord);
}

/** full-empty placeholder：{} 或全无意义 cell，且非 gap row */
export function isFullEmptyPlaceholderRow(row: Record<string, unknown>): boolean {
  if (isGapMarkedRow(row)) return false;
  if (Object.keys(row).length === 0) return true;
  return !Object.values(row).some((v) => isMeaningfulCell(v));
}

function applyFieldAliases(p: Record<string, unknown>, components: ComponentDef[]): void {
  for (const comp of components) {
    if (p[comp.field] != null) continue;
    for (const alias of comp.aliases ?? []) {
      if (p[alias] != null) {
        p[comp.field] = p[alias];
        break;
      }
    }
  }
}

function applyTimelineRowsSplit(p: Record<string, unknown>): void {
  const rows = asRows(p.rows ?? p.items);
  if (!rows.length || p.occurred || p.inProgress || p.future) return;
  const occurred: Record<string, unknown>[] = [];
  const inProgress: Record<string, unknown>[] = [];
  const future: Record<string, unknown>[] = [];
  for (const row of rows) {
    const bucket = String(row.bucket ?? row.status ?? row.kind ?? "").toLowerCase();
    const item = {
      date: row.date ?? row.when ?? row.time,
      title: row.title ?? row.event ?? row.milestone,
      detail: row.detail ?? row.description ?? row.note,
      phase:
        bucket.includes("past") || bucket.includes("occurred") || bucket.includes("已发生")
          ? "occurred"
          : bucket.includes("ongoing") || bucket.includes("推进")
            ? "inProgress"
            : "future",
    };
    if (item.phase === "occurred") occurred.push(item);
    else if (item.phase === "inProgress") inProgress.push(item);
    else future.push(item);
  }
  if (occurred.length) p.occurred = occurred;
  if (inProgress.length) p.inProgress = inProgress;
  if (future.length) p.future = future;
}

function applyDiligenceGroups(p: Record<string, unknown>): void {
  if (p.questionGroups) return;
  if (p.groups) {
    p.questionGroups = asRows(p.groups).map((g) => ({
      priority: String(g.priority ?? g.name ?? g.label ?? "P2"),
      title: g.title ?? g.name ?? g.label,
      questions: asRows(g.items ?? g.rows ?? g.questions),
    }));
    return;
  }
  if (p.items || p.rows) {
    p.questionGroups = [
      { priority: "P2", title: "待确认问题", questions: asRows(p.items ?? p.rows) },
    ];
  }
}

function applyValuationBenchmarks(p: Record<string, unknown>): void {
  if (p.benchmarkMetrics) return;
  if (p.valuationBox) {
    const boxes = Array.isArray(p.valuationBox) ? p.valuationBox : [p.valuationBox];
    p.benchmarkMetrics = boxes.map((b) => {
      if (!isRecord(b)) return b;
      return {
        label: b.label ?? b.name,
        value: b.value ?? b.amount,
        note: b.note ?? b.basis,
      };
    });
    return;
  }
  if (p.valuationBoxes) {
    p.benchmarkMetrics = asRows(p.valuationBoxes).map((b) => ({
      label: b.label ?? b.name,
      value: b.value ?? b.amount,
      note: b.note ?? b.basis,
    }));
  }
}

function applySlotLegacyAliases(slot: CanonicalKbSlot, p: Record<string, unknown>): void {
  const schema = getSlotModuleSchema(slot);
  applyFieldAliases(p, schema.allowedComponents);
  if (slot === "timeline-milestones") applyTimelineRowsSplit(p);
  if (slot === "diligence-gaps") applyDiligenceGroups(p);
  if (slot === "valuation-returns") applyValuationBenchmarks(p);
}

export function normalizeFlywheelValue(
  raw: unknown,
): { value: unknown; hardIssue?: NormalizeHardIssue } {
  if (raw == null) return { value: undefined };
  if (Array.isArray(raw)) return { value: raw };
  if (typeof raw === "string" && raw.trim()) {
    return { value: [{ paragraphs: [raw.trim()] }] };
  }
  if (isRecord(raw)) {
    if (Array.isArray(raw.paragraphs)) return { value: [raw] };
    if (raw.step || raw.name || raw.环节 || raw.mechanism) return { value: [raw] };
    return {
      value: undefined,
      hardIssue: {
        code: "invalid_component_type",
        path: "flywheel",
        message: "flywheel 须为 array（narrative 或 table row），收到无法识别的 object",
      },
    };
  }
  return {
    value: undefined,
    hardIssue: {
      code: "invalid_component_type",
      path: "flywheel",
      message: `flywheel 类型无效：${typeof raw}`,
    },
  };
}

export function normalizeJourneyMapValue(
  raw: unknown,
): { value: unknown; hardIssue?: NormalizeHardIssue } {
  if (raw == null) return { value: undefined };
  if (isRecord(raw) && Array.isArray(raw.stages) && raw.stages.length > 0) {
    return { value: raw };
  }
  if (Array.isArray(raw)) {
    return {
      value: undefined,
      hardIssue: {
        code: "invalid_component_type",
        path: "journeyMap",
        message: "journeyMap 须为 { stages: string[], lanes?: … }，收到 array",
      },
    };
  }
  return {
    value: undefined,
    hardIssue: {
      code: "invalid_component_type",
      path: "journeyMap",
      message: "journeyMap 缺少有效 stages",
    },
  };
}

export function normalizeQuestionGroupsValue(
  raw: unknown,
): { value: unknown; hardIssue?: NormalizeHardIssue } {
  if (raw == null) return { value: undefined };
  if (Array.isArray(raw)) return { value: raw };
  if (isRecord(raw) && (raw.questions || raw.items)) {
    return {
      value: [
        {
          priority: String(raw.priority ?? "P2"),
          title: raw.title ?? raw.name,
          questions: asRows(raw.questions ?? raw.items),
        },
      ],
    };
  }
  return {
    value: undefined,
    hardIssue: {
      code: "invalid_component_type",
      path: "questionGroups",
      message: "questionGroups 须为 array",
    },
  };
}

export function normalizeArrayComponent(
  field: string,
  raw: unknown,
  opts?: { wrapObject?: boolean },
): { value: unknown; hardIssue?: NormalizeHardIssue } {
  if (raw == null) return { value: undefined };
  if (Array.isArray(raw)) return { value: raw };
  if (opts?.wrapObject && isRecord(raw)) return { value: [raw] };
  return {
    value: undefined,
    hardIssue: {
      code: "invalid_component_type",
      path: field,
      message: `${field} 须为 array`,
    },
  };
}

function normalizeComponentByKind(
  comp: ComponentDef,
  raw: unknown,
): { value: unknown; hardIssue?: NormalizeHardIssue } {
  switch (comp.kind) {
    case "flywheel":
      return normalizeFlywheelValue(raw);
    case "journey":
      return normalizeJourneyMapValue(raw);
    case "questionGroups":
      return normalizeQuestionGroupsValue(raw);
    case "riskRows":
    case "timeline":
    case "table":
    case "scenarios":
    case "relationshipEdges":
      return normalizeArrayComponent(comp.field, raw, { wrapObject: comp.kind === "riskRows" });
    case "narrative":
    case "metricCards":
    case "gapCallouts":
    case "canvas":
      return { value: raw };
    default:
      return { value: raw };
  }
}

function sanitizeTableRows(
  slot: CanonicalKbSlot,
  field: string,
  rows: unknown[],
  comp: ComponentDef,
): {
  rows: Record<string, unknown>[];
  dropped: NormalizeWarning[];
  unmapped: NormalizeHardIssue[];
} {
  const dropped: NormalizeWarning[] = [];
  const unmapped: NormalizeHardIssue[] = [];
  const kept: Record<string, unknown>[] = [];
  const spec = comp.rowSpec ? ROW_SPECS[comp.rowSpec] : undefined;
  const columns = spec?.columns;
  const dropEmpty = comp.dropEmptyRows !== false;

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    if (!isRecord(item)) continue;
    const path = `${slot}.${field}[${i}]`;

    if (dropEmpty && isFullEmptyPlaceholderRow(item)) {
      dropped.push({
        code: "dropped_empty_row",
        path,
        message: `丢弃 full-empty placeholder row：${path}`,
      });
      continue;
    }

    if (columns && comp.hardRepairOnUnmapped !== false && rowHasContentButNoMapping(item, columns)) {
      unmapped.push({
        code: "unmapped_row_keys",
        path,
        message: `列名无法映射：${path}（keys: ${Object.keys(item)
          .filter((k) => isMeaningfulCell(item[k]))
          .slice(0, 4)
          .join(", ")}）`,
      });
      kept.push(item);
      continue;
    }

    if (!columns && dropEmpty && !isGapMarkedRow(item) && !isValidTableRow(item)) {
      if (isFullEmptyPlaceholderRow(item)) {
        dropped.push({
          code: "dropped_empty_row",
          path,
          message: `丢弃 full-empty placeholder row：${path}`,
        });
        continue;
      }
    }

    kept.push(item);
  }

  return { rows: kept, dropped, unmapped };
}

function ensureGapCallout(
  p: Record<string, unknown>,
  comp: ComponentDef,
  hadInput: boolean,
  keptCount: number,
  warnings: NormalizeWarning[],
): void {
  if (!hadInput || keptCount > 0 || !comp.gapCalloutLabel) return;
  const gaps = Array.isArray(p.gaps) ? [...(p.gaps as GapCallout[])] : [];
  const text = `${comp.gapCalloutLabel}：资料不足，待补结构化 gap row 或 callout。`;
  if (!gaps.some((g) => isRecord(g) && String(g.text ?? "").includes(comp.gapCalloutLabel!))) {
    gaps.push({ text, confidence: "gap" });
    p.gaps = gaps;
    warnings.push({
      code: "component_gap_callout",
      path: `${comp.field}`,
      message: text,
    });
  }
}

/**
 * 单一入口：raw / Codex legacy / 中英文别名 → Worker canonical payload。
 * validator、renderer、merge gate 均应使用返回的 payload。
 */
export function normalizeSlotPayload<S extends CanonicalKbSlot>(
  slot: S,
  raw: unknown,
): NormalizeSlotResult<S> {
  const warnings: NormalizeWarning[] = [];
  const hardIssues: NormalizeHardIssue[] = [];
  let droppedEmptyCount = 0;

  if (!isRecord(raw)) {
    return { payload: {} as SlotPayloadBySlot[S], warnings, hardIssues, droppedEmptyCount };
  }

  const p: Record<string, unknown> = { ...raw };
  const schema = getSlotModuleSchema(slot);
  applySlotLegacyAliases(slot, p);

  for (const comp of schema.allowedComponents) {
    const rawValue = p[comp.field];
    if (rawValue === undefined) continue;

    const { value, hardIssue } = normalizeComponentByKind(comp, rawValue);
    if (hardIssue) hardIssues.push(hardIssue);

    if (comp.kind === "table" || comp.kind === "riskRows" || comp.kind === "scenarios") {
      const arr = Array.isArray(value) ? value : [];
      const hadInput = arr.length > 0;
      const { rows, dropped, unmapped } = sanitizeTableRows(slot, comp.field, arr, comp);
      droppedEmptyCount += dropped.length;
      warnings.push(...dropped);
      hardIssues.push(...unmapped);
      if (rows.length) p[comp.field] = rows;
      else delete p[comp.field];
      ensureGapCallout(p, comp, hadInput, rows.length, warnings);
      continue;
    }

    if (comp.kind === "questionGroups" && Array.isArray(value)) {
      const groups = value.map((g, gi) => {
        if (!isRecord(g)) return g;
        const qs = g.questions;
        if (!Array.isArray(qs)) return g;
        const { rows, dropped, unmapped } = sanitizeTableRows(
          slot,
          `${comp.field}[${gi}].questions`,
          qs,
          {
            ...comp,
            kind: "table",
            rowSpec: "diligenceQuestion",
            field: "questions",
          } as ComponentDef,
        );
        droppedEmptyCount += dropped.length;
        warnings.push(...dropped);
        hardIssues.push(...unmapped);
        return { ...g, questions: rows };
      });
      p[comp.field] = groups;
      continue;
    }

    if (value === undefined) delete p[comp.field];
    else p[comp.field] = value;
  }

  return {
    payload: p as SlotPayloadBySlot[S],
    warnings,
    hardIssues,
    droppedEmptyCount,
  };
}

/** merge hard issues（仅 unmapped + invalid type；empty placeholder 已 drop） */
export function mergeHardIssuesFromNormalized(
  slot: CanonicalKbSlot,
  result: NormalizeSlotResult,
): SlotQualityIssue[] {
  return result.hardIssues.map((h) => ({
    slot,
    code: h.code,
    message: h.message,
  }));
}

/** 供 content-row-quality 使用：从 schema 推导列 spec */
export function columnSpecsForNormalizedPayload(
  slot: CanonicalKbSlot,
  payload: unknown,
): Record<string, readonly (readonly string[])[]> {
  const mapping: Record<string, readonly (readonly string[])[]> = {};
  if (!isRecord(payload)) return mapping;
  for (const { field, spec } of tableFieldsFromSchema(slot)) {
    const arr = payload[field];
    if (Array.isArray(arr) && arr.length > 0) {
      mapping[field] = ROW_SPECS[spec].columns;
    }
  }
  return mapping;
}

/** normalized payload 上扫描残留 unmapped（publish 二次确认） */
export function findResidualUnmappedInNormalized(
  slot: CanonicalKbSlot,
  payload: unknown,
): NormalizeHardIssue[] {
  if (!isRecord(payload)) return [];
  const issues: NormalizeHardIssue[] = [];
  for (const { field, spec } of tableFieldsFromSchema(slot)) {
    const arr = payload[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const columns = ROW_SPECS[spec].columns;
    for (const u of findUnmappedRowsInArray(arr, `${slot}.${field}`, columns)) {
      issues.push({
        code: "unmapped_row_keys",
        path: u.path,
        message: `列名无法映射：${u.path}（keys: ${u.sampleKeys.join(", ")}）`,
      });
    }
  }
  return issues;
}

/** normalized payload 上不应再有 full-empty row；用于 publish 断言 */
export function findResidualEmptyRowsInNormalized(
  slot: CanonicalKbSlot,
  payload: unknown,
): NormalizeWarning[] {
  if (!isRecord(payload)) return [];
  const warnings: NormalizeWarning[] = [];
  for (const { field, spec } of tableFieldsFromSchema(slot)) {
    const arr = payload[field];
    if (!Array.isArray(arr)) continue;
    const columns = ROW_SPECS[spec].columns;
    arr.forEach((item, i) => {
      if (!isRecord(item)) return;
      if (isFullEmptyPlaceholderRow(item)) {
        warnings.push({
          code: "dropped_empty_row",
          path: `${slot}.${field}[${i}]`,
          message: `normalized payload 仍含 full-empty row（不应出现）：${slot}.${field}[${i}]`,
        });
      } else if (!isGapMarkedRow(item) && !isValidTableRowForColumns(item, columns)) {
        const filled = columns.filter((keys) =>
          isMeaningfulCell(pickRowCell(item, [...keys])),
        ).length;
        if (filled === 0 && Object.values(item).some((v) => isMeaningfulCell(v))) {
          /* unmapped — handled elsewhere */
        }
      }
    });
  }
  return warnings;
}
