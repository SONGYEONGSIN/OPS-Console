import { describe, it, expect } from "vitest";
import {
  OPERATOR_TARGET_DAYS,
  SCHOOL_TARGET_DAYS,
  canSendOn,
} from "../mail-schedule";
import type { Holiday } from "@/lib/holidays/google-ical";

describe("TARGET_DAYS (원본 GAS 그대로)", () => {
  it("운영자 — 35·45 누락", () => {
    expect([...OPERATOR_TARGET_DAYS]).toEqual([
      10, 15, 20, 25, 30, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
    ]);
    expect(OPERATOR_TARGET_DAYS.includes(35)).toBe(false);
    expect(OPERATOR_TARGET_DAYS.includes(45)).toBe(false);
  });
  it("학교담당자 — 45만 누락(35 포함)", () => {
    expect([...SCHOOL_TARGET_DAYS]).toEqual([
      10, 15, 20, 25, 30, 35, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
    ]);
    expect(SCHOOL_TARGET_DAYS.includes(35)).toBe(true);
    expect(SCHOOL_TARGET_DAYS.includes(45)).toBe(false);
  });
});

describe("canSendOn (주말·공휴일 차단)", () => {
  const holidays: Holiday[] = [
    { date: "2026-06-06", title: "현충일" },
  ];

  it("평일이면서 공휴일 아님 → true", () => {
    // 2026-06-03 수요일
    expect(canSendOn(new Date("2026-06-03T10:00:00+09:00"), holidays)).toBe(true);
  });
  it("토요일 → false", () => {
    // 2026-06-06은 토요일이자 현충일 — 우선 주말로도 차단되지만, 평일 토요일 케이스는 다른 날로
    // 2026-05-30 토요일
    expect(canSendOn(new Date("2026-05-30T10:00:00+09:00"), holidays)).toBe(false);
  });
  it("일요일 → false", () => {
    // 2026-05-31 일요일
    expect(canSendOn(new Date("2026-05-31T10:00:00+09:00"), holidays)).toBe(false);
  });
  it("평일이지만 공휴일 → false", () => {
    // 2026-06-06 현충일(이 해엔 토요일이라 별도 평일 공휴일로 가정 테스트)
    const wkHoliday: Holiday[] = [{ date: "2026-06-03", title: "임시공휴일" }];
    expect(canSendOn(new Date("2026-06-03T10:00:00+09:00"), wkHoliday)).toBe(false);
  });
  it("KST 경계 — UTC로는 다른 날이어도 KST 기준 평일이면 true", () => {
    // 2026-06-02 15:00Z = 2026-06-03(수) 00:00 KST
    expect(canSendOn(new Date("2026-06-02T15:00:00Z"), holidays)).toBe(true);
  });
});
