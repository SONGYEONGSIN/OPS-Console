import { describe, it, expect } from "vitest";
import { groupSkipped, skippedGroupText, skippedStage } from "../skipped";

/**
 * 건너뜀의 단계 — 수집이 못 간 것과 판정이 못 한 것은 다른 사고다.
 *
 * 2026-09-04 세팅 점검은 116건 중 66건이 '판정 실패'였는데 로그에는 "이상 없음 · 성공"
 * 이 적혔고, 화면은 같은 문장을 66번 이어 붙였다. 단계 필드는 이후 실행에만 있어서
 * 옛 payload(DB 에 이미 남은 것)는 reason 접두로 가려야 한다.
 */
describe("skippedStage", () => {
  it("stage 가 있으면 그대로 쓴다", () => {
    expect(skippedStage({ serviceId: 1, reason: "x", stage: "judge" })).toBe(
      "judge",
    );
    expect(
      skippedStage({ serviceId: 1, reason: "판정 실패: x", stage: "collect" }),
    ).toBe("collect");
  });

  it("stage 가 없는 옛 payload 는 reason 이 '판정 실패'로 시작하면 judge", () => {
    expect(
      skippedStage({ serviceId: 1, reason: "판정 실패: claude 실패(1): ..." }),
    ).toBe("judge");
  });

  it("stage 도 판정 접두도 없으면 collect", () => {
    expect(skippedStage({ serviceId: 1, reason: "TimeoutException: x" })).toBe(
      "collect",
    );
  });
});

describe("groupSkipped", () => {
  it("같은 단계·같은 사유는 한 묶음으로 모은다", () => {
    const groups = groupSkipped([
      { serviceId: 1, reason: "판정 실패: 같은 문장" },
      { serviceId: 2, reason: "판정 실패: 같은 문장" },
      { serviceId: 3, reason: "상세 열기 실패" },
    ]);
    expect(groups).toEqual([
      {
        stage: "judge",
        reason: "판정 실패: 같은 문장",
        serviceIds: [1, 2],
      },
      { stage: "collect", reason: "상세 열기 실패", serviceIds: [3] },
    ]);
  });

  it("사유가 같아도 단계가 다르면 갈라 둔다", () => {
    const groups = groupSkipped([
      { serviceId: 1, reason: "같은 사유", stage: "collect" },
      { serviceId: 2, reason: "같은 사유", stage: "judge" },
    ]);
    expect(groups).toHaveLength(2);
  });

  it("빈 목록은 빈 배열", () => {
    expect(groupSkipped([])).toEqual([]);
  });
});

describe("skippedGroupText", () => {
  it("판정 못 함은 건수와 사유를 한 줄로", () => {
    const text = skippedGroupText({
      stage: "judge",
      reason: "판정 실패: 같은 문장",
      serviceIds: [1, 2, 3],
    });
    expect(text).toContain("판정 못 함 3건 — 판정 실패: 같은 문장");
    expect(text).toContain("1, 2, 3");
    expect(text).not.toContain("외");
  });

  it("수집 단계는 '건너뜀'이라 쓴다", () => {
    const text = skippedGroupText({
      stage: "collect",
      reason: "상세 열기 실패",
      serviceIds: [7],
    });
    expect(text).toContain("건너뜀 1건 — 상세 열기 실패");
  });

  it("serviceId 가 길면 앞 몇 개만 적고 나머지는 외 N건", () => {
    const ids = Array.from({ length: 66 }, (_, i) => 1000 + i);
    const text = skippedGroupText({
      stage: "judge",
      reason: "판정 실패: x",
      serviceIds: ids,
    });
    expect(text).toContain("판정 못 함 66건");
    expect(text).toContain("1000, 1001, 1002, 1003, 1004");
    expect(text).not.toContain("1005");
    expect(text).toContain("외 61건");
  });
});
