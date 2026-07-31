import { describe, it, expect } from "vitest";
import {
  runAutomationInputSchema,
  setAutomationEnabledInputSchema,
  publishBriefingDraftInputSchema,
} from "../schemas";

describe("runAutomationInputSchema", () => {
  it("정상 입력 파싱 성공", () => {
    const r = runAutomationInputSchema.safeParse({
      jobId: "insights-collect",
      force: false,
    });
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

describe("setAutomationEnabledInputSchema", () => {
  it("정상 입력 파싱 성공", () => {
    expect(
      setAutomationEnabledInputSchema.safeParse({ jobId: "x", enabled: true })
        .success,
    ).toBe(true);
  });
  it("enabled 누락 거부", () => {
    expect(
      setAutomationEnabledInputSchema.safeParse({ jobId: "x" }).success,
    ).toBe(false);
  });
  it("jobId 빈 문자열 거부", () => {
    expect(
      setAutomationEnabledInputSchema.safeParse({ jobId: "", enabled: false })
        .success,
    ).toBe(false);
  });
});

describe("publishBriefingDraftInputSchema", () => {
  it("uuid draftId 허용", () => {
    expect(
      publishBriefingDraftInputSchema.safeParse({
        draftId: "11111111-2222-4333-8444-555555555555",
      }).success,
    ).toBe(true);
  });
  it("빈 값 거부", () => {
    expect(
      publishBriefingDraftInputSchema.safeParse({ draftId: "" }).success,
    ).toBe(false);
  });
  it("uuid 아닌 문자열 거부", () => {
    expect(
      publishBriefingDraftInputSchema.safeParse({ draftId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});
