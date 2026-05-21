import { describe, it, expect } from "vitest";
import { runAutomationInputSchema } from "../schemas";

describe("runAutomationInputSchema", () => {
  it("정상 입력 파싱 성공", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "insights-collect", force: false });
    expect(r.success).toBe(true);
  });

  it("jobId 빈 문자열 거부", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "", force: false });
    expect(r.success).toBe(false);
  });

  it("force 누락 거부", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "x" });
    expect(r.success).toBe(false);
  });
});
