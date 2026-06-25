import { describe, expect, it } from "vitest";
import {
  buildContentRevisionFromHintDoc,
  buildDocumentContentRevisionKey,
  buildMaterialSnapshotFingerprint,
  buildMaterialSnapshotFromDocuments,
} from "./knowledge-network-material-snapshot";
import type { MaterialHintDocument } from "./knowledge-network-material-hints";

describe("knowledge-network-material-snapshot", () => {
  const doc: MaterialHintDocument = {
    id: "doc-1",
    filename: "尽调.pdf",
    scope: "package",
    mime: "application/pdf",
    parsed: true,
    chunkCount: 42,
    sampleText: "sample",
  };

  it("buildDocumentContentRevisionKey matches D0 spec", () => {
    expect(
      buildDocumentContentRevisionKey({
        documentId: "uuid",
        chunkCount: 42,
        embedModel: "text-embedding-v4",
        embedDimension: 1024,
      }),
    ).toBe("uuid:42:text-embedding-v4:1024");
  });

  it("fingerprint is stable regardless of document order", () => {
    const a = buildMaterialSnapshotFromDocuments([doc], {
      EMBED_MODEL: "text-embedding-v4",
      EMBED_DIMENSION: "1024",
    });
    const doc2: MaterialHintDocument = { ...doc, id: "doc-2", chunkCount: 10 };
    const b = buildMaterialSnapshotFromDocuments([doc2, doc], {
      EMBED_MODEL: "text-embedding-v4",
      EMBED_DIMENSION: "1024",
    });
    const keys = b.documents.map((d) => buildDocumentContentRevisionKey(d)).sort();
    expect(b.fingerprint).toBe(keys.join("|"));
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("buildContentRevisionFromHintDoc uses env embed settings", () => {
    expect(
      buildContentRevisionFromHintDoc(doc, {
        EMBED_MODEL: "text-embedding-v4",
        EMBED_DIMENSION: "1024",
      }),
    ).toBe("doc-1:42:text-embedding-v4:1024");
  });

  it("buildMaterialSnapshotFingerprint matches sorted revision keys", () => {
    const rows = [
      { documentId: "b", chunkCount: 1, embedModel: "m", embedDimension: 1 },
      { documentId: "a", chunkCount: 2, embedModel: "m", embedDimension: 1 },
    ];
    expect(buildMaterialSnapshotFingerprint(rows)).toBe("a:2:m:1|b:1:m:1");
  });
});
