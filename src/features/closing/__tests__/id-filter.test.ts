import { describe, it, expect } from "vitest";
import { applyServiceIdFilter } from "../id-filter";

/**
 * service_billing 은 closing_services 와 FK 가 없어(스크랩 미러) DB 조인을 못 건다.
 * 그래서 서비스ID 목록을 받아 거른다.
 *
 * 여기서 지키려는 건 **빈 목록이 '전체'로 새지 않는 것**이다. 정산완료가 0건일 때
 * 계산서발행 목록에 마감된 572건이 통째로 쏟아지면, 아직 정산도 안 한 건을
 * 발행 대상으로 보게 된다.
 */
type Call = [string, ...unknown[]];

function fakeQuery() {
  const calls: Call[] = [];
  const q = {
    calls,
    in(col: string, vals: readonly number[]) {
      calls.push(["in", col, [...vals]]);
      return q;
    },
    eq(col: string, val: number) {
      calls.push(["eq", col, val]);
      return q;
    },
    not(col: string, op: string, val: string) {
      calls.push(["not", col, op, val]);
      return q;
    },
  };
  return q;
}

describe("applyServiceIdFilter", () => {
  it("목록을 주면 그것만 고른다", () => {
    const q = applyServiceIdFilter(fakeQuery(), { serviceIds: [100, 200] });
    expect(q.calls).toEqual([["in", "service_id", [100, 200]]]);
  });

  it("빈 목록은 '아무것도 없음'이다 — 필터 없음과 다르다", () => {
    const q = applyServiceIdFilter(fakeQuery(), { serviceIds: [] });
    // PostgREST 는 빈 in() 을 거부하므로 있을 수 없는 ID 로 빈 결과를 만든다.
    expect(q.calls).toEqual([["eq", "service_id", -1]]);
  });

  it("아무것도 안 주면 아무 조건도 안 건다", () => {
    const q = applyServiceIdFilter(fakeQuery(), {});
    expect(q.calls).toEqual([]);
  });

  it("제외 목록을 주면 뺀다", () => {
    const q = applyServiceIdFilter(fakeQuery(), { excludeServiceIds: [7, 8] });
    expect(q.calls).toEqual([["not", "service_id", "in", "(7,8)"]]);
  });

  it("제외 목록이 비면 아무것도 빼지 않는다 — 뺄 게 없는 것과 전체를 빼는 건 다르다", () => {
    const q = applyServiceIdFilter(fakeQuery(), { excludeServiceIds: [] });
    expect(q.calls).toEqual([]);
  });

  it("서비스ID 0 도 목록에 남는다 — falsy 로 거르면 통째로 샌다", () => {
    const q = applyServiceIdFilter(fakeQuery(), { serviceIds: [0, 5] });
    expect(q.calls).toEqual([["in", "service_id", [0, 5]]]);
  });

  it("둘 다 주면 둘 다 건다", () => {
    const q = applyServiceIdFilter(fakeQuery(), {
      serviceIds: [1, 2, 3],
      excludeServiceIds: [2],
    });
    expect(q.calls).toEqual([
      ["in", "service_id", [1, 2, 3]],
      ["not", "service_id", "in", "(2)"],
    ]);
  });
});
