/**
 * 실행 로그 한 줄이 **무엇인가** — 접수·성공·실패·스킵.
 *
 * 회사 PC 잡(경쟁률 점검·마감 스크래핑)은 큐에 적재만 하고 끝난다. 그 적재가
 * `성공` 으로 찍혀 있어서, 2026-08-03 실행이 트레이스백으로 죽고 08-28 실행이
 * 20분 제한에 잘렸는데도 화면에는 **성공 세 줄**이 나란히 있었다.
 *
 * 접수는 성공이 아니다. `skipped` 와도 다르다 — 스킵은 "이번엔 할 일이 없어 안 했다",
 * 접수는 "요청은 했고 결과는 아직" 이다.
 */

/**
 * 접수 표식. 메시지 **맨 앞**에 붙인다.
 *
 * 새 컬럼 대신 표식을 쓰는 이유: 잡마다 적재 방식이 달라 스키마를 바꾸면 모든 잡을
 * 건드려야 하는데, 이건 회사 PC 잡 둘만의 사정이다. 대신 정의를 한 곳에 두고
 * 테스트로 묶어 문자열이 흩어지지 않게 한다.
 */
export const QUEUED_MARK = "[접수]";

export type RunLogKind = "queued" | "ok" | "failed" | "skipped";

export function runLogKind(entry: {
  ok: boolean;
  skipped: boolean;
  message?: string;
}): RunLogKind {
  // 스킵이 먼저다 — 둘 다면 아예 안 한 것이다.
  if (entry.skipped) return "skipped";
  if (!entry.ok) return "failed";
  // 표식은 맨 앞에서만 본다. 결과 문장 안에 우연히 섞인 말을 접수로 읽지 않는다.
  return (entry.message ?? "").startsWith(QUEUED_MARK) ? "queued" : "ok";
}
