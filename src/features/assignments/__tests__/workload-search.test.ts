import { describe, it, expect } from "vitest";
import { matchesWorkloadQuery, filterWorkload } from "../workload-search";
import type { WorkloadGroup, WorkloadRow } from "../workload";

/**
 * 배정현황 검색 — **표시만 걸러낸다.**
 *
 * 가장 중요한 것은 그룹 목표가 **안 움직인다**는 것이다. 목표는 그룹 안 평균이라,
 * 검색으로 남은 줄만 다시 평균 내면 한 사람을 찾을 때 그 사람 자신이 목표가 되어
 * 편차가 늘 0% 로 나온다. 검색할 때마다 숫자가 달라지는 표는 근거가 못 된다.
 */
const row = (o: Partial<WorkloadRow> = {}): WorkloadRow => ({
  email: "a@x.com",
  name: "가운영",
  careerStart: "2019-03-01",
  universities: 2,
  universityNames: ["가대학교", "나대학교"],
  services: 8,
  density: 4,
  uncounted: 0,
  week: 1,
  month: 3,
  year: 8,
  deviation: 0.1,
  running: [],
  ...o,
});

const TARGET = { universities: 20, density: 4 };

const groups: WorkloadGroup[] = [
  {
    group: "2",
    target: TARGET,
    rows: [row(), row({ email: "b@x.com", name: "나운영" })],
  },
  {
    group: "3",
    target: { universities: 10, density: 2 },
    rows: [row({ email: "c@x.com", name: "다운영" })],
  },
];

describe("matchesWorkloadQuery", () => {
  it("담당자 이름으로 찾는다", () => {
    expect(matchesWorkloadQuery(row(), "가운")).toBe(true);
    expect(matchesWorkloadQuery(row(), "나운")).toBe(false);
  });

  it("담당 대학 이름으로도 찾는다 — '이 대학 누가 맡았나' 가 같은 질문이다", () => {
    expect(matchesWorkloadQuery(row(), "나대학교")).toBe(true);
  });

  it("담당 대학 전체를 본다 — 이번 달에 도는 것만이 아니다", () => {
    /*
     * `running` 으로 찾으면 12월 서비스만 있는 대학이 9월 검색에서 안 나오고,
     * 그게 '안 맡았다' 와 화면에서 구분되지 않는다.
     */
    const r = row({ universityNames: ["겨울대"], running: [] });

    expect(matchesWorkloadQuery(r, "겨울대")).toBe(true);
  });

  it("앞뒤 공백과 대소문자를 무시한다", () => {
    const r = row({ name: "Kim", universityNames: [] });

    expect(matchesWorkloadQuery(r, "  kim ")).toBe(true);
  });

  it("빈 검색어는 모두 맞는다 — 필터가 아니다", () => {
    expect(matchesWorkloadQuery(row(), "")).toBe(true);
    expect(matchesWorkloadQuery(row(), "   ")).toBe(true);
  });
});

describe("filterWorkload", () => {
  it("맞는 줄만 남긴다", () => {
    const out = filterWorkload(groups, "나운");

    expect(out.flatMap((g) => g.rows).map((r) => r.name)).toEqual(["나운영"]);
  });

  it("**그룹 목표는 그대로다** — 검색이 견주는 기준을 바꾸면 안 된다", () => {
    const out = filterWorkload(groups, "가운");

    expect(out[0].target).toEqual(TARGET);
    // 편차도 원래 값이다 — 남은 줄로 다시 계산하지 않는다.
    expect(out[0].rows[0].deviation).toBe(0.1);
  });

  it("줄이 하나도 안 남은 그룹은 빼낸다 — 머리만 남으면 잡음이다", () => {
    const out = filterWorkload(groups, "다운");

    expect(out.map((g) => g.group)).toEqual(["3"]);
  });

  it("아무도 안 맞으면 빈 배열이다", () => {
    expect(filterWorkload(groups, "없는사람")).toEqual([]);
  });

  it("빈 검색어는 원본을 그대로 돌려준다", () => {
    expect(filterWorkload(groups, "  ")).toEqual(groups);
  });

  it("원본을 바꾸지 않는다", () => {
    const before = JSON.stringify(groups);

    filterWorkload(groups, "가운");

    expect(JSON.stringify(groups)).toBe(before);
  });
});
