/**
 * 활동 로그 — 출처 둘을 한 모양으로.
 *
 * 자동화 잡은 `automation_runs` 에 **끝난 뒤 한 줄**이 생기고, 회사 PC 폴러는
 * 큐 테이블에 요청→claim→완료 3단계를 남긴다. 화면이 두 모양을 알 필요는 없다.
 *
 * 순수 함수로 둔 이유: 상태 어휘가 큐마다 달라(`entertest_test_runs` 만 `error`
 * 가 하나 더 있다) 조용히 틀리기 쉽다.
 */

export type ActivityOutcome = "ok" | "fail" | "skip" | "running" | "pending";

export type ActivityItem = {
  /** 일이 벌어진 시각(ISO). 끝난 것은 끝난 시각, 도는 중이면 요청 시각. */
  at: string;
  outcome: ActivityOutcome;
  /** 실패 사유 등 한 줄. 요약하지 않고 그대로 싣는다. */
  note: string | null;
};

export type JobRunRow = {
  ran_at: string;
  ok: boolean;
  skipped: boolean;
  message: string | null;
};

export function jobRunsToActivity(rows: readonly JobRunRow[]): ActivityItem[] {
  return rows
    .map((r) => ({
      at: r.ran_at,
      // 건너뜀은 실패가 아니다 — 자동 실행이 꺼져 있었을 뿐이다.
      outcome: (r.skipped ? "skip" : r.ok ? "ok" : "fail") as ActivityOutcome,
      note: r.message,
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

export type QueueRow = {
  status: string;
  requested_at: string;
  finished_at: string | null;
};

export function queueRowsToActivity(rows: readonly QueueRow[]): ActivityItem[] {
  return rows
    .map((r) => {
      // 큐마다 어휘가 다르다 — entertest 만 `error` 를 더 쓴다.
      const outcome: ActivityOutcome =
        r.status === "done"
          ? "ok"
          : r.status === "failed" || r.status === "error"
            ? "fail"
            : r.status === "running"
              ? "running"
              : "pending";
      return {
        // 끝난 것은 끝난 시각으로 — 요청 시각으로 적으면 오래 걸린 일이
        // 실제보다 이르게 줄에 선다.
        at: r.finished_at ?? r.requested_at,
        outcome,
        note: null,
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
