import { describe, it, expect } from "vitest";
import { ASSIGNMENT_BADGE_TONE } from "./status";
import { ASSIGNMENT_BADGES } from "@/features/assignments/badges";
import { BADGE_TONE } from "../badge-tone";

describe("ASSIGNMENT_BADGE_TONE", () => {
  it("배지 종류를 모두 보유한다 — 하나라도 빠지면 그 배지가 색 없이 그려진다", () => {
    expect(Object.keys(ASSIGNMENT_BADGE_TONE).sort()).toEqual(
      [...ASSIGNMENT_BADGES].sort(),
    );
  });

  /**
   * `미배정` 은 설계 F2 가 **정상으로 인정한 상태**이고 `분할` 도 사람이 이유가
   * 있어 갈라놓은 것이다(실데이터 44곳). 사람이 고쳐야 하는 것은 `연결 안 됨`
   * 하나뿐이라, 그것만 눈에 띄어야 나머지가 소음이 되지 않는다.
   */
  it("연결 안 됨만 주의색이고 미배정·분할은 대기색이다", () => {
    expect(ASSIGNMENT_BADGE_TONE["연결 안 됨"]).toBe(BADGE_TONE.attention);
    expect(ASSIGNMENT_BADGE_TONE["미배정"]).toBe(BADGE_TONE.idle);
    expect(ASSIGNMENT_BADGE_TONE["분할"]).toBe(BADGE_TONE.idle);
  });
});
