import { extractText, getDocumentProxy } from "unpdf";

/** Worker 单次上传 PDF 体积上限（避免 CPU 超时） */
const MAX_PDF_BYTES = 12 * 1024 * 1024;
/** 提取正文最大字符数（入库分块用） */
const MAX_EXTRACT_CHARS = 120_000;

export type PdfExtractResult = {
  text: string;
  totalPages: number;
  parsed: boolean;
  warning?: string;
};

export async function extractPdfPlainText(
  data: ArrayBuffer,
  filename: string,
): Promise<PdfExtractResult> {
  if (data.byteLength > MAX_PDF_BYTES) {
    return {
      text: "",
      totalPages: 0,
      parsed: false,
      warning: `PDF 超过 ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB，请压缩或改为 .txt/.md 上传。`,
    };
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    let body = (text || "").replace(/\s+/gu, " ").trim();

    if (!body) {
      return {
        text: "",
        totalPages,
        parsed: false,
        warning:
          "未能从 PDF 提取文字（多为扫描件/图片版）。请上传可复制文字的 PDF，或另附 .txt/.md。",
      };
    }

    let warning: string | undefined;
    if (body.length > MAX_EXTRACT_CHARS) {
      body = body.slice(0, MAX_EXTRACT_CHARS);
      warning = `正文过长，仅保留前 ${MAX_EXTRACT_CHARS} 字供检索。`;
    }
    if (totalPages > 80) {
      warning = [warning, `PDF 共 ${totalPages} 页，已全部合并提取；超大文档建议拆分为多个文件。`]
        .filter(Boolean)
        .join(" ");
    }

    const header = `【${filename} · PDF 提取正文】\n`;
    return {
      text: header + body,
      totalPages,
      parsed: true,
      warning,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      text: "",
      totalPages: 0,
      parsed: false,
      warning: `PDF 解析失败：${msg}`,
    };
  }
}
