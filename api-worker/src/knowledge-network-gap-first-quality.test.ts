import { describe, expect, it } from "vitest";
import {
  evaluateLegalOwnershipLayers,
  evaluateRegulatoryComplianceLayers,
  isStructuredRegulatoryGapRow,
} from "./knowledge-network-gap-first-quality";
import { evaluateSlotQuality } from "./knowledge-network-full-quality-contract";
import { isMeaningfulCell, pickRowCell } from "./knowledge-network-content-row-quality";
import { renderSlotPayloadByCanonicalSlot } from "./knowledge-network-slot-render";

function legalGap(i: number) {
  return {
    issue: `权属待确认 ${i}`,
    whyItMatters: `影响投资主体认定 ${i}`,
    requiredEvidence: `股权/章程文件 ${i}`,
    owner: `卖方法务 ${i}`,
    decisionImpact: `确认前不宜推进交割 ${i}`,
    riskLevel: "中",
  };
}

function regGap(i: number) {
  return {
    jurisdiction: "哈萨克斯坦",
    requirement: `进出口许可 ${i}`,
    currentEvidence: "未提供",
    gap: "待确认/需法律意见",
    nextAction: `向当地律师索取清单 ${i}`,
    riskLevel: "高",
  };
}

describe("gap-first legal-ownership", () => {
  it("passes with low factCoverage and high gapCoverage", () => {
    const payload = {
      entities: [
        {
          "主体/权利": "目标公司（待确认）",
          "角色/归属": "持股结构未披露",
          "限制/负担": "待法律尽调",
          "证据/缺口": "资料未提供",
        },
      ],
      unresolvedLegalIssues: [1, 2, 3, 4].map(legalGap),
    };
    const layers = evaluateLegalOwnershipLayers(payload);
    expect(layers.gapFirstMode).toBe(true);
    expect(layers.pass).toBe(true);
    expect(layers.score).toBeLessThanOrEqual(72);
    expect(layers.factCoverage).toBeLessThan(50);
    expect(layers.gapCoverage).toBeGreaterThanOrEqual(75);

    const q = evaluateSlotQuality("legal-ownership", payload);
    expect(q.ok).toBe(true);
    expect(q.gapFirstMode).toBe(true);
  });

  it("renders gap table instead of empty fact tables", () => {
    const payload = {
      entities: [
        {
          "主体/权利": "目标公司（待确认）",
          "角色/归属": "持股结构未披露",
          "限制/负担": "待法律尽调",
          "证据/缺口": "资料未提供",
        },
      ],
      unresolvedLegalIssues: [1, 2, 3, 4].map(legalGap),
    };
    const html = renderSlotPayloadByCanonicalSlot("legal-ownership", payload);
    expect(html).toContain("法律缺口 / 权属待确认");
    expect(html).toContain("gap-coverage-table");
    expect(html).not.toContain("合同权利：暂无有效数据");
  });
});

describe("gap-first regulatory-compliance", () => {
  it("accepts structured regulatory gap row shape", () => {
    const row = regGap(1);
    const jurisdiction = pickRowCell(row, ["jurisdiction", "辖区", "监管辖区", "地区"]);
    const requirement = pickRowCell(row, ["requirement", "监管要求", "许可要求", "规则"]);
    const evidence = pickRowCell(row, [
      "currentEvidence",
      "现有证据",
      "当前证据",
      "已有资料",
      "evidence",
    ]);
    const gap = pickRowCell(row, ["gap", "缺口", "缺失", "待确认", "unknown"]);
    const next = pickRowCell(row, ["nextAction", "下一步", "验证路径", "nextStep", "action"]);
    const risk = pickRowCell(row, ["riskLevel", "风险级别", "risk", "风险"]);
    expect(jurisdiction).toBeTruthy();
    expect(requirement).toBeTruthy();
    expect(gap).toBeTruthy();
    expect(next).toBeTruthy();
    expect(isMeaningfulCell(jurisdiction)).toBe(true);
    expect(isMeaningfulCell(requirement)).toBe(true);
    expect(isMeaningfulCell(gap)).toBe(true);
    expect(isMeaningfulCell(next)).toBe(true);
    expect(isMeaningfulCell(evidence) || /待确认|需法律|缺口|未提供/i.test(gap)).toBe(true);
    expect(/^(高|中|低)$/i.test(risk)).toBe(true);
    expect(isStructuredRegulatoryGapRow(row)).toBe(true);
  });

  it("passes with regulatoryGaps only", () => {
    const payload = { regulatoryGaps: [1, 2, 3, 4].map(regGap) };
    const layers = evaluateRegulatoryComplianceLayers(payload);
    expect(layers.gapFirstMode).toBe(true);
    expect(layers.pass).toBe(true);
    expect(layers.score).toBeLessThanOrEqual(72);

    const q = evaluateSlotQuality("regulatory-compliance", payload);
    expect(q.ok).toBe(true);
  });

  it("rejects fabricated license without evidence", () => {
    const payload = {
      jurisdictionRows: [
        { "监管/规则": "进出口", "适用原因": "贸易", "状态/许可": "已取得", "红线/下一步": "—" },
        { "监管/规则": "外汇", "适用原因": "结算", "状态/许可": "有效", "红线/下一步": "—" },
      ],
      licenseRequirements: [{ 许可要求: "A", 发证机关: "—", 状态: "已取得", 缺口: "—" }],
    };
    const layers = evaluateRegulatoryComplianceLayers(payload);
    expect(layers.pass).toBe(false);
    expect(layers.issues.some((i) => i.code === "fabricated_license")).toBe(true);
  });

  it("renders regulatory gap table when facts insufficient", () => {
    const payload = { regulatoryGaps: [1, 2, 3, 4].map(regGap) };
    const html = renderSlotPayloadByCanonicalSlot("regulatory-compliance", payload);
    expect(html).toContain("监管缺口 / 验证路径");
    expect(html).not.toContain("监管合规：暂无有效数据");
  });
});
