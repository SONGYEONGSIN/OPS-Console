/**
 * 청구일자(text)로부터 기준 시각(now)까지의 경과 일수.
 *
 * 인스펙터의 `elapsedDays`(receivables/helpers.ts)와 동일 규칙 —
 * 화면 표시값과 메일 발송 기준을 일치시키기 위해 동일 계산을 공유한다.
 * 파싱 실패 또는 미래 일자면 null.
 *
 * @param dateText "2026-04-30" 등 청구일자 표시 텍스트
 * @param now 기준 시각 (테스트 결정성을 위해 주입)
 */
export function computeElapsedDays(
  dateText: string | null | undefined,
  now: Date,
): number | null {
  if (!dateText) return null;
  const d = new Date(String(dateText).trim());
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
