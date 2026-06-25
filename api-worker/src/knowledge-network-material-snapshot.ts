import type { MaterialHintDocument } from "./knowledge-network-material-hints";
import { resolveEmbedDimension, resolveEmbedModel, type EmbedEnv } from "./embeddings";

export type DocumentContentRevision = {
  documentId: string;
  chunkCount: number;
  embedModel: string;
  embedDimension: number;
  createdAt?: string;
};

export type MaterialSnapshot = {
  capturedAt: string;
  documents: DocumentContentRevision[];
  fingerprint: string;
};

export function buildDocumentContentRevisionKey(d: DocumentContentRevision): string {
  return `${d.documentId}:${d.chunkCount}:${d.embedModel}:${d.embedDimension}`;
}

export function buildContentRevisionFromHintDoc(
  doc: Pick<MaterialHintDocument, "id" | "chunkCount">,
  env?: EmbedEnv,
): string {
  return buildDocumentContentRevisionKey({
    documentId: doc.id,
    chunkCount: doc.chunkCount,
    embedModel: resolveEmbedModel(env ?? {}),
    embedDimension: resolveEmbedDimension(env ?? {}),
  });
}

export function buildMaterialSnapshotFingerprint(
  documents: readonly DocumentContentRevision[],
): string {
  return documents
    .map(buildDocumentContentRevisionKey)
    .sort()
    .join("|");
}

export function buildMaterialSnapshotFromDocuments(
  documents: readonly MaterialHintDocument[],
  env?: EmbedEnv,
): MaterialSnapshot {
  const embedModel = resolveEmbedModel(env ?? {});
  const embedDimension = resolveEmbedDimension(env ?? {});
  const rows: DocumentContentRevision[] = documents.map((doc) => ({
    documentId: doc.id,
    chunkCount: doc.chunkCount,
    embedModel,
    embedDimension,
  }));
  return {
    capturedAt: new Date().toISOString(),
    documents: rows,
    fingerprint: buildMaterialSnapshotFingerprint(rows),
  };
}
