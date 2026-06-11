import * as XLSX from "xlsx";

const MAX_SPREADSHEET_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 800;
const MAX_COLS = 40;
const MAX_EXTRACT_CHARS = 120_000;

export type SpreadsheetExtractResult = {
  text: string;
  sheetCount: number;
  parsed: boolean;
  warning?: string;
};

type XlsxLike = typeof import("xlsx");

/** Cloudflare Workers 下 sheet_to_json / sheet_to_csv 不可靠，直接扫 !ref */
function sheetRowsFromWorksheet(
  sheet: import("xlsx").WorkSheet,
  XLSX: XlsxLike,
): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: unknown[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as { v?: unknown; w?: string } | undefined;
      row.push(cell?.w ?? cell?.v ?? "");
    }
    if (row.some((c) => cellToPlain(c))) {
      rows.push(row);
    }
  }
  return rows;
}

function cellToPlain(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).replace(/\s+/gu, " ").trim();
}

export async function extractSpreadsheetPlainText(
  data: ArrayBuffer,
  filename: string,
): Promise<SpreadsheetExtractResult> {
  if (data.byteLength > MAX_SPREADSHEET_BYTES) {
    return {
      text: "",
      sheetCount: 0,
      parsed: false,
      warning: `表格超过 ${Math.round(MAX_SPREADSHEET_BYTES / 1024 / 1024)}MB，请拆分为多个文件或导出 CSV 后上传。`,
    };
  }

  try {
    // dense:true 在 Cloudflare Workers 下会导致 sheet_to_json 读不到单元格（Node 正常）
    const wb = XLSX.read(new Uint8Array(data), {
      type: "array",
      cellDates: true,
    });
    const names = wb.SheetNames ?? [];
    if (names.length === 0) {
      return {
        text: "",
        sheetCount: 0,
        parsed: false,
        warning: "工作簿中没有工作表。",
      };
    }

    const blocks: string[] = [];
    let totalChars = 0;
    const warnings: string[] = [];

    for (let si = 0; si < names.length; si++) {
      const name = names[si];
      const sheet = wb.Sheets[name];
      if (!sheet) continue;

      let rows = sheetRowsFromWorksheet(sheet, XLSX);

      if (!rows.length) continue;

      const lines: string[] = [`### 工作表：${name}`];
      const rowLimit = Math.min(rows.length, MAX_ROWS);
      if (rows.length > MAX_ROWS) {
        warnings.push(`工作表「${name}」仅保留前 ${MAX_ROWS} 行。`);
      }

      const colTruncated = rows.some((row) => (row ?? []).length > MAX_COLS);
      if (colTruncated) {
        warnings.push(`工作表「${name}」列数较多，仅保留前 ${MAX_COLS} 列。`);
      }

      for (let r = 0; r < rowLimit; r++) {
        const row = rows[r] ?? [];
        const cells = row.slice(0, MAX_COLS).map((c) => cellToPlain(c));
        if (cells.every((c) => !c)) continue;
        lines.push(cells.join("\t"));
      }

      if (lines.length <= 1) continue;
      let block = lines.join("\n");
      const budget = MAX_EXTRACT_CHARS - totalChars;
      if (block.length > budget) {
        block = block.slice(0, Math.max(0, budget));
        warnings.push(`正文过长，已截断至 ${MAX_EXTRACT_CHARS} 字预算。`);
      }
      if (!block.trim()) continue;
      blocks.push(block);
      totalChars += block.length;
      if (totalChars >= MAX_EXTRACT_CHARS) break;
    }

    let body = blocks.join("\n\n");
    if (!body.trim()) {
      return {
        text: "",
        sheetCount: names.length,
        parsed: false,
        warning: "未能从表格中读取到有效单元格数据（可能为空表或受保护）。",
      };
    }

    if (body.length > MAX_EXTRACT_CHARS) {
      body = body.slice(0, MAX_EXTRACT_CHARS);
      warnings.push(`正文过长，仅保留前 ${MAX_EXTRACT_CHARS} 字供检索。`);
    }

    const header = `【${filename} · Excel 提取正文（制表符分隔）】\n`;
    return {
      text: header + body,
      sheetCount: names.length,
      parsed: true,
      warning: warnings.length > 0 ? [...new Set(warnings)].join(" ") : undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      text: "",
      sheetCount: 0,
      parsed: false,
      warning: `Excel 解析失败：${msg}。可另存为 CSV 或 .txt 后上传。`,
    };
  }
}
