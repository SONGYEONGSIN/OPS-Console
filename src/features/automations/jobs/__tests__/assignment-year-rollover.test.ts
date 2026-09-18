import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 학년도 배정 요청 적재(설계 §6.4).
 *
 * **매일 돈다.** 연 1회 잡을 담을 `cadence` 값이 없어서인데, 그래서 "이미 있는가" 의
 * 판정이 이 잡의 전부다 — 잘못 읽으면 같은 판정이 매일 한 벌씩 돈다.
 */
const hasAnnualBatch = vi.fn();
const latestAnnualBasis = vi.fn();
const countLedgerRows = vi.fn();
const listOperators = vi.fn();
const enqueueProposeRequest = vi.fn();

vi.mock("@/features/assignments/proposal/queries", () => ({
  hasAnnualBatch: (...a: unknown[]) => hasAnnualBatch(...a),
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

beforeEach(() => {
  vi.clearAllMocks();
  hasAnnualBatch.mockResolvedValue(false);
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

  it("이미 있으면 적재하지 않는다 — 같은 판정이 매일 돌지 않는다", async () => {
    hasAnnualBatch.mockResolvedValue(true);
    const r = await runAssignmentYearRollover(new Date("2026-09-18T00:00:00Z"));
    expect(r.skipped).toBe(true);
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
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
     * `hasAnnualBatch` 가 참이 되어 **진짜 배정은 영영 제안되지 않는다.**
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
    hasAnnualBatch.mockRejectedValue(new Error("boom"));
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
