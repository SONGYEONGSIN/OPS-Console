import { describe, it, expect } from "vitest";
import {
  formatYmdWithWeekday,
  dayDiffFromToday,
  parseFiscalFromSheet,
} from "../detail";

describe("formatYmdWithWeekday", () => {
  it("요일을 붙여 한글 날짜로 포맷", () => {
    expect(formatYmdWithWeekday("2026-07-09")).toBe("2026년 7월 9일 (목)");
    expect(formatYmdWithWeekday("2027-01-03")).toBe("2027년 1월 3일 (일)");
    expect(formatYmdWithWeekday("2026-12-25")).toBe("2026년 12월 25일 (금)");
  });

  it("빈 값/형식 오류 → '-'", () => {
    expect(formatYmdWithWeekday("")).toBe("-");
    expect(formatYmdWithWeekday("bad")).toBe("-");
  });
});

describe("dayDiffFromToday", () => {
  it("미래는 양수, 과거는 음수, 당일은 0", () => {
    expect(dayDiffFromToday("2026-07-11", "2026-07-09")).toBe(2);
    expect(dayDiffFromToday("2026-07-09", "2026-07-09")).toBe(0);
    expect(dayDiffFromToday("2026-07-07", "2026-07-09")).toBe(-2);
  });

  it("월/연 경계도 자연일 기준", () => {
    expect(dayDiffFromToday("2026-08-01", "2026-07-30")).toBe(2);
    expect(dayDiffFromToday("2027-01-01", "2026-12-31")).toBe(1);
  });

  it("형식 오류 → null", () => {
    expect(dayDiffFromToday("bad", "2026-07-09")).toBeNull();
  });
});

describe("parseFiscalFromSheet", () => {
  it("기수 + 회계연도 범위 파싱", () => {
    expect(parseFiscalFromSheet("27기비용지급일(26.04~27.03)")).toEqual({
      term: "27기",
      fiscal: "2026.04 ~ 2027.03",
    });
  });

  it("범위 접미사 없으면 기수만", () => {
    expect(parseFiscalFromSheet("19기비용지급일")).toEqual({
      term: "19기",
      fiscal: null,
    });
  });

  it("빈 값 → 둘 다 null", () => {
    expect(parseFiscalFromSheet("")).toEqual({ term: null, fiscal: null });
  });
});
