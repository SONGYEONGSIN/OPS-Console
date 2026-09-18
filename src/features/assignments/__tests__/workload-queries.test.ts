import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  range: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: h.from }),
}));

import { loadWorkloadSources } from "../workload-queries";

/**
 * 건수·구간 조회. **학년도 창은 `academicYearRangeKST` 가 정한다** — 여기서 다시
 * 정의하면 마감 스크랩과 배분현황이 서로 다른 해를 보게 되고, 둘 다 '올해' 라고
 * 적혀 있어 아무도 못 알아챈다(설계 §6.2).
 *
 * 조회 실패를 빈 맵으로 삼키지 않는다 — supabase-js 는 던지지 않아서, 삼키면
 * 전원의 건수가 0 이 되고 그건 화면에서 '일이 없다' 로 읽힌다.
 */
const NOW = new Date("2026-09-17T12:00:00+09:00");

/** 조회 순서대로 응답을 물린다 — 마지막 응답은 이후 페이지에도 쓰인다. */
const respond = (
  pages: { data: unknown[] | null; error: { message: string } | null }[],
) => {
  let i = 0;
  h.range.mockImplementation(() =>
    Promise.resolve(pages[Math.min(i++, pages.length - 1)]),
  );
};

describe("loadWorkloadSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ gte: h.gte });
    h.gte.mockReturnValue({ lte: h.lte });
    h.lte.mockReturnValue({ range: h.range });
    h.range.mockResolvedValue({ data: [], error: null });
  });

  it("두 원천을 읽는다 — closing_services 와 announcement_services", async () => {
    await loadWorkloadSources(NOW);

    expect(h.from.mock.calls.map((c) => c[0])).toEqual([
      "closing_services",
      "announcement_services",
    ]);
  });

  it("services 는 읽지 않는다 — 2026-02-28 에서 멈춘 시트 임포트다", async () => {
    // 창 안 0건이라 쓰면 전원의 건수·밀도·주월연이 통째로 0 이 된다.
    await loadWorkloadSources(NOW);

    expect(h.from.mock.calls.map((c) => c[0])).not.toContain("services");
  });

  it("학년도 창으로 자른다 — 3/1 부터 익년 2월 말일까지", async () => {
    await loadWorkloadSources(NOW);

    expect(h.gte).toHaveBeenCalledWith(
      "write_start_at",
      "2026-03-01T00:01:00+09:00",
    );
    expect(h.lte).toHaveBeenCalledWith(
      "write_start_at",
      "2027-02-28T23:59:00+09:00",
    );
    expect(h.gte).toHaveBeenCalledWith(
      "last_announce_at",
      "2026-03-01T00:01:00+09:00",
    );
  });

  it("건수와 구간을 한 조회에서 만든다 — 같은 행을 두 번 읽지 않는다", async () => {
    respond([
      {
        data: [
          {
            university_name: "가대",
            category: "수시",
            write_start_at: "2026-09-01T00:00:00+09:00",
            write_end_at: "2026-09-10T23:59:00+09:00",
          },
        ],
        error: null,
      },
      { data: [{ university_name: "가대" }], error: null },
    ]);

    const { serviceCounts, spans } = await loadWorkloadSources(NOW);

    expect(serviceCounts).toEqual({ "가대|원서접수": 1, "가대|PIMS": 1 });
    expect(spans).toEqual([
      {
        university_name: "가대",
        work_kind: "원서접수",
        start: "2026-09-01",
        end: "2026-09-10",
      },
    ]);
  });

  it("조회가 실패하면 던진다 — 조용한 0건은 '일이 없다' 로 읽힌다", async () => {
    respond([{ data: null, error: { message: "boom" } }]);

    await expect(loadWorkloadSources(NOW)).rejects.toThrow(/boom/);
  });

  it("발표 조회 실패도 던진다", async () => {
    respond([
      { data: [], error: null },
      { data: null, error: { message: "발표 터짐" } },
    ]);

    await expect(loadWorkloadSources(NOW)).rejects.toThrow(/발표 터짐/);
  });
});

describe("loadWorkloadSources — 클라이언트 주입", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ gte: h.gte });
    h.gte.mockReturnValue({ lte: h.lte });
    h.lte.mockReturnValue({ range: h.range });
    h.range.mockResolvedValue({ data: [], error: null });
  });

  it("넘긴 클라이언트를 쓴다 — 폴러 창구에는 세션이 없다", async () => {
    const injected = { from: vi.fn(() => ({ select: h.select })) };

    await loadWorkloadSources(
      NOW,
      injected as unknown as Parameters<typeof loadWorkloadSources>[1],
    );

    expect(injected.from).toHaveBeenCalledWith("closing_services");
    expect(h.from).not.toHaveBeenCalled();
  });
});
