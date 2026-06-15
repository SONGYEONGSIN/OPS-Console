import { describe, it, expect } from "vitest";
import { buildRunRow } from "../run-recorder";

describe("buildRunRow", () => {
  it("실행 결과를 automation_runs 행으로 변환한다 (기본값)", () => {
    expect(
      buildRunRow("smileedi-mail", { ok: true, message: "2건 발송" }),
    ).toEqual({
      job_id: "smileedi-mail",
      ok: true,
      skipped: false,
      message: "2건 발송",
      duration_ms: null,
    });
  });

  it("skipped / duration_ms를 반영한다", () => {
    expect(
      buildRunRow("smileedi-mail", {
        ok: true,
        skipped: true,
        message: "자동 실행 OFF",
        durationMs: 1234,
      }),
    ).toEqual({
      job_id: "smileedi-mail",
      ok: true,
      skipped: true,
      message: "자동 실행 OFF",
      duration_ms: 1234,
    });
  });

  it("실패 결과도 그대로 담는다", () => {
    const row = buildRunRow("closing-scrape", {
      ok: false,
      message: "시트 미연결",
      durationMs: 50,
    });
    expect(row.ok).toBe(false);
    expect(row.message).toBe("시트 미연결");
    expect(row.duration_ms).toBe(50);
  });

  it("message가 너무 길면 1000자로 자른다", () => {
    const long = "가".repeat(1500);
    const row = buildRunRow("insights-collect", { ok: true, message: long });
    expect(row.message.length).toBe(1000);
  });
});
