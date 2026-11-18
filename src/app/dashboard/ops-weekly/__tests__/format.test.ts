import { describe, it, expect } from "vitest";
import { formatMdDow, formatMdHm, formatPeriod, formatYmd } from "../_format";

describe("format", () => {
  it("M/D HH:mm · M/D(요일) — KST 24시간제", () => {
    expect(formatMdHm("2026-11-19T15:30:00Z")).toBe("11/20 00:30");
    expect(formatMdDow("2026-11-18")).toBe("11/18(수)");
  });

  it("오후 표기 없이 24시간제, 자정은 00", () => {
    expect(formatMdHm("2026-11-19T08:05:00Z")).toBe("11/19 17:05");
    expect(formatMdHm("2026-11-19T15:00:00Z")).toBe("11/20 00:00");
  });
});

describe("formatYmd · formatPeriod — KST 날짜", () => {
  it("YYYY.MM.DD, 값이 없거나 깨졌으면 —", () => {
    expect(formatYmd("2026-11-19T15:30:00Z")).toBe("2026.11.20");
    expect(formatYmd(null)).toBe("—");
    expect(formatYmd("garbage")).toBe("—");
  });

  it("시작·종료가 같은 해면 종료의 연도를 생략한다", () => {
    expect(formatPeriod("2026-09-07T00:00:00Z", "2026-09-11T00:00:00Z")).toBe(
      "2026.09.07 ~ 09.11",
    );
  });

  it("해가 다르면 둘 다 연도를 적는다 — 1년 틀린 기간이 멀쩡해 보이면 안 된다", () => {
    expect(formatPeriod("2026-09-07T00:00:00Z", "2027-09-11T00:00:00Z")).toBe(
      "2026.09.07 ~ 2027.09.11",
    );
  });

  it("시작이 없으면 종료만", () => {
    expect(formatPeriod(null, "2026-09-11T00:00:00Z")).toBe("~ 2026.09.11");
  });
});
