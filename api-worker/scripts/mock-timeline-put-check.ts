import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateKnowledgeNetworkHtml } from "../src/knowledge-network-html-validation.ts";

const here = dirname(fileURLToPath(import.meta.url));
const sample = readFileSync(
  join(here, "../../hermes-railway/skills/knowledge-base-generation/examples/sample-output.html"),
  "utf8",
);

const stubTimeline = `<section class="block kb-panel" id="timeline">
<h3>8.1 已发生关键事件</h3><div class="callout missing"><div class="callout-title">暂无已核实的项目级时间轴事件</div>
<p>待项目方提供会议记录、签约节点或审批状态（公开行业资料不构成项目时间轴）。</p></div>
<h3>8.2 正在推进</h3><p>暂无推进中事项。</p>
<h3>8.3 未来关键节点</h3><table><thead><tr><th>节点</th></tr></thead><tbody><tr><td>待定</td></tr></tbody></table></section>`;

const projectTimeline = `<section class="block kb-panel" id="timeline">
<h3>8.1 已发生关键事件</h3><div class="timeline project-timeline"><div class="tl-item"><span class="tl-text"><strong>项目方召开首轮会议介绍 AI 版权合作方案</strong></span></div></div>
<h3>8.2 正在推进</h3><div class="timeline project-timeline"><div class="tl-item pending"><span class="tl-text"><strong>艺人授权协议草案审阅</strong></span></div></div>
<h3>8.3 未来关键节点</h3><table><thead><tr><th>节点</th></tr></thead><tbody><tr><td>监管备案截止前提交材料</td></tr></tbody></table></section>`;

function swapTimeline(html: string, replacement: string): string {
  return html.replace(
    /<section class="block kb-panel" id="timeline">[\s\S]*?<\/section>/i,
    replacement,
  );
}

const stubKb = swapTimeline(sample, stubTimeline);
const projectKb = swapTimeline(sample, projectTimeline);
const industryKb = readFileSync(join(here, "_acceptance-kb.html"), "utf8");

const vs = validateKnowledgeNetworkHtml(stubKb, { strict: true, mode: "full" });
const vp = validateKnowledgeNetworkHtml(projectKb, { strict: true, mode: "full" });
const vi = validateKnowledgeNetworkHtml(industryKb, { strict: true, mode: "full" });

console.log(
  JSON.stringify(
    {
      mockStub: {
        ok: vs.ok,
        warning: vs.warning ?? null,
        hasStub: /暂无已核实/.test(stubKb),
        noIndustryTimeline: !/市场规模|技术趋势/.test(stubKb),
      },
      mockProject: {
        ok: vp.ok,
        warning: vp.warning ?? null,
        hasMeeting: /首轮会议/.test(projectKb),
      },
      industryMisusePutSim: {
        ok: vi.ok,
        warning: vi.warning ?? null,
        blocksPut: vi.ok === false,
      },
    },
    null,
    2,
  ),
);
