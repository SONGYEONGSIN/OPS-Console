import { describe, it, expect } from "vitest";
import { BADGE_TONE, statusBadgeTone } from "../badge-tone";

describe("BADGE_TONE", () => {
  it("4개 톤이 지정된 토큰 클래스다", () => {
    expect(BADGE_TONE).toEqual({
      attention: "bg-vermilion-deep text-cream",
      progress: "bg-vermilion text-cream",
      done: "bg-ink text-cream",
      idle: "bg-line-soft text-muted",
    });
  });
});

describe("statusBadgeTone — 주의", () => {
  for (const label of ["긴급", "발송 실패", "반려", "중단", "정지"]) {
    it(`${label} → attention`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.attention);
    });
  }
});

describe("statusBadgeTone — 진행", () => {
  for (const label of [
    "진행중",
    "진행 중",
    "진행",
    "처리중",
    "점검중",
    "작성중",
    "작성 중",
    "실행 중",
    "발송 중",
    "분석 중",
    "확인",
  ]) {
    it(`${label} → progress`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.progress);
    });
  }
});

describe("statusBadgeTone — 완료", () => {
  for (const label of [
    "처리완료",
    "완료",
    "종료",
    "작성완료",
    "인계완료",
    "승인완료",
    "발송완료",
    "수주",
  ]) {
    it(`${label} → done`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.done);
    });
  }
});

describe("statusBadgeTone — 대기", () => {
  for (const label of [
    "요청",
    "활성",
    "정상",
    "보류",
    "예약",
    "삭제",
    "미작성",
    "미처리",
    "취소",
    "계획",
    "대기",
    "검토",
    "승인대기",
    "발송",
    "실주",
    "테스트",
  ]) {
    it(`${label} → idle`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.idle);
    });
  }
});

describe("statusBadgeTone — 규칙의 함정", () => {
  it("예약완료는 완료가 아니라 대기다 (아직 발송 전)", () => {
    expect(statusBadgeTone("예약완료")).toBe(BADGE_TONE.idle);
  });

  it("중단은 '중'으로 끝나지 않으므로 진행으로 새지 않는다", () => {
    expect(statusBadgeTone("중단")).toBe(BADGE_TONE.attention);
  });

  it("발송 실패가 진행·완료보다 먼저 잡힌다", () => {
    expect(statusBadgeTone("발송 실패")).toBe(BADGE_TONE.attention);
  });

  it("앞뒤 공백을 무시한다", () => {
    expect(statusBadgeTone("  처리중  ")).toBe(BADGE_TONE.progress);
  });

  it("모르는 라벨은 대기로 떨어진다", () => {
    expect(statusBadgeTone("듣도보도못한상태")).toBe(BADGE_TONE.idle);
  });

  it("빈 문자열도 대기다", () => {
    expect(statusBadgeTone("")).toBe(BADGE_TONE.idle);
  });
});
