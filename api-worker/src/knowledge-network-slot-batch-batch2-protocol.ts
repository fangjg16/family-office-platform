import type { KnowledgeNetworkUpdateMode } from "./knowledge-network-mode";

/** Batch 2（batchIndex=1）Hermes 输出协议 — 仅指令层，不改 Quality Contract */
export const BATCH2_SLOT_NAMES = [
  "business-operations",
  "legal-ownership",
  "regulatory-compliance",
] as const;

export function buildBatch2EnvelopeSpec(mode: KnowledgeNetworkUpdateMode): string {
  return `
**Batch 2 输出协议（硬性 · batchIndex=1）**
- 回复 **只能** 含 **一个** \\\`\\\`\\\`json 代码块；**禁止** JSON 外的 Markdown、解释、HTML、第二代码块。
- 必须使用下列 envelope（字段齐全；slots 为 **object**，key 为 slot 名）：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "batchIndex": 1,
  "summary": "本批覆盖 business-operations / legal-ownership / regulatory-compliance …",
  "slots": {
    "business-operations": { … },
    "legal-ownership": { … },
    "regulatory-compliance": { … }
  }
}
\\\`\\\`\\\`
- 若本批确实无法修复/交付：**仍须** 返回同 envelope，并加 \`"status": "blocked"\` 与 \`"blockedReason": "…"\`（slots 可留空 object）；**禁止** 不返回 JSON 或只写自然语言。`;
}

export function buildBatch2StructuredExampleBlock(): string {
  return `
**Batch 2 示例（envelope + 组件片段；allowed 是菜单，不是必填套餐）**

> 每 slot **选 1–2 个主组件**即可；**不要**为凑结构同框生成 journeyMap + revenueTree + customerBuyer + pricing + bottlenecks。
> 资料不足走 **operationalGaps / unresolvedLegalIssues / regulatoryGaps**（gap-first 是正常输出）。

\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "full",
  "batchIndex": 1,
  "summary": "运营、法律与监管：有事实写事实；不足写缺口表。",
  "slots": {
    "business-operations": {
      "revenueTree": [
        { "应用/产品场景": "跨境贸易服务", "价值主张": "连接采购与分销", "证据/缺口": "来源 A-1；缺 audited 收入拆分" }
      ],
      "operationalGaps": [
        { "issue": "缺 audited 运营 KPI", "whyItMatters": "无法验证单位经济", "requiredEvidence": "12 个月运营报表", "owner": "卖方 CFO", "decisionImpact": "估值假设待下调", "riskLevel": "中" }
      ]
    },
    "legal-ownership": {
      "unresolvedLegalIssues": [
        { "issue": "股权结构未披露", "whyItMatters": "影响控制权判断", "requiredEvidence": "工商档案", "owner": "卖方法务", "decisionImpact": "未确认前不宜推进", "riskLevel": "高" }
      ]
    },
    "regulatory-compliance": {
      "regulatoryGaps": [
        { "jurisdiction": "中国", "requirement": "进出口备案", "currentEvidence": "未提供", "gap": "待确认/需法律意见", "nextAction": "索取备案证明", "riskLevel": "高" }
      ]
    }
  }
}
\\\`\\\`\\\`

**Batch 2 slot 要点（coverage target = soft；fact + gap rows，非 hard factual minimum）**
- **business-operations · 菜单**：journeyMap | revenueTree | flywheel | canvas | processFlow — **选 1–2**；不足 **operationalGaps** / gaps。customerBuyer / pricing / bottlenecks **可选**。
- **legal-ownership · gap-first**：unresolvedLegalIssues coverage target ≥4（fact + gap）；禁止编造合同/许可事实。
- **regulatory-compliance · gap-first**：regulatoryGaps coverage target ≥4（fact + gap）；许可仅可写「待确认/需法律意见」。`;
}

export function buildBatch2RepairEnvelopePrompt(
  repairMessage: string,
  failedSlots: string[],
  mode: KnowledgeNetworkUpdateMode,
): string {
  const slotKeys = BATCH2_SLOT_NAMES.filter((s) => failedSlots.includes(s));
  const focus = slotKeys.length ? slotKeys.join(", ") : BATCH2_SLOT_NAMES.join(", ");
  return `【Batch 2 · structured-slot-batch repair · 协议强制】

上一轮未通过或 Worker 未解析到 JSON。失败 slot：${failedSlots.join(", ") || "（见下方清单）"}

${repairMessage}

**你必须遵守（无例外）**
1. 回复 **仅** 一个 \\\`\\\`\\\`json 代码块 — **零** JSON 外文字。
2. envelope 与首轮完全相同：
\\\`\\\`\\\`json
{
  "type": "structured-slot-batch",
  "schemaVersion": "2.91",
  "mode": "${mode}",
  "batchIndex": 1,
  "summary": "…",
  "slots": {
    "business-operations": { … },
    "legal-ownership": { … },
    "regulatory-compliance": { … }
  }
}
\\\`\\\`\\\`
3. 重点修复：${focus}。business-operations 只补 **1–2 个 allowed 主组件** 或 operationalGaps；legal/regulatory 走 gap-first，勿硬补事实。
4. 若仍无法修复：返回同 envelope + \`"status": "blocked"\` + \`"blockedReason"\`（说明缺什么资料），**禁止** 空回复或非 JSON。`;
}
