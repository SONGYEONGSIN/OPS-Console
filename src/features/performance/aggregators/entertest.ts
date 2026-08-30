import { inRange, type MetricValue, type Period } from "./types";

/**
 * 원서 테스트 실행 — 본인(requested_by) 기간 내 실행 건수.
 *
 * `requested_by` 가 이메일이라 개인 귀속이 바로 된다. 조사에서 "지금 데이터로
 * 즉시 구현 가능"으로 확인된 갈래다.
 *
 * **실패한 실행도 센다.** 테스트는 깨진 걸 찾는 일이라 실패를 빼면 일을 많이 한
 * 사람이 적게 한 것으로 보인다. 대신 근거에 갈라 적는다.
 */
export function aggregateEntertest(
  rows: { requested_by: string | null; status: string; requested_at: string }[],
  email: string,
  p: Period,
): MetricValue {
  const mine = rows.filter(
    (r) => r.requested_by === email && inRange(r.requested_at, p),
  );
  const done = mine.filter((r) => r.status === "done").length;
  return {
    value: mine.length,
    unit: "건",
    detail: `완료 ${done} / 전체 ${mine.length}`,
  };
}
