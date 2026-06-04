import { describe, it, expect } from "vitest";
import {
  floorMod,
  isoMonthWeeksCount,
  nextWeekFilename,
  nextWeekSheetname,
  weekDateRange,
  formatDateRange,
  senderForWeek,
  subWeekText,
  subDateRange,
  WEEKLY_SENDERS,
} from "../rollover-logic";

describe("floorMod (Python % 재현)", () => {
  it("음수도 floor 모듈로", () => {
    expect(floorMod(-4, 3)).toBe(2); // Python -4 % 3 === 2 (JS는 -1)
    expect(floorMod(6, 3)).toBe(0);
    expect(floorMod(7, 3)).toBe(1);
  });
});

describe("isoMonthWeeksCount (목요일 규칙)", () => {
  it("2026년 1월은 5주차까지", () => {
    expect(isoMonthWeeksCount(2026, 1)).toBe(5);
  });
  it("2026년 2월은 4주차까지", () => {
    expect(isoMonthWeeksCount(2026, 2)).toBe(4);
  });
  it("2026년 12월은 5주차까지", () => {
    expect(isoMonthWeeksCount(2026, 12)).toBe(5);
  });
});

describe("nextWeekFilename (차주 롤오버, zero-pad 없음)", () => {
  const P = "주간업무보고서_진학어플라이본부";
  it("같은 달 내 주차 +1", () => {
    expect(nextWeekFilename(`${P}_2026_1월3주차.xlsx`)).toBe(
      `${P}_2026_1월4주차.xlsx`,
    );
  });
  it("마지막 주차 초과 시 다음 달 1주차", () => {
    expect(nextWeekFilename(`${P}_2026_1월5주차.xlsx`)).toBe(
      `${P}_2026_2월1주차.xlsx`,
    );
  });
  it("12월 마지막 주차 → 다음 해 1월 1주차", () => {
    expect(nextWeekFilename(`${P}_2026_12월5주차.xlsx`)).toBe(
      `${P}_2027_1월1주차.xlsx`,
    );
  });
  it("패턴 불일치면 null", () => {
    expect(nextWeekFilename("엉뚱한이름.xlsx")).toBeNull();
  });
});

describe("nextWeekSheetname", () => {
  it("YYYY년 M월 N주차 롤오버", () => {
    expect(nextWeekSheetname("2026년 1월 3주차")).toBe("2026년 1월 4주차");
    expect(nextWeekSheetname("2026년 1월 5주차")).toBe("2026년 2월 1주차");
  });
});

describe("weekDateRange / formatDateRange", () => {
  it("2026년 1월 1주차 (월~금, 월 경계)", () => {
    const { monday, friday } = weekDateRange(2026, 1, 1);
    expect(formatDateRange(monday, friday)).toBe("12/29~1/2");
  });
  it("2026년 1월 2주차", () => {
    const { monday, friday } = weekDateRange(2026, 1, 2);
    expect(formatDateRange(monday, friday)).toBe("1/5~1/9");
  });
});

describe("senderForWeek (앵커 2026-01 5주차 = 임형섭[0])", () => {
  it("발송자 3명", () => {
    expect(WEEKLY_SENDERS).toEqual([
      "임형섭 부장님",
      "전성대 부장님",
      "허승철 부장님",
    ]);
  });
  it("2026년 1월 5주차 = 임형섭 부장님", () => {
    expect(senderForWeek(2026, 1, 5)).toBe("임형섭 부장님");
  });
  it("순환 — 1주차=허승철, 2주차=임형섭", () => {
    expect(senderForWeek(2026, 1, 1)).toBe("허승철 부장님");
    expect(senderForWeek(2026, 1, 2)).toBe("임형섭 부장님");
  });
  it("연도 경계 연속성 — 2027년 1월 1주차", () => {
    // 2026 누적 주차 후 그대로 이어짐(앵커 깨지지 않음)
    const s = senderForWeek(2027, 1, 1);
    expect(WEEKLY_SENDERS).toContain(s);
  });
});

describe("셀 값 치환", () => {
  it("subWeekText: B2 주차 텍스트 교체", () => {
    expect(subWeekText("2026년 1월 3주차 업무보고", "2026년 1월 4주차")).toBe(
      "2026년 1월 4주차 업무보고",
    );
  });
  it("subDateRange: B3/H3 날짜 범위 교체", () => {
    expect(subDateRange("기간 1/5~1/9", "1/12~1/16")).toBe("기간 1/12~1/16");
  });
  it("패턴 없으면 원본 유지", () => {
    expect(subDateRange("날짜 없음", "1/1~1/5")).toBe("날짜 없음");
  });
});
