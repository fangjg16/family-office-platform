import { describe, expect, it } from "vitest";
import {
  isFragmentGenerationSession,
  resolveKnGenerationMode,
  userMessageRequestsFragmentGeneration,
  userMessageRequestsStructuredGeneration,
} from "./knowledge-network-generation-mode";

describe("resolveKnGenerationMode", () => {
  it("defaults to fragment when env unset", () => {
    expect(resolveKnGenerationMode({})).toBe("fragment");
  });

  it("respects KN_GENERATION_MODE=structured", () => {
    expect(resolveKnGenerationMode({ KN_GENERATION_MODE: "structured" })).toBe("structured");
    expect(resolveKnGenerationMode({ KN_GENERATION_MODE: "json" })).toBe("structured");
  });

  it("user message slot-batch-structured overrides env fragment", () => {
    expect(
      resolveKnGenerationMode(
        { KN_GENERATION_MODE: "fragment" },
        { userMessage: "请用 slot-batch-structured 回退" },
      ),
    ).toBe("structured");
  });

  it("user message fragment-batch forces fragment", () => {
    expect(
      resolveKnGenerationMode(
        { KN_GENERATION_MODE: "structured" },
        { userMessage: "smoke kb-fragment-batch" },
      ),
    ).toBe("fragment");
  });
});

describe("generation mode helpers", () => {
  it("detects structured override phrases", () => {
    expect(userMessageRequestsStructuredGeneration("slot-batch-structured")).toBe(true);
    expect(userMessageRequestsStructuredGeneration("structured-slot-batch 模式")).toBe(true);
    expect(userMessageRequestsStructuredGeneration("fragment-batch")).toBe(false);
  });

  it("detects fragment override phrases", () => {
    expect(userMessageRequestsFragmentGeneration("kb-fragment-batch")).toBe(true);
    expect(userMessageRequestsFragmentGeneration("slot-batch-fragment smoke")).toBe(true);
    expect(userMessageRequestsFragmentGeneration("slot-batch-structured")).toBe(false);
  });

  it("isFragmentGenerationSession reads session.generationMode", () => {
    expect(isFragmentGenerationSession({ generationMode: "fragment" })).toBe(true);
    expect(isFragmentGenerationSession({ generationMode: "structured" })).toBe(false);
  });
});
