import { describe, it, expect } from "vitest";
import {
  hasAnnualBatch,
  latestAnnualBasis,
  listProposalBatches,
  listProposals,
  type ProposalQueryClient,
} from "../queries";

/**
 * 제안 조회 — **실패를 빈손으로 돌려주지 않는다.**
 *
 * supabase-js 는 없는 테이블에도 던지지 않는다(`error` 만 채운다). 여기서 빈 배열로
 * 삼키면 화면이 '제안이 없다' 로 읽히고, 사람은 멀쩡한 배치를 찾아 나선다 —
 * 드리프트 검사가 같은 이유로 가짜 초록이었다.
 */
type Verb = "select" | "order" | "limit" | "maybeSingle" | "eq" | "in" | "lt";

function client(
  result: { data?: unknown; error?: { message: string } | null },
  spy?: (verb: Verb, args: unknown[]) => void,
): ProposalQueryClient {
  const chain: Record<string, unknown> = {};
  for (const verb of ["select", "order", "limit", "eq", "in", "lt"] as const) {
    chain[verb] = (...args: unknown[]) => {
      spy?.(verb, args);
      return chain;
    };
  }
  chain.maybeSingle = () => {
    spy?.("maybeSingle", []);
    return Promise.resolve(result);
  };
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return {
    from: () => chain,
  } as unknown as ProposalQueryClient;
}

describe("hasAnnualBatch", () => {
  it("그 학년도의 annual 배치가 있으면 참이다", async () => {
    const c = client({ data: { id: "b1" }, error: null });
    await expect(hasAnnualBatch(2027, c)).resolves.toBe(true);
  });

  it("없으면 거짓이다", async () => {
    const c = client({ data: null, error: null });
    await expect(hasAnnualBatch(2027, c)).resolves.toBe(false);
  });

  it("조회가 실패하면 던진다 — '없다' 로 읽히면 배치가 두 벌 생긴다", async () => {
    // rollover 가 매일 돌므로, 실패를 '없다' 로 읽으면 매일 새 요청을 적재한다.
    const c = client({ data: null, error: { message: "boom" } });
    await expect(hasAnnualBatch(2027, c)).rejects.toThrow(/boom/);
  });

  it("학년도와 kind 로 좁힌다", async () => {
    const seen: [Verb, unknown[]][] = [];
    await hasAnnualBatch(
      2027,
      client({ data: null, error: null }, (v, a) => seen.push([v, a])),
    );
    const eqs = seen.filter(([v]) => v === "eq").map(([, a]) => a);
    expect(eqs).toEqual(
      expect.arrayContaining([
        ["academic_year", 2027],
        ["kind", "annual"],
      ]),
    );
  });
});

describe("latestAnnualBasis", () => {
  it("직전 학년도의 annual 배치에서 그룹 구성과 학년도를 꺼낸다", async () => {
    const c = client({
      data: {
        academic_year: 2026,
        basis: { groups: { "2": ["a@x.com"] } },
      },
      error: null,
    });
    await expect(latestAnnualBasis(2027, c)).resolves.toEqual({
      previousYear: 2026,
      previous: { "2": ["a@x.com"] },
    });
  });

  it("없으면 둘 다 null 이다 — 첫 해에는 견줄 것이 없다", async () => {
    const c = client({ data: null, error: null });
    await expect(latestAnnualBasis(2027, c)).resolves.toEqual({
      previousYear: null,
      previous: null,
    });
  });

  it("basis 에 groups 가 없으면 previous 만 null 이다", async () => {
    // 첫 구현의 배치에는 groups 가 없을 수 있다. 학년도는 살아 있다.
    const c = client({ data: { academic_year: 2026, basis: {} }, error: null });
    await expect(latestAnnualBasis(2027, c)).resolves.toEqual({
      previousYear: 2026,
      previous: null,
    });
  });

  it("조회 실패는 삼킨다 — 상기 문구 때문에 요청 적재를 막지 않는다", async () => {
    // 이건 부속 정보다. 못 읽었다고 학년도 배정을 시작하지 못하면 손해가 더 크다.
    const c = client({ data: null, error: { message: "boom" } });
    await expect(latestAnnualBasis(2027, c)).resolves.toEqual({
      previousYear: null,
      previous: null,
    });
  });

  it("그 학년도보다 **이전** 배치만 본다", async () => {
    // `lt` 가 없으면 방금 만든 2027 배치를 자기 자신과 견줘 늘 '같다' 가 되고,
    // 3월 갱신 상기가 매년 무조건 뜬다 — 늘 켜진 경고등은 아무도 안 본다.
    const seen: [Verb, unknown[]][] = [];
    await latestAnnualBasis(
      2027,
      client({ data: null, error: null }, (v, a) => seen.push([v, a])),
    );
    expect(seen).toEqual(
      expect.arrayContaining([["lt", ["academic_year", 2027]]]),
    );
  });

  it("최신 한 건만 본다 — 재작년까지 거슬러 견주지 않는다", async () => {
    const seen: [Verb, unknown[]][] = [];
    await latestAnnualBasis(
      2027,
      client({ data: null, error: null }, (v, a) => seen.push([v, a])),
    );
    expect(
      seen.some(([v, a]) => v === "order" && a[0] === "academic_year"),
    ).toBe(true);
  });
});

describe("listProposalBatches", () => {
  it("배치를 최신순으로 돌려준다", async () => {
    const rows = [{ id: "b2" }, { id: "b1" }];
    await expect(
      listProposalBatches(client({ data: rows, error: null })),
    ).resolves.toHaveLength(2);
  });

  it("조회가 실패하면 던진다", async () => {
    await expect(
      listProposalBatches(client({ data: null, error: { message: "boom" } })),
    ).rejects.toThrow(/boom/);
  });

  it("빈 결과는 빈 배열이다", async () => {
    await expect(
      listProposalBatches(client({ data: null, error: null })),
    ).resolves.toEqual([]);
  });
});

describe("listProposals", () => {
  it("배치의 제안 행을 돌려준다", async () => {
    const rows = [{ id: "p1", university_name: "가대" }];
    await expect(
      listProposals(["b1"], client({ data: rows, error: null })),
    ).resolves.toHaveLength(1);
  });

  it("조회가 실패하면 던진다", async () => {
    await expect(
      listProposals(["b1"], client({ data: null, error: { message: "boom" } })),
    ).rejects.toThrow(/boom/);
  });

  it("배치가 없으면 조회하지 않는다", async () => {
    const seen: [Verb, unknown[]][] = [];
    await expect(
      listProposals([], client({ data: [], error: null }, (v, a) => seen.push([v, a]))),
    ).resolves.toEqual([]);
    expect(seen).toHaveLength(0);
  });

  it("batch_id 로 좁힌다 — 안 좁히면 남의 배치 제안이 섞인다", async () => {
    const seen: [Verb, unknown[]][] = [];
    await listProposals(
      ["b1"],
      client({ data: [], error: null }, (v, a) => seen.push([v, a])),
    );
    expect(seen).toEqual(
      expect.arrayContaining([["in", ["batch_id", ["b1"]]]]),
    );
  });
});
