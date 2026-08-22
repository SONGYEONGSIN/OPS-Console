import { describe, it, expect } from "vitest";
import { settlementDueAt, daysLeft, DEADLINE_DAYS } from "../deadline";

/**
 * 정산 마감일 = 결제마감 + 대학별 정산기한.
 *
 * 서비스마감 화면은 **작성마감** 기준으로 남은 날을 센다. 정산은 기준이 다르다 —
 * 결제가 끝난 뒤 대학마다 정한 기한(5·10·20·30일) 안에 정산해야 한다. 이 계산이
 * 없으면 정산 화면은 서비스마감과 같은 목록이 된다.
 */
describe("정산 마감일", () => {
  it("결제마감에 기한을 더한다", () => {
    expect(settlementDueAt("2026-08-01T00:00:00Z", 10)).toBe(
      "2026-08-11T00:00:00.000Z",
    );
  });

  it("기한이 없으면 마감일도 없다 — 지어내지 않는다", () => {
    expect(settlementDueAt("2026-08-01T00:00:00Z", null)).toBeNull();
  });

  it("결제마감이 없으면 마감일도 없다", () => {
    expect(settlementDueAt(null, 10)).toBeNull();
  });

  it("월을 넘겨도 맞는다", () => {
    expect(settlementDueAt("2026-08-25T00:00:00Z", 10)).toBe(
      "2026-09-04T00:00:00.000Z",
    );
  });
});

describe("남은 날", () => {
  const NOW = new Date("2026-08-22T00:00:00Z");

  it("아직 남았으면 양수", () => {
    expect(daysLeft("2026-08-25T00:00:00Z", NOW)).toBe(3);
  });

  it("오늘이면 0 — 오늘까지다", () => {
    expect(daysLeft("2026-08-22T00:00:00Z", NOW)).toBe(0);
  });

  it("지났으면 음수 — 늦은 건이 드러나야 한다", () => {
    expect(daysLeft("2026-08-20T00:00:00Z", NOW)).toBe(-2);
  });

  it("마감일이 없으면 셀 수 없다", () => {
    expect(daysLeft(null, NOW)).toBeNull();
  });

  it("시각이 아니라 날짜로 센다 — 같은 날이면 몇 시든 0이다", () => {
    expect(daysLeft("2026-08-22T23:59:00Z", NOW)).toBe(0);
    expect(daysLeft("2026-08-22T00:01:00Z", new Date("2026-08-22T23:00:00Z"))).toBe(0);
  });
});

describe("기한 선택지", () => {
  it("인수인계 폼과 같은 값이다 — 두 곳이 다르면 어느 쪽이 맞는지 모른다", () => {
    expect(DEADLINE_DAYS).toEqual([5, 10, 20, 30]);
  });
});
