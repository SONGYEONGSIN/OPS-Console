import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 학년도 배정 요청 적재(설계 §6.4).
 *
 * **매일 돈다.** 연 1회 잡을 담을 `cadence` 값이 없어서인데, 그래서 "이미 있는가" 의
 * 판정이 이 잡의 전부다 — 잘못 읽으면 같은 판정이 매일 한 벌씩 돈다.
 */
const hasPendingAnnualBatch = vi.fn();
const latestAnnualBasis = vi.fn();
const countLedgerRows = vi.fn();
const listOperators = vi.fn();
const enqueueProposeRequest = vi.fn();

vi.mock("@/features/assignments/proposal/queries", () => ({
  hasPendingAnnualBatch: (...a: unknown[]) => hasPendingAnnualBatch(...a),
  latestAnnualBasis: (...a: unknown[]) => latestAnnualBasis(...a),
}));
vi.mock("@/features/assignments/ledger-queries", () => ({
  countLedgerRows: (...a: unknown[]) => countLedgerRows(...a),
}));
vi.mock("@/features/operators/queries", () => ({
  listOperators: (...a: unknown[]) => listOperators(...a),
}));
vi.mock("@/features/assignments/propose-requests/enqueue", () => ({
  AUTOMATION_REQUESTER: "automation",
  enqueueProposeRequest: (...a: unknown[]) => enqueueProposeRequest(...a),
}));
const ADMIN = { __admin: true };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ADMIN }));

const { runAssignmentYearRollover } =
  await import("../assignment-year-rollover");

const op = (email: string, group: string | null) => ({
  email,
  name: email,
  status: "active",
  assignable: true,
  tenure_group: group,
  hire_date: "2020-03-01",
});

/**
 * 2027 annual 배치가 **반려된 채로 하나** 있는 DB 대역 — `eq` 를 실제로 적용한다.
 * 프로덕션의 그 행(`status='rejected'`, `decided_at='2026-09-21T04:18'`)이다.
 */
function rejectedAnnualDb() {
  let matched: Record<string, unknown>[] = [
    { id: "b1", academic_year: 2027, kind: "annual", status: "rejected" },
  ];
  const chain: Record<string, unknown> = {
    select: () => chain,
    limit: () => chain,
    eq: (column: string, value: unknown) => {
      matched = matched.filter((r) => r[column] === value);
      return chain;
    },
    maybeSingle: () =>
      Promise.resolve({ data: matched[0] ?? null, error: null }),
  };
  return { from: () => chain } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPendingAnnualBatch.mockResolvedValue(false);
  latestAnnualBasis.mockResolvedValue({ previousYear: null, previous: null });
  countLedgerRows.mockResolvedValue(120);
  listOperators.mockResolvedValue([op("a@x.com", "2")]);
  enqueueProposeRequest.mockResolvedValue({
    ok: true,
    skipped: false,
    message: "요청을 큐에 넣었습니다",
  });
});

describe("runAssignmentYearRollover", () => {
  it("그 학년도 배치가 없으면 annual 요청을 적재한다", async () => {
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.ok).toBe(true);
    expect(r.skipped).toBeFalsy();
    expect(enqueueProposeRequest).toHaveBeenCalledWith(
      "automation",
      expect.objectContaining({ academicYear: 2027, kind: "annual" }),
    );
  });

  it("**원장·명부를 admin 클라이언트로 읽는다 — 잡에는 세션이 없다**", async () => {
    /*
     * 실측(2026-09-18 라이브): `assignments`·`operators` 의 select 정책이 둘 다
     * `to authenticated` 라, 세션 없는 클라이언트는 `count=null` 에 **코드도
     * 메시지도 빈 에러**를 받는다. 그대로 두면 잡이 매일 500 으로 죽는다.
     */
    // 명부는 상기 문구를 만들 때만 읽는다 — 직전 배치가 있어야 그 경로로 간다.
    latestAnnualBasis.mockResolvedValue({
      previousYear: 2026,
      previous: { "2": ["a@x.com"] },
    });
    await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(countLedgerRows).toHaveBeenCalledWith(2027, ADMIN);
    expect(listOperators).toHaveBeenCalledWith(ADMIN);
  });

  it("검토 대기 배치가 있으면 적재하지 않는다 — 같은 판정이 매일 돌지 않는다", async () => {
    hasPendingAnnualBatch.mockResolvedValue(true);
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.skipped).toBe(true);
    expect(r.message).toMatch(/검토 대기/);
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
  });

  it("반려된 배치만 있으면 적재한다 — 반려가 학년도를 닫지 않는다", async () => {
    /*
     * 2026-09-21 실측: 2027 annual 배치를 반려하자 이 잡이 그 뒤로 매번
     * `2027학년도 제안 배치가 이미 있습니다` 로 skip 했다. 반려는 '이번 제안이
     * 별로다' 이지 '올해는 됐다' 가 아니다(설계 R4).
     *
     * **조회를 실물로 태운다** — 잡이 조회를 mock 하므로, 여기서도 mock 값을
     * 넣으면 "false 면 적재한다" 를 한 번 더 확인할 뿐이고 반려 행이 무엇으로
     * 읽히는지는 아무도 안 본다.
     */
    const actual = await vi.importActual<
      typeof import("@/features/assignments/proposal/queries")
    >("@/features/assignments/proposal/queries");
    hasPendingAnnualBatch.mockImplementation((year: number) =>
      actual.hasPendingAnnualBatch(year, rejectedAnnualDb()),
    );

    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.skipped).toBeFalsy();
    expect(enqueueProposeRequest).toHaveBeenCalledWith(
      "automation",
      expect.objectContaining({ academicYear: 2027, kind: "annual" }),
    );
  });

  it("학년도 경계 전에는 이전 학년도다 (2026-02-28 → 2026)", async () => {
    await runAssignmentYearRollover(new Date("2026-02-28T03:00:00Z"));
    expect(enqueueProposeRequest).toHaveBeenCalledWith(
      "automation",
      expect.objectContaining({ academicYear: 2026 }),
    );
  });

  it("학년도 경계 다음 날은 새 학년도다 (2026-03-01 → 2027)", async () => {
    await runAssignmentYearRollover(new Date("2026-03-01T03:00:00Z"));
    expect(enqueueProposeRequest).toHaveBeenCalledWith(
      "automation",
      expect.objectContaining({ academicYear: 2027 }),
    );
  });

  it("원장에 그 학년도 배정이 없으면 적재하지 않는다", async () => {
    /*
     * 빈 원장으로 판정하면 제안 0건짜리 배치가 만들어지고, 그 순간
     * `hasPendingAnnualBatch` 가 참이 되어 **진짜 배정은 제안되지 않는다**
     * (누군가 그 빈 배치를 결정할 때까지).
     * 총괄장 이관이 먼저다.
     */
    countLedgerRows.mockResolvedValue(0);
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.skipped).toBe(true);
    expect(r.message).toMatch(/원장/);
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
  });

  it("그룹 구성이 직전 배치와 같으면 3월 갱신을 상기한다", async () => {
    latestAnnualBasis.mockResolvedValue({
      previousYear: 2026,
      previous: { "2": ["a@x.com"] },
    });
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.message).toMatch(/2026학년도 배치와 동일/);
    expect(r.message).toMatch(/3월 갱신/);
  });

  it("그룹 구성이 다르면 상기하지 않는다", async () => {
    latestAnnualBasis.mockResolvedValue({
      previousYear: 2026,
      previous: { "2": ["b@x.com"] },
    });
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.message).not.toMatch(/3월 갱신/);
  });

  it("배정 대상만 견준다 — 대상 아닌 사람이 그룹을 바꾼 것으로 읽히지 않는다", async () => {
    // `basis.groups` 는 배정 대상만 담는다(buildWorkload 가 거른다). 여기서 전원을
    // 담으면 팀장 한 명이 들어온 날 '그룹이 바뀌었다' 가 되어 상기가 사라진다.
    listOperators.mockResolvedValue([
      op("a@x.com", "2"),
      { ...op("boss@x.com", "2"), assignable: false },
    ]);
    latestAnnualBasis.mockResolvedValue({
      previousYear: 2026,
      previous: { "2": ["a@x.com"] },
    });
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.message).toMatch(/3월 갱신/);
  });

  it("배치 조회가 실패하면 실패로 끝난다 — '없다' 로 읽고 적재하지 않는다", async () => {
    hasPendingAnnualBatch.mockRejectedValue(new Error("boom"));
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/boom/);
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
  });

  it("적재가 막히면 그대로 전한다", async () => {
    enqueueProposeRequest.mockResolvedValue({
      ok: true,
      skipped: true,
      message: "이미 대기 중인 요청이 있습니다",
    });
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.skipped).toBe(true);
    expect(r.message).toMatch(/이미 대기 중/);
  });
});
