/** ISO 시각을 KST 무관 절대 차이로 '방금 전 / N분 / 시간 / 일 전' 반환.
 *  미래 시각 또는 60초 미만은 '방금 전'. null/잘못된 입력은 '—'. */
export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = now.getTime() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
