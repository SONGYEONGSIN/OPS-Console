import { describe, it, expect } from "vitest";
import { lastKstDays, foldByKstDay } from "../usage-fold";

/**
 * 카드에 '오늘 N건'과 7일 막대를 띄우려면 시각 목록을 KST 날짜로 접어야 한다.
 *
 * 경계를 `lt(익일 00:00)` 로 잡는다 — 리포트 쪽이 쓰는 `lte(23:59:59)` 는
 * 23:59:59.5 를 잃는다. 한 화면에서 두 방식이 섞이면 숫자가 미묘하게 갈린다.
 */
describe("lastKstDays", () => {
  it("오늘을 마지막으로 하는 N일을 오름차순으로 준다", () => {
    // 2026-08-29 01:00 KST = 2026-08-28 16:00 UTC
    const now = new Date("2026-08-28T16:00:00Z");
    expect(lastKstDays(3, now)).toEqual([
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]);
  });

  it("월을 넘어가도 끊기지 않는다", () => {
    const now = new Date("2026-09-01T03:00:00Z"); // KST 12:00
    expect(lastKstDays(3, now)).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });
});

describe("foldByKstDay", () => {
  const days = ["2026-08-27", "2026-08-28", "2026-08-29"];

  it("날짜별로 센다", () => {
    const at = [
      "2026-08-27T10:00:00+09:00",
      "2026-08-29T09:00:00+09:00",
      "2026-08-29T23:00:00+09:00",
    ];
    expect(foldByKstDay(at, days)).toEqual([1, 0, 2]);
  });

  it("UTC 로 온 시각도 KST 날짜로 접는다 — 하루가 밀리면 안 된다", () => {
    // 2026-08-28T16:00Z = KST 2026-08-29 01:00
    expect(foldByKstDay(["2026-08-28T16:00:00Z"], days)).toEqual([0, 0, 1]);
  });

  it("자정 직전도 그날로 센다 — lte(23:59:59) 가 잃던 자리다", () => {
    expect(foldByKstDay(["2026-08-28T23:59:59.700+09:00"], days)).toEqual([
      0, 1, 0,
    ]);
  });

  it("구간 밖은 버린다", () => {
    expect(foldByKstDay(["2026-08-01T10:00:00+09:00"], days)).toEqual([0, 0, 0]);
  });

  it("빈 목록은 전부 0", () => {
    expect(foldByKstDay([], days)).toEqual([0, 0, 0]);
  });
});
