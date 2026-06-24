import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import { SLOT_DEFAULT_TITLES } from "./knowledge-network-slot-render";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SLOT_GAP_HINTS: Partial<Record<CanonicalKbSlot, string>> = {
  snapshot: "缺项目简介、阶段或核心交易条款；需 BP / 卖方材料。",
  "target-overview": "缺标的资产清单、权属或许可状态；需尽调清单与权属文件。",
  "industry-market": "缺项目专属行业数据；公开资料仅可作背景，须标注来源。",
  "business-operations": "缺运营模式、客户与单位经济假设；需运营数据或管理层说明。",
  "legal-ownership": "缺主体股权、合同与权属证明；需法律尽调材料。",
  "regulatory-compliance": "缺监管路径与许可状态；需合规顾问意见或批复文件。",
  "resource-network": "缺关键合作方与渠道证据；需 MOU / 合同或访谈记录。",
  "comps-benchmark": "缺可比交易与市场对标；需卖方或第三方研报。",
  "valuation-returns": "缺投资额、估值与现金流输入；需 term sheet / 财务模型。",
  "diligence-gaps": "本批未收到结构化尽调缺口；需补全问题清单与责任人。",
  "risks-mitigation": "缺项目级风险登记与缓释措施；需尽调与法务输入。",
  "timeline-milestones": "暂无已核实的项目级时间节点；需会议纪要或交易里程碑。",
  "decision-framework": "缺明确 go/no-go 条件与下一步；需 IC 输入或管理层结论。",
};

/** Worker 确定性 gap stub（D-α 兜底 · fragmentOrigin=worker-stub） */
export function renderWorkerGapStubFragment(
  slot: CanonicalKbSlot,
  opts?: { projectTitle?: string },
): string {
  const meta = SLOT_DEFAULT_TITLES[slot];
  const hint =
    SLOT_GAP_HINTS[slot] ??
    "本板块在本轮生成中未收到有效 fragment；需补充项目资料后重跑。";
  const title = opts?.projectTitle?.trim();
  const lead = title
    ? `「${title}」${meta.title}：资料不足，以下为 Worker 占位缺口说明。`
    : `${meta.title}：资料不足，以下为 Worker 占位缺口说明。`;

  return (
    `<section class="block kb-panel" id="${slot}">` +
    `<h2 class="section-title"><span class="section-num">${esc(meta.num)}</span>${esc(meta.title)}</h2>` +
    `<aside class="callout missing"><div class="callout-title">缺乏资料</div>` +
    `<p>${esc(lead)}</p><ul><li>${esc(hint)}</li>` +
    `<li>来源：Worker stub（本 slot 未收到 Hermes fragment 或 repair 后仍缺失）</li></ul></aside>` +
    `</section>`
  );
}

export function renderWorkerGapStubAppendixGlossary(): string {
  return (
    `<section class="block kb-panel" id="glossary">` +
    `<h2 class="section-title"><span class="section-num">B</span>附录 B · 术语表</h2>` +
    `<aside class="callout missing"><div class="callout-title">缺乏资料</div>` +
    `<p>本轮未收到术语表 fragment；待项目资料稳定后补充。</p></aside></section>`
  );
}

export function renderWorkerGapStubAppendixDataDictionary(): string {
  return (
    `<section class="block kb-panel" id="data-dictionary">` +
    `<h2 class="section-title"><span class="section-num">C</span>附录 C · 数据字典、模型假设与数据证据底稿</h2>` +
    `<aside class="callout missing"><div class="callout-title">缺乏资料</div>` +
    `<p>本轮未收到数据字典 fragment；财务模型字段待补。</p></aside></section>`
  );
}
