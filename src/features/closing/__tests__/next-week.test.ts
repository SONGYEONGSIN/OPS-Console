import { describe, it, expect } from "vitest";
import { nextWeekRange, opensNextWeek } from "../next-week";

/** KST 기준 시각을 UTC Date 로 — 테스트가 서버 시간대에 안 묶이게. */
const kst = (ymd: string, hm = "10:00") => new Date(`${ymd}T${hm}:00+09:00`);

describe("nextWeekRange — 이번 주 기준 다음 주 월~일 (KST)", () => {
  it("금요일이면 다음 월~일", () => {
    expect(nextWeekRange(kst("2026-09-11"))).toEqual({
      startYmd: "2026-09-14",
      endYmd: "2026-09-20",
    });
  });

  it("일요일은 아직 이번 주다 — 내일부터가 차주", () => {
    expect(nextWeekRange(kst("2026-09-13", "23:30"))).toEqual({
      startYmd: "2026-09-14",
      endYmd: "2026-09-20",
    });
  });

  it("월요일이면 오늘이 아니라 그다음 월요일부터", () => {
    expect(nextWeekRange(kst("2026-09-14", "00:10"))).toEqual({
      startYmd: "2026-09-21",
      endYmd: "2026-09-27",
    });
  });

  it("UTC 로는 전날이어도 한국 날짜로 판단한다", () => {
    // 2026-09-13 16:00 UTC = 9/14(월) 01:00 KST → 이번 주는 9/14 주
    expect(nextWeekRange(new Date("2026-09-13T16:00:00Z"))).toEqual({
      startYmd: "2026-09-21",
      endYmd: "2026-09-27",
    });
  });
});

describe("opensNextWeek — 작성시작이 차주 안에 드는가", () => {
  const now = kst("2026-09-11");

  it("차주 월요일 자정 직후(KST)면 든다 — UTC 로는 일요일이다", () => {
    expect(opensNextWeek("2026-09-13T15:30:00Z", now)).toBe(true);
  });

  it("차주 일요일 밤이면 든다", () => {
    expect(opensNextWeek("2026-09-20T23:59:00+09:00", now)).toBe(true);
  });

  it("그다음 월요일 0시(KST)면 안 든다", () => {
    expect(opensNextWeek("2026-09-20T15:00:00Z", now)).toBe(false);
  });

  it("이번 주 남은 날에 여는 건 안 든다", () => {
    expect(opensNextWeek("2026-09-12T09:00:00+09:00", now)).toBe(false);
  });

  it("작성시작이 없거나 깨졌으면 안 든다", () => {
    expect(opensNextWeek(null, now)).toBe(false);
    expect(opensNextWeek("미정", now)).toBe(false);
  });
});
