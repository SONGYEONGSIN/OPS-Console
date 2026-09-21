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

import {
  loadWorkloadSources,
  loadPreviousYearSources,
} from "../workload-queries";

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
            service_name: "2027학년도 수시모집",
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
        service_name: "2027학년도 수시모집",
        work_kind: "원서접수",
        start: "2026-09-01",
        end: "2026-09-10",
      },
    ]);
  });

  it("서비스명을 함께 읽는다 — 상세 리스트가 건수만으로는 못 선다", async () => {
    // 배분현황이 '이번 주 3건' 에서 멈추면 어느 대학의 무엇인지 볼 곳이 없다.
    await loadWorkloadSources(NOW);
    expect(h.select.mock.calls[0][0]).toMatch(/service_name/);
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

/**
 * 작년 물량은 **다른 표에 있다**(2026-09-21 라이브 실측).
 *
 *   2026학년도  services 2,511건/313곳  ↔ closing_services     2건/1곳
 *   2027학년도  services     0건/0곳    ↔ closing_services   983건/286곳
 *
 * `services` 는 2026-02-28 에서 멈춘 시트 임포트이고 `closing_services` 는 살아
 * 있는 마감 미러다. 그래서 **올해는 마감, 작년은 서비스목록**이다 — 한쪽만 읽으면
 * 작년 대비 비교가 구조적으로 불가능하다.
 */
describe("loadPreviousYearSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ gte: h.gte });
    h.gte.mockReturnValue({ lte: h.lte });
    h.lte.mockReturnValue({ range: h.range });
    h.range.mockResolvedValue({ data: [], error: null });
  });

  it("작년은 services 에서 읽는다 — closing_services 가 아니다", async () => {
    await loadPreviousYearSources(NOW);

    expect(h.from.mock.calls.map((c) => c[0])).toEqual([
      "services",
      "announcement_services",
    ]);
  });

  it("직전 학년도 창으로 자른다 — 2025-03-01 ~ 2026-02-28", async () => {
    /*
     * 창은 `academicYearRangeKST` 에서 **파생**한다. 여기서 연도만 빼면 윤년
     * 2월 29일에서 갈린다 — 3/1 의 하루 전이 곧 직전 학년도의 마지막 날이다.
     */
    await loadPreviousYearSources(NOW);

    expect(h.gte).toHaveBeenCalledWith(
      "write_start_at",
      "2025-03-01T00:01:00+09:00",
    );
    expect(h.lte).toHaveBeenCalledWith(
      "write_start_at",
      "2026-02-28T23:59:00+09:00",
    );
  });

  it("윤년 경계에서도 하루 전으로 넘어간다 (2028-03-01 → 2027-02-28)", async () => {
    await loadPreviousYearSources(new Date("2028-05-01T12:00:00+09:00"));

    expect(h.gte).toHaveBeenCalledWith(
      "write_start_at",
      "2027-03-01T00:01:00+09:00",
    );
    expect(h.lte).toHaveBeenCalledWith(
      "write_start_at",
      "2028-02-29T23:59:00+09:00",
    );
  });

  it("조회가 실패하면 던진다 — 작년이 0건이면 '줄었다' 로 읽힌다", async () => {
    respond([{ data: null, error: { message: "작년 터짐" } }]);

    await expect(loadPreviousYearSources(NOW)).rejects.toThrow(/작년 터짐/);
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
