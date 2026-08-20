/**
 * 공지 예약 시각 ↔ 화면 입력값.
 *
 * `datetime-local` 은 **시간대가 없는** `YYYY-MM-DDTHH:mm` 을 준다. `new Date(그 값)`
 * 은 브라우저의 시간대로 읽으므로, 밖에서 연 창과 사무실에서 연 창이 다른 시각을
 * 저장하게 된다. 그래서 **항상 KST 로 읽고 KST 로 되돌린다.**
 *
 * 순수 함수로 둔 이유: 시간대는 눈으로 검산이 안 된다.
 */

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
/** KST 는 서머타임이 없어 고정 오프셋으로 다뤄도 된다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 화면 입력값(KST 벽시계) → 저장할 ISO. 비었거나 형식이 아니면 null(=즉시). */
export function kstLocalToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  return new Date(asUtc - KST_OFFSET_MS).toISOString();
}

/** 저장값 → 화면 입력값(KST 벽시계). 없으면 빈 문자열. */
export function isoToKstLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  // 마이그레이션 전 남아 있는 날짜 값('YYYY-MM-DD')도 그날 00:00 KST 로 읽는다.
  // 마이그레이션이 옮기는 값과 같아야 화면이 흔들리지 않는다.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T00:00`;

  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const kst = new Date(t + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${kst.getUTCFullYear()}-${p(kst.getUTCMonth() + 1)}-${p(kst.getUTCDate())}` +
    `T${p(kst.getUTCHours())}:${p(kst.getUTCMinutes())}`
  );
}
