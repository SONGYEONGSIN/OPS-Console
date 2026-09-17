import { describe, it, expect } from "vitest";
import {
  TENURE_GROUPS,
  TENURE_GROUP_LABELS,
  tenureGroupSchema,
  careerStartOf,
  careerYearsAt,
} from "../tenure";

describe("careerStartOf", () => {
  it("career_start_at 이 null 이면 hired_at 을 쓴다", () => {
    expect(
      careerStartOf({ career_start_at: null, hired_at: "2016-07-27" }),
    ).toBe("2016-07-27");
  });

  it("career_start_at 이 있으면 그것을 쓴다 — 재입사자는 hired_at 이 최근이다", () => {
    expect(
      careerStartOf({ career_start_at: "2011-02-07", hired_at: "2026-06-22" }),
    ).toBe("2011-02-07");
  });

  it("career_start_at 키가 아예 없어도 hired_at 을 쓴다", () => {
    expect(careerStartOf({ hired_at: "2019-03-04" })).toBe("2019-03-04");
  });
});

describe("TENURE_GROUPS", () => {
  it("그룹은 7개다", () => {
    expect(TENURE_GROUPS).toHaveLength(7);
  });

  it("저장값은 설계 §5.2 의 일곱 개다", () => {
    expect([...TENURE_GROUPS]).toEqual(["1-1", "1-2", "2", "3", "4", "5", "6"]);
  });

  // 마이그레이션 주석이 "문자열 정렬이 곧 연차 순서" 라고 선언한다. 선언 순서가
  // 정렬 순서와 어긋나면 배분현황이 그룹을 연차 순으로 못 늘어놓는다.
  it("문자열 정렬이 곧 연차 순서다 — 선언 순서와 같다", () => {
    expect([...TENURE_GROUPS].sort()).toEqual([...TENURE_GROUPS]);
  });
});

describe("TENURE_GROUP_LABELS", () => {
  it("모든 그룹에 라벨이 있고 남는 키가 없다", () => {
    expect(Object.keys(TENURE_GROUP_LABELS).sort()).toEqual(
      [...TENURE_GROUPS].sort(),
    );
  });

  it("화면 라벨은 설계 §5.2 표와 같다", () => {
    expect(TENURE_GROUP_LABELS).toEqual({
      "1-1": "1그룹1",
      "1-2": "1그룹2",
      "2": "2그룹",
      "3": "3그룹",
      "4": "4그룹",
      "5": "5그룹",
      "6": "6그룹",
    });
  });
});

describe("tenureGroupSchema", () => {
  it("등록된 그룹 일곱 개를 통과시킨다", () => {
    for (const group of TENURE_GROUPS) {
      expect(tenureGroupSchema.safeParse(group).success).toBe(true);
    }
  });

  // DB 에는 check 제약을 걸지 않았다(그룹이 하나 늘 때 마이그레이션을 잊으면
  // 조직 화면 저장이 500 으로 죽는다). 그래서 여기가 유일한 관문이다.
  it("미등록 그룹을 거부한다", () => {
    expect(tenureGroupSchema.safeParse("7").success).toBe(false);
    expect(tenureGroupSchema.safeParse("").success).toBe(false);
  });

  it("화면 라벨을 저장값으로 받지 않는다", () => {
    expect(tenureGroupSchema.safeParse("1그룹1").success).toBe(false);
  });

  it("공백이 붙은 값을 거부한다", () => {
    expect(tenureGroupSchema.safeParse(" 1-1 ").success).toBe(false);
  });
});

describe("careerYearsAt", () => {
  it("경력 시작일부터 오늘까지의 햇수다", () => {
    expect(careerYearsAt("2019-03-01", new Date("2026-09-01T00:00:00+09:00")))
      .toBeCloseTo(7.5, 1);
  });

  it("오늘 시작했으면 0 이다", () => {
    expect(careerYearsAt("2026-09-01", new Date("2026-09-01T00:00:00+09:00")))
      .toBe(0);
  });

  it("날짜가 아니면 null 이다 — 화면에 NaN 을 흘리지 않는다", () => {
    expect(careerYearsAt("", new Date("2026-09-01T00:00:00+09:00"))).toBeNull();
  });
});
