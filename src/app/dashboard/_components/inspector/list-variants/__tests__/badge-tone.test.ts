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
  for (const label of [
    "긴급",
    "장애",
    "오류",
    "미수",
    "발송 실패",
    "반려",
    "중단",
    "정지",
  ]) {
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
    "수금",
    // 자동화 실행 로그 — 잡이 정상 종료했다는 뜻이다.
    "성공",
    "생성",
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

import { STATUS_COLOR, STATUS_LABEL } from "../status";

describe("공용 STATUS_COLOR", () => {
  it("모든 값이 BADGE_TONE 중 하나다", () => {
    const tones: string[] = Object.values(BADGE_TONE);
    for (const [key, cls] of Object.entries(STATUS_COLOR)) {
      expect(tones, `${key}가 규칙 밖 색을 쓴다`).toContain(cls);
    }
  });

  it("기본 라벨의 의미와 색이 일치한다", () => {
    for (const key of Object.keys(
      STATUS_COLOR,
    ) as (keyof typeof STATUS_COLOR)[]) {
      expect(STATUS_COLOR[key], `${key}(${STATUS_LABEL[key]})`).toBe(
        statusBadgeTone(STATUS_LABEL[key]),
      );
    }
  });
});

import { STATUS_TONE as REPORT_STATUS_TONE } from "../incident-reports/status";
import { MEETING_STATUS_TONE } from "../meetings/status";

describe("경위서·회의록 상태 톤", () => {
  const tones: string[] = Object.values(BADGE_TONE);

  it("경위서: 모든 값이 BADGE_TONE 중 하나다", () => {
    for (const [key, cls] of Object.entries(REPORT_STATUS_TONE)) {
      expect(tones, `${key}가 규칙 밖 색을 쓴다`).toContain(cls);
    }
  });

  it("경위서: 반려는 주의, 승인완료·발송완료는 완료다", () => {
    expect(REPORT_STATUS_TONE.rejected).toBe(BADGE_TONE.attention);
    expect(REPORT_STATUS_TONE.approved).toBe(BADGE_TONE.done);
    expect(REPORT_STATUS_TONE.sent).toBe(BADGE_TONE.done);
    expect(REPORT_STATUS_TONE.draft).toBe(BADGE_TONE.progress);
    expect(REPORT_STATUS_TONE.pending_approval).toBe(BADGE_TONE.idle);
  });

  it("회의록: 작성 중은 진행, 발송은 완료다", () => {
    expect(MEETING_STATUS_TONE.draft).toBe(BADGE_TONE.progress);
    expect(MEETING_STATUS_TONE.sent).toBe(BADGE_TONE.done);
  });
});

/**
 * **이 가드는 import 가 하드코딩이라 자동으로 안 잡는다.** 새 톤맵을 만들고 여기
 * 등록하지 않으면 규칙이 집행되지 않은 채 CI 가 초록이다 — 그래서 톤맵을 추가하는
 * 작업의 일부로 이 블록을 손으로 넣는다(업무배정, 2026-09-16).
 */
import { ASSIGNMENT_BADGE_TONE } from "../assignments/status";

describe("업무배정 배지 톤", () => {
  it("모든 값이 BADGE_TONE 중 하나다", () => {
    const tones: string[] = Object.values(BADGE_TONE);
    for (const [key, cls] of Object.entries(ASSIGNMENT_BADGE_TONE)) {
      expect(tones, `${key}가 규칙 밖 색을 쓴다`).toContain(cls);
    }
  });

  /**
   * `미배정` 은 설계 F2 가 **정상으로 인정한 상태**라 주의 색을 주지 않는다.
   * `분할` 도 사람이 이유가 있어 갈라놓은 것이다(44곳). 사람이 고쳐야 하는 것은
   * `연결 안 됨` 하나뿐이고, 그것만 눈에 띄어야 나머지가 소음이 되지 않는다.
   */
  it("연결 안 됨만 주의색이고 미배정·분할은 대기색이다", () => {
    expect(ASSIGNMENT_BADGE_TONE["연결 안 됨"]).toBe(BADGE_TONE.attention);
    expect(ASSIGNMENT_BADGE_TONE["미배정"]).toBe(BADGE_TONE.idle);
    expect(ASSIGNMENT_BADGE_TONE["분할"]).toBe(BADGE_TONE.idle);
  });
});
