import { getProjectResourceDemo } from "@/workspace/project-resource-demos";

/** 演示：南宁等项目在对话侧栏展示的历史文件名 */
const DEMO_PACKAGE_FILE_NAMES: Record<string, string[]> = {
  "nn-fresh-port": [
    "尽调报告－嘉兴中润海盐冷链产业园区.pdf",
    "南宁生鲜食品智慧港项目介绍.pdf",
    "嘉兴中润项目推介.pdf",
    "尽调报告二 南宁东盟生鲜食品智慧港.pdf",
  ],
};

/** 从演示剧本收集附件文件名（资源表 / 追问轮次） */
export function getDemoProjectFileNames(projectId: string): string[] {
  const names = new Set<string>();
  (DEMO_PACKAGE_FILE_NAMES[projectId] ?? []).forEach((n) => names.add(n));
  try {
    const demo = getProjectResourceDemo(projectId);
    demo.chat.supplyExchanges?.forEach((ex) => {
      ex.attachments?.forEach((f) => names.add(f.name));
    });
    demo.chat.midFollowUp?.forEach((step) => {
      if (step.kind === "text" && step.attachments) {
        step.attachments.forEach((f) => names.add(f.name));
      }
    });
  } catch {
    /* 无演示配置时仅返回静态表 */
  }
  return Array.from(names);
}
