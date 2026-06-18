/**
 * 中文 slot alias / delivery / mode 话术回归（v2.91 13-slot）
 * 用法：cd api-worker && npx tsx scripts/test-kb-slot-alias-zh.ts
 */
import { isKnowledgeNetworkDeliveryIntent } from "../src/knowledge-network-intent.ts";
import { detectKnowledgeNetworkUpdateMode } from "../src/knowledge-network-mode.ts";
import {
  resolveKnowledgeNetworkSlotsFromMessage,
  isKnowledgeNetworkReorderIntent,
} from "../src/knowledge-network-slot-aliases.ts";

type Case = {
  label: string;
  message: string;
  expectDelivery: boolean;
  expectMode: "incremental" | "reorder";
  expectSlots: string[];
};

const UPDATE_CASES: Case[] = [
  {
    label: "只更新项目时间轴",
    message: "只更新项目时间轴",
    expectDelivery: true,
    expectMode: "incremental",
    expectSlots: ["timeline-milestones"],
  },
  {
    label: "只更新关键风险",
    message: "只更新关键风险",
    expectDelivery: true,
    expectMode: "incremental",
    expectSlots: ["risks-mitigation"],
  },
  {
    label: "补一下待确认问题",
    message: "补一下待确认问题",
    expectDelivery: true,
    expectMode: "incremental",
    expectSlots: ["diligence-gaps"],
  },
  {
    label: "只更新投资回报假设",
    message: "只更新投资回报假设",
    expectDelivery: true,
    expectMode: "incremental",
    expectSlots: ["valuation-returns"],
  },
  {
    label: "更新监管合规",
    message: "更新监管合规",
    expectDelivery: true,
    expectMode: "incremental",
    expectSlots: ["regulatory-compliance"],
  },
];

const REORDER_CASES: Case[] = [
  {
    label: "把项目时间轴移到法律结构后面",
    message: "把项目时间轴移到法律结构后面",
    expectDelivery: true,
    expectMode: "reorder",
    expectSlots: ["legal-ownership", "timeline-milestones"],
  },
  {
    label: "把市场对标提前到业务模式前面",
    message: "把市场对标提前到业务模式前面",
    expectDelivery: true,
    expectMode: "reorder",
    expectSlots: ["business-operations", "comps-benchmark"],
  },
  {
    label: "重排章节顺序",
    message: "重排章节顺序",
    expectDelivery: true,
    expectMode: "reorder",
    expectSlots: [],
  },
];

let failed = 0;

function eqArrays(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function runCase(c: Case) {
  const delivery = isKnowledgeNetworkDeliveryIntent(c.message);
  const mode = detectKnowledgeNetworkUpdateMode(c.message, true);
  const slots = resolveKnowledgeNetworkSlotsFromMessage(c.message);
  const okDelivery = delivery === c.expectDelivery;
  const okMode = mode === c.expectMode;
  const okSlots = eqArrays(slots, c.expectSlots);
  const ok = okDelivery && okMode && okSlots;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.label}`);
  if (!okDelivery) console.log(`  delivery: got ${delivery}, want ${c.expectDelivery}`);
  if (!okMode) console.log(`  mode: got ${mode}, want ${c.expectMode}`);
  if (!okSlots) console.log(`  slots: got [${slots.join(", ")}], want [${c.expectSlots.join(", ")}]`);
}

console.log("=== 5 条中文更新话术 ===\n");
for (const c of UPDATE_CASES) runCase(c);

console.log("\n=== 3 条中文重排话术 ===\n");
for (const c of REORDER_CASES) runCase(c);

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
