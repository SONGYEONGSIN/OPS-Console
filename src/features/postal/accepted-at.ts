/**
 * 영수증에 찍힌 **우체국 접수 일시** 표기.
 *
 * 판독기가 문자열로 읽어 오므로 형태가 일정하지 않다(`2026-08-21 15:44`,
 * 초가 붙은 것, 날짜만인 것). 같은 표의 '올린 날' 과 같은 모양으로 맞춘다 —
 * 한 표에서 표기가 갈리면 어느 쪽이 이른지 눈으로 비교할 수 없다.
 *
 * **`Date` 로 파싱하지 않는다.** 영수증의 시각은 이미 한국 시각인데, 시간대가
 * 없는 문자열을 `new Date()` 에 넣으면 브라우저 시간대로 읽혀 하루가 밀린다.
 * 숫자만 꺼내 다시 조립한다.
 */

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

export function formatAcceptedAt(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const m = SHAPE.exec(value.trim());
  // 모르는 형태는 손대지 않는다 — 판독한 값을 잃는 것보다 낫다.
  if (!m) return value.trim();

  const [, , mo, d, h, mi] = m;
  const date = `${mo}. ${d}.`;
  return h && mi ? `${date} ${h}:${mi}` : date;
}
