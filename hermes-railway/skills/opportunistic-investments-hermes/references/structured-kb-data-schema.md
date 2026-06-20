# structured-kb-data · Hermes 交付 schema（v2.91）

首次 / 全量 KB 的**主路径**：Hermes 只产出 JSON，Worker 确定性渲染整页 HTML。

## Envelope

```json
{
  "type": "structured-kb-data",
  "schemaVersion": "2.91",
  "mode": "initial",
  "summary": "3–8 行摘要的短版",
  "config": { "displayOrder": ["snapshot", "..."], "projectType": "general" },
  "meta": { "title": "…", "autoSummary": "…" },
  "maturity": { "factorA": "42%", "factorB": "25%", "combined": "35%" },
  "slots": { "snapshot": { … }, …13 keys… },
  "sources": [{ "id": "U-1", "type": "…", "title": "…" }],
  "terms": [],
  "dataDictionary": []
}
```

## 禁止

- `versionLedger` / Appendix D HTML — Worker + D1 自动写入
- 整页 ` ```html `、`sectionHtml`、手写 nav / KB-CONFIG / revealAnchor
- 默认 `jfo_kb_put.sh`（仅 structured 完全无法交付时的 fallback）

## slots

13 个 key 必须与 `references/kb-schema.md` canonical slots 一致。每个 slot 的 payload 形状见 Worker `SlotPayloadBySlot`（与 `structured-slot-patch` incremental 相同字段）。

完整示例：`examples-kb-data.json`（已对齐 SlotPayloadBySlot）。

## sources

- `id` 不含 `source-` 前缀（如 `U-1`、`A-1`）
- **禁止 duplicate id**
- 所有 `evidenceSourceIds` 必须先出现在 `sources` 中

## maturity

- `factorA` / `factorB` / `combined` 尽量写百分比；字母等级放 `tier` / stat-note

## 交付

1. 简体中文摘要 3–8 行
2. **一个** fenced ` ```json ` 块，`type` 必须为 `structured-kb-data`
