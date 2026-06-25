import { describe, expect, it } from "vitest";
import {
  buildReadingPlanFromDocuments,
  type ReadingPlanCacheContext,
} from "./knowledge-network-reading-plan";
import type { MaterialHintDocument } from "./knowledge-network-material-hints";
import type { MaterialSnapshot } from "./knowledge-network-material-snapshot";
import type { ChunkRow } from "./search";

const baseDoc: MaterialHintDocument = {
  id: "doc-dd",
  filename: "尽调报告.pdf",
  scope: "package",
  mime: "application/pdf",
  parsed: true,
  chunkCount: 42,
  sampleText: "项目尽调摘要内容足够长以通过占位检测",
};

const chunks: ChunkRow[] = [
  {
    id: "c1",
    document_id: "doc-dd",
    chunk_index: 0,
    text: baseDoc.sampleText,
    filename: baseDoc.filename,
    scope: "package",
  },
];

const previousSnapshot: MaterialSnapshot = {
  capturedAt: "2026-01-01T00:00:00.000Z",
  fingerprint: "doc-dd:42:text-embedding-v4:1024",
  documents: [
    {
      documentId: "doc-dd",
      chunkCount: 42,
      embedModel: "text-embedding-v4",
      embedDimension: 1024,
    },
  ],
};

describe("reading plan readMode cached (D5)", () => {
  const env = { EMBED_MODEL: "text-embedding-v4", EMBED_DIMENSION: "1024" };

  it("marks unchanged docs cached when previous project snapshot matches", () => {
    const cacheContext: ReadingPlanCacheContext = {
      previousProjectSnapshot: previousSnapshot,
    };
    const plan = buildReadingPlanFromDocuments({
      mode: "full",
      userMessage: "全量重做知识网络",
      touchedSlots: ["snapshot"],
      documents: [baseDoc],
      chunks,
      slotBatchScoped: true,
      cacheContext,
      env,
    });
    const mustRead = plan?.slots?.snapshot?.mustRead ?? [];
    expect(mustRead.some((f) => f.fileId === "doc-dd" && f.readMode === "cached")).toBe(true);
  });

  it("marks cached for batchIndex > 0 within same job", () => {
    const cacheContext: ReadingPlanCacheContext = {
      batchIndex: 2,
      currentSnapshot: previousSnapshot,
    };
    const plan = buildReadingPlanFromDocuments({
      mode: "full",
      userMessage: "全量重做",
      touchedSlots: ["industry-market"],
      documents: [baseDoc],
      chunks,
      slotBatchScoped: true,
      cacheContext,
      env,
    });
    const refs = [
      ...(plan?.slots?.["industry-market"]?.mustRead ?? []),
      ...(plan?.slots?.["industry-market"]?.shouldRead ?? []),
    ];
    const dd = refs.find((r) => r.fileId === "doc-dd");
    expect(dd?.readMode).toBe("cached");
  });

  it("does not mark cached when chunkCount changed", () => {
    const changedDoc = { ...baseDoc, chunkCount: 43 };
    const cacheContext: ReadingPlanCacheContext = {
      previousProjectSnapshot: previousSnapshot,
    };
    const plan = buildReadingPlanFromDocuments({
      mode: "full",
      userMessage: "全量重做",
      touchedSlots: ["snapshot"],
      documents: [changedDoc],
      chunks,
      slotBatchScoped: true,
      cacheContext,
      env,
    });
    const mustRead = plan?.slots?.snapshot?.mustRead ?? [];
    const dd = mustRead.find((f) => f.fileId === "doc-dd");
    expect(dd?.readMode).not.toBe("cached");
  });
});
