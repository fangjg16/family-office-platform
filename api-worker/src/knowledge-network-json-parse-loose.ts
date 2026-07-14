import { jsonrepair } from "jsonrepair";

export type LooseJsonParseResult =
  | { ok: true; value: unknown; repaired: boolean }
  | { ok: false; error: string };

/** 先 JSON.parse；失败则用 jsonrepair 再 parse 一次（P2：repair 轮之前的本地兜底） */
export function parseJsonLoose(text: string): LooseJsonParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "empty JSON block" };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown, repaired: false };
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    try {
      const repairedText = jsonrepair(trimmed);
      return { ok: true, value: JSON.parse(repairedText) as unknown, repaired: true };
    } catch (secondErr) {
      const secondMsg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      return { ok: false, error: `${firstMsg}; jsonrepair: ${secondMsg}` };
    }
  }
}
