import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

/** Batch 3（batchIndex=2）Hermes 输出协议 — 仅指令层，不改 Quality Contract */
export const BATCH3_SLOT_NAMES = [
  "resource-network",
  "comps-benchmark",
] as const;

export function buildBatch3EnvelopeSpec(mode: KnowledgeNetworkUpdateMode): string {
  return `
**Batch 3 输出协议（硬性 · batchIndex=2）**
- 回复 **只能** 含 **一个** \\\`\\\`\\\`json 代码块；**禁止** JSON 外的 Markdown、解释、HTML、第二代码块。
- 必须使用下列 envelope（slots 为 **object**）：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "batchIndex": 2,
  "summary": "本批覆盖 resource-network / comps-benchmark …",
  "slots": {
    "resource-network": { … },
    "comps-benchmark": { … }
  }
}
\\\`\\\`\\\`
- 无法修复时仍须同 envelope + \`"status": "blocked"\` + \`"blockedReason"\` + \`"slots": {}\`。`;
}

export function buildBatch3StructuredExampleBlock(): string {
  return `
**Batch 3 示例（envelope + 组件片段；allowed 是菜单，不是必填套餐）**

> 每 slot 选有材料的主组件；缺资料用 gap 表，**禁止**同框凑满 parties + capabilities + edges + compsRows + benchmarkMetrics。

\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "full",
  "batchIndex": 2,
  "summary": "资源网络与可比对标：缺可比处用 gap 表，不编造交易。",
  "slots": {
    "resource-network": {
      "resourceGaps": [
        { "party": "关务代理", "role": "合规清关", "evidence": "未提供", "dependency": "全链路时效", "gap": "缺代理协议", "nextAction": "索取合同与许可路径 memo" }
      ]
    },
    "comps-benchmark": {
      "comparableGaps": [
        { "缺口": "缺同品类上市公司", "原因": "卖方未提供", "所需资料": "行业 comps 列表", "对估值启示": "倍数法暂不可用", "nextAction": "买方自行检索" }
      ],
      "transactionCasesNote": "无 verified 交易案例；禁止编造。"
    }
  }
}
\\\`\\\`\\\`

**Batch 3 slot 要点（coverage target = soft；非 hard factual minimum）**
- **resource-network**：parties / capabilities / relationshipEdges / resourceGaps — **选有材料的**；resourceGaps ≥3 为 coverage target；勿编造合作。
- **comps-benchmark**：compsRows / comparableGaps — 选其一或组合；无真实可比须 transactionCasesNote；勿编造交易。`;
}

export function buildBatch3RepairEnvelopePrompt(
  repairMessage: string,
  failedSlots: string[],
  mode: KnowledgeNetworkUpdateMode,
): string {
  const focus = BATCH3_SLOT_NAMES.filter((s) => failedSlots.includes(s));
  return `【Batch 3 · structured-slot-batch repair · 协议强制】

上一轮未通过或 Worker 未解析到 JSON。失败 slot：${failedSlots.join(", ") || focus.join(", ")}

${repairMessage}

**你必须遵守（无例外）**
1. 回复 **仅** 一个 \\\`\\\`\\\`json 代码块 — **零** JSON 外文字。
2. envelope 与首轮完全相同（batchIndex=2，slots 为 object）：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "batchIndex": 2,
  "summary": "…",
  "slots": {
    "resource-network": { … },
    "comps-benchmark": { … }
  }
}
\\\`\\\`\\\`
3. 重点修复：${focus.join(", ") || BATCH3_SLOT_NAMES.join(", ")}。只补 **出现过的 allowed 组件** 或 gap rows；勿为 coverage 同框凑满所有表。
4. 若仍无法修复：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "batchIndex": 2,
  "status": "blocked",
  "blockedReason": "…",
  "slots": {}
}
\\\`\\\`\\\``;
}
