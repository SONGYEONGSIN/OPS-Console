import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const generateContentMock = vi.fn();
vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAI {
    constructor(_apiKey: string) {
      void _apiKey;
    }
    getGenerativeModel() {
      return { generateContent: generateContentMock };
    }
  }
  return { GoogleGenerativeAI };
});

describe("askGemini", () => {
  const origKey = process.env.GEMINI_API_KEY;
  beforeEach(() => {
    generateContentMock.mockReset();
    vi.resetModules();
  });
  afterEach(() => {
    process.env.GEMINI_API_KEY = origKey;
  });

  it("GEMINI_API_KEY 누락 시 ok:false", async () => {
    delete process.env.GEMINI_API_KEY;
    const { askGemini } = await import("../gemini");
    const r = await askGemini({ systemInstruction: "x", userContent: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("GEMINI_API_KEY");
  });

  it("정상 응답 — text 반환", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockResolvedValue({
      response: { text: () => "안녕하세요" },
    });
    const { askGemini } = await import("../gemini");
    const r = await askGemini({
      systemInstruction: "사내 어시스턴트",
      userContent: "질문",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("안녕하세요");
  });

  it("SDK throw → ok:false + gemini_error prefix", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockRejectedValue(new Error("rate limit"));
    const { askGemini } = await import("../gemini");
    const r = await askGemini({ systemInstruction: "x", userContent: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("gemini_error");
  });
});
