import { describe, it, expect } from "vitest";
import { aggregateDevControl } from "../dev-control";

const P = { startYmd: "2026-03-01", endYmd: "2027-02-28" };

/**
 * 원서접수 GEN 세팅(WA/WB/PA/PB…) 변경 이력.
 *
 * 수집 스크립트가 `prev.code_hash !== hash` 로 **이미 변경을 감지하고 있었는데**
 * upsert 라 최신 상태만 남고 사건이 사라졌다. 이력을 쌓아 개인에 귀속한다.
 *
 * **첫 관측은 세지 않는다** — 파일을 처음 수집한 날이지 세팅한 날이 아니다.
 * 157행이 한꺼번에 들어온 2026-07-17 을 성과로 세면 그날 아무 일도 안 한
 * 사람이 수십 건을 한 것으로 나온다.
 */
describe("aggregateDevControl", () => {
  const rows = [
    { operator_name: "송영신", prev_code_hash: "aaa", observed_at: "2026-09-01T00:00:00Z" },
    { operator_name: "송영신", prev_code_hash: "bbb", observed_at: "2026-10-01T00:00:00Z" },
    { operator_name: "김승현", prev_code_hash: "ccc", observed_at: "2026-09-02T00:00:00Z" },
  ];

  it("본인이 바꾼 것만 센다", () => {
    expect(aggregateDevControl(rows, "송영신", P)).toEqual({ value: 2, unit: "건" });
  });

  it("첫 관측은 세지 않는다 — 수집 시작이지 세팅이 아니다", () => {
    const seeded = [
      ...rows,
      { operator_name: "송영신", prev_code_hash: null, observed_at: "2026-07-17T00:00:00Z" },
      { operator_name: "송영신", prev_code_hash: null, observed_at: "2026-09-05T00:00:00Z" },
    ];
    expect(aggregateDevControl(seeded, "송영신", P).value).toBe(2);
  });

  it("기간 밖은 빼고 센다", () => {
    const old = [
      ...rows,
      { operator_name: "송영신", prev_code_hash: "ddd", observed_at: "2026-02-28T00:00:00Z" },
    ];
    expect(aggregateDevControl(old, "송영신", P).value).toBe(2);
  });

  /** 이름을 못 찾으면 0 이 아니다 — 0 은 '한 건도 안 했다'로 읽힌다. */
  it("이름을 못 찾으면 미매칭으로 알린다", () => {
    expect(aggregateDevControl(rows, null, P)).toEqual({
      value: 0,
      unit: "건",
      detail: "미매칭",
    });
  });

  it("한 건도 없으면 0 건", () => {
    expect(aggregateDevControl([], "송영신", P)).toEqual({ value: 0, unit: "건" });
  });
});
