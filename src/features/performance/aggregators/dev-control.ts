import { inRange, type MetricValue, type Period } from "./types";

/**
 * 원서접수 GEN 세팅 변경 — 본인 담당 서비스에서 관측된 세팅 변경 건수.
 *
 * 수집 스크립트가 파일 해시를 비교해 **이미 변경을 감지하고 있었다**. 다만
 * `dev_control_analyses` 가 upsert 라 최신 상태만 남아 사건이 사라졌다.
 * `dev_control_setting_changes` 에 append 한 것을 여기서 센다.
 *
 * **첫 관측(`prev_code_hash = null`)은 세지 않는다.** 파일을 처음 수집한
 * 날이지 세팅한 날이 아니다 — 157행이 한꺼번에 들어온 날을 성과로 세면
 * 그날 아무 일도 안 한 사람이 수십 건을 한 것으로 나온다.
 *
 * 귀속은 `services.operator_name` 스냅샷이다(이름). 수집이 **수동 실행**이라
 * 실행 사이의 여러 번 수정은 한 줄로 뭉친다 — '횟수'가 아니라 '관측'이다.
 */
export function aggregateDevControl(
  rows: {
    operator_name: string | null;
    prev_code_hash: string | null;
    observed_at: string | null;
  }[],
  operatorName: string | null,
  p: Period,
): MetricValue {
  if (!operatorName) return { value: 0, unit: "건", detail: "미매칭" };
  const count = rows.filter(
    (r) =>
      r.operator_name === operatorName &&
      r.prev_code_hash !== null &&
      inRange(r.observed_at, p),
  ).length;
  return { value: count, unit: "건" };
}
