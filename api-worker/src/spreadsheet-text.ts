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
    const wb = XLSX.read(new Uint8Array(data), {
      type: "array",
      cellDates: true,
      dense: true,
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

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];

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

      const block = lines.join("\n");
      if (!block.trim()) continue;
      if (totalChars + block.length > MAX_EXTRACT_CHARS) {
        warnings.push(`正文过长，后续工作表未纳入检索。`);
        break;
      }
      blocks.push(block);
      totalChars += block.length;
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
