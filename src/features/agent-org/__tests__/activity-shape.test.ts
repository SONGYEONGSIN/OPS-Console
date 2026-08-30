import { describe, it, expect } from "vitest";
import { jobRunsToActivity, queueRowsToActivity } from "../activity-shape";

/**
 * 활동 로그는 출처가 둘이고 모양이 다르다 — 자동화 잡은 `automation_runs`
 * (끝난 뒤 한 줄), 회사 PC 폴러는 큐 테이블(요청→claim→완료 3단계).
 *
 * 화면이 두 모양을 알 필요는 없다. 여기서 한 모양으로 접는다.
 */
describe("jobRunsToActivity", () => {
  it("성공·실패·건너뜀을 갈라 적는다", () => {
    const out = jobRunsToActivity([
      { ran_at: "2026-08-30T10:00:00+09:00", ok: true, skipped: false, message: null },
      { ran_at: "2026-08-30T09:00:00+09:00", ok: false, skipped: false, message: "500" },
      { ran_at: "2026-08-30T08:00:00+09:00", ok: true, skipped: true, message: null },
    ]);
    expect(out.map((a) => a.outcome)).toEqual(["ok", "fail", "skip"]);
  });

  it("실패 사유를 그대로 싣는다 — 요약하면 왜 안 됐는지 모른다", () => {
    const out = jobRunsToActivity([
      { ran_at: "2026-08-30T09:00:00+09:00", ok: false, skipped: false, message: "Graph 500" },
    ]);
    expect(out[0].note).toBe("Graph 500");
  });

  it("건너뜀은 실패가 아니다 — 자동 실행이 꺼져 있었을 뿐이다", () => {
    const out = jobRunsToActivity([
      { ran_at: "2026-08-30T08:00:00+09:00", ok: false, skipped: true, message: null },
    ]);
    expect(out[0].outcome).toBe("skip");
  });
});

describe("queueRowsToActivity", () => {
  it("끝난 것은 끝난 시각으로 적는다 — 요청 시각이 아니라", () => {
    const out = queueRowsToActivity([
      {
        status: "done",
        requested_at: "2026-08-30T09:00:00+09:00",
        finished_at: "2026-08-30T09:00:40+09:00",
      },
    ]);
    expect(out[0].at).toBe("2026-08-30T09:00:40+09:00");
    expect(out[0].outcome).toBe("ok");
  });

  it("아직 도는 중이면 요청 시각으로 두고 그렇다고 적는다", () => {
    const out = queueRowsToActivity([
      {
        status: "running",
        requested_at: "2026-08-30T09:00:00+09:00",
        finished_at: null,
      },
    ]);
    expect(out[0].at).toBe("2026-08-30T09:00:00+09:00");
    expect(out[0].outcome).toBe("running");
  });

  it("failed·error 를 모두 실패로 본다 — 큐마다 어휘가 다르다", () => {
    const out = queueRowsToActivity([
      { status: "failed", requested_at: "2026-08-30T09:00:00+09:00", finished_at: null },
      { status: "error", requested_at: "2026-08-30T08:00:00+09:00", finished_at: null },
    ]);
    expect(out.map((a) => a.outcome)).toEqual(["fail", "fail"]);
  });

  it("대기 중은 아직 아무 일도 안 일어난 것이다", () => {
    const out = queueRowsToActivity([
      { status: "pending", requested_at: "2026-08-30T09:00:00+09:00", finished_at: null },
    ]);
    expect(out[0].outcome).toBe("pending");
  });

  it("최신이 위로 온다", () => {
    const out = queueRowsToActivity([
      { status: "done", requested_at: "2026-08-30T08:00:00+09:00", finished_at: "2026-08-30T08:00:10+09:00" },
      { status: "done", requested_at: "2026-08-30T10:00:00+09:00", finished_at: "2026-08-30T10:00:10+09:00" },
    ]);
    expect(out[0].at).toBe("2026-08-30T10:00:10+09:00");
  });
});
