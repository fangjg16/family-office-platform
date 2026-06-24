import type { CanonicalKbSlot } from "./knowledge-network-slot-aliases";
import type { KnSlotBatchSession } from "./knowledge-network-slot-batch-types";

export type WorkerStubAppendixSlot = "glossary" | "data-dictionary";

export function formatWorkerStubAuditAnswerBlock(session: KnSlotBatchSession): string {
  const slots = session.workerStubSlots ?? [];
  const appendix = session.workerStubAppendix ?? [];
  if (!slots.length && !appendix.length) return "";

  const lines = [
    "",
    "**审计 · Worker gap stub（非 Hermes 交付）**",
    "以下板块在 repair 后仍未收到 Hermes fragment，由 Worker 注入确定性缺资料占位：",
  ];
  if (slots.length) {
    lines.push(`- canonical slots：${slots.join(", ")}`);
  }
  if (appendix.length) {
    lines.push(`- 附录：${appendix.join(", ")}`);
  }
  lines.push(
    "页面中对应 section 含 `Worker stub` 标记；请勿视为 Hermes 正常生成内容。",
  );
  return lines.join("\n");
}

export function hasWorkerStubAudit(session: KnSlotBatchSession): boolean {
  return (
    (session.workerStubSlots?.length ?? 0) > 0 ||
    (session.workerStubAppendix?.length ?? 0) > 0
  );
}

export function collectWorkerStubAuditFromDelivery(
  session: KnSlotBatchSession,
): { slots: CanonicalKbSlot[]; appendix: WorkerStubAppendixSlot[] } {
  const slots: CanonicalKbSlot[] = [];
  const appendix: WorkerStubAppendixSlot[] = [];
  for (const [key, meta] of Object.entries(session.fragmentDelivery ?? {})) {
    if (meta?.delivery !== "worker-stub") continue;
    if (key === "glossary" || key === "data-dictionary") {
      appendix.push(key);
    } else {
      slots.push(key as CanonicalKbSlot);
    }
  }
  return { slots, appendix };
}
