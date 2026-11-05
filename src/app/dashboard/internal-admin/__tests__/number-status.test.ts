import { describe, it, expect } from "vitest";
import { BADGE_TONE } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
import { numberStatusTone } from "../_components/number-status";

/**
 * 실제로 본 값: _발신번호 시트 '상태' 열(NUMBER_STATUS_ORDER) 의
 * 일괄 등록·추가 등록·서류 미비, 발신번호 탭 테스트의 등록완료.
 */
describe("numberStatusTone", () => {
  it("등록된 번호 → 정상 종료(ink)", () => {
    for (const s of ["일괄 등록", "추가 등록", "등록완료"]) {
      expect(numberStatusTone(s)).toBe(BADGE_TONE.done);
    }
  });

  it("서류 미비 → 봐야 할 것", () => {
    expect(numberStatusTone("서류 미비")).toBe(BADGE_TONE.attention);
  });

  it("앞뒤 공백은 무시한다", () => {
    expect(numberStatusTone(" 일괄 등록 ")).toBe(BADGE_TONE.done);
    expect(numberStatusTone(" 서류 미비")).toBe(BADGE_TONE.attention);
  });

  it("모르는 값·빈 값은 대기 — 공통 배지 규칙처럼 그레이로 떨어진다", () => {
    for (const s of ["", "확인 중", "기타"]) {
      expect(numberStatusTone(s)).toBe(BADGE_TONE.idle);
    }
  });
});
