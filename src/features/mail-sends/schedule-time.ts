/**
 * 예약 발송 시각 파서. 도메인 공용(자료요청·오픈안내).
 *
 * `+09:00` 오프셋을 여기 한 곳에만 둔다 — 두 벌이 되면 한쪽만 고쳐졌을 때
 * 예약 메일이 9시간 어긋난 시각에 나가고, 그건 발송 후에야 드러난다.
 * `lib/kst-format.ts` 가 같은 이유로 존재한다.
 */

/** datetime-local(KST) 문자열 → UTC Date. 빈/잘못된 값 null. */
export function parseScheduledAtKst(value: string): Date | null {
  if (!value) return null;
  const hasSeconds = /T\d\d:\d\d:\d\d/.test(value);
  const normalized = (hasSeconds ? value : `${value}:00`) + "+09:00";
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
