import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { isRecord } from "./knowledge-network-coverage-target";
import {
  allowedComponentFields,
  getSlotModuleSchema,
  SLOT_MODULE_SCHEMAS,
} from "./knowledge-network-slot-module-schema";

/**
 * Schema consistency（轻量）：仅 unknown 顶层 field 审计，非 rule engine。
 * 详见 `knowledge-network-slot-schema-dev.md` §4。
 */

/** payload 上允许的 meta 字段（非 component） */
const PAYLOAD_META_KEYS = new Set([
  "title",
  "subtitle",
  "stage",
  "status",
  "oneLineJudgment",
  "recommendation",
  "transactionCasesNote",
  "comparableSearchStrategy",
]);

/**
 * Renderer 会读但 schema 菜单未列的 legacy 字段（consistency 白名单）。
 */
export const RENDERER_EXTRA_FIELDS: Partial<Record<CanonicalKbSlot, string[]>> = {
  "business-operations": ["journey"],
  "valuation-returns": ["valuationBox", "valuationBoxes", "assumptions", "downsideCases"],
};

export type SchemaConsistencyIssue = {
  slot: CanonicalKbSlot;
  field: string;
  kind: "unknown_component" | "renderer_unregistered";
};

/** normalizer 输出上的顶层 key 必须在 allowedComponents（或 meta）内 */
export function findUnknownComponentsInPayload(
  slot: CanonicalKbSlot,
  payload: unknown,
): SchemaConsistencyIssue[] {
  if (!isRecord(payload)) return [];
  const allowed = new Set([
    ...allowedComponentFields(slot),
    ...Object.keys(SLOT_MODULE_SCHEMAS[slot].allowedComponents.flatMap((c) => c.aliases ?? [])),
    ...(RENDERER_EXTRA_FIELDS[slot] ?? []),
    ...PAYLOAD_META_KEYS,
  ]);
  const issues: SchemaConsistencyIssue[] = [];
  for (const key of Object.keys(payload)) {
    if (allowed.has(key)) continue;
    issues.push({ slot, field: key, kind: "unknown_component" });
  }
  return issues;
}

/** schema 登记了 renderer 的组件名集合（菜单 ⊆ renderer 能力） */
export function schemaRendererComponentFields(slot: CanonicalKbSlot): string[] {
  return getSlotModuleSchema(slot).allowedComponents
    .filter((c) => c.renderer)
    .map((c) => c.field);
}

/**
 * 轻量一致性：schema 中有 renderer 登记的组件，应在 slot-render switch 中被消费。
 * 本函数仅返回「schema 声明了 renderer 的字段名」供人工/测试对照，不做 AST 解析。
 */
export function listSchemaRendererRegistry(): Record<CanonicalKbSlot, string[]> {
  const out = {} as Record<CanonicalKbSlot, string[]>;
  for (const slot of Object.keys(SLOT_MODULE_SCHEMAS) as CanonicalKbSlot[]) {
    out[slot] = schemaRendererComponentFields(slot);
  }
  return out;
}
