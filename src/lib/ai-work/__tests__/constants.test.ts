import { describe, it, expect } from "vitest";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  AI_TOOL_OPTIONS,
  CATEGORY_LABEL,
  CATEGORY_TONE,
  CATEGORY_OPTIONS,
} from "../constants";
import { aiToolSchema, categorySchema } from "@/features/ai-work/schemas";

describe("AI_TOOL constants", () => {
  it("AI_TOOL_LABEL이 aiToolSchema의 모든 enum을 커버한다", () => {
    for (const tool of aiToolSchema.options) {
      expect(AI_TOOL_LABEL[tool]).toBeTruthy();
    }
  });

  it("AI_TOOL_TONE이 모든 enum을 커버한다", () => {
    for (const tool of aiToolSchema.options) {
      expect(AI_TOOL_TONE[tool]).toBeTruthy();
    }
  });

  it("AI_TOOL_OPTIONS 개수가 enum 개수와 일치", () => {
    expect(AI_TOOL_OPTIONS.length).toBe(aiToolSchema.options.length);
  });

  it("AI_TOOL 라벨에 한자 사용 0", () => {
    for (const label of Object.values(AI_TOOL_LABEL)) {
      expect(/[一-鿿]/.test(label)).toBe(false);
    }
  });
});

describe("CATEGORY constants", () => {
  it("CATEGORY_LABEL이 categorySchema의 모든 enum을 커버한다", () => {
    for (const cat of categorySchema.options) {
      expect(CATEGORY_LABEL[cat]).toBeTruthy();
    }
  });

  it("CATEGORY_TONE이 모든 enum을 커버한다", () => {
    for (const cat of categorySchema.options) {
      expect(CATEGORY_TONE[cat]).toBeTruthy();
    }
  });

  it("CATEGORY_OPTIONS 개수가 enum 개수와 일치", () => {
    expect(CATEGORY_OPTIONS.length).toBe(categorySchema.options.length);
  });

  it("CATEGORY 라벨에 한자 사용 0", () => {
    for (const label of Object.values(CATEGORY_LABEL)) {
      expect(/[一-鿿]/.test(label)).toBe(false);
    }
  });
});
