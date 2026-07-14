import { describe, expect, it } from "vitest";
import {
  EMBED_BATCH_SIZE,
  normalizeEmbedInputs,
  resolveDashScopeEmbedUrl,
  resolveEmbedDimension,
  resolveEmbedModel,
} from "./embeddings";

describe("embeddings config", () => {
  it("defaults to text-embedding-v4", () => {
    expect(resolveEmbedModel({})).toBe("text-embedding-v4");
    expect(resolveEmbedDimension({})).toBe(1024);
  });

  it("maps compatible-mode base to native embedding endpoint", () => {
    expect(
      resolveDashScopeEmbedUrl("https://dashscope.aliyuncs.com/compatible-mode/v1"),
    ).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
    );
  });

  it("truncates long inputs for embedding", () => {
    const long = "x".repeat(8000);
    const [one] = normalizeEmbedInputs([long]);
    expect(one!.length).toBeLessThanOrEqual(6000);
  });

  it("uses official batch size of 10", () => {
    expect(EMBED_BATCH_SIZE).toBe(10);
  });
});
