/** datetime-local(KST) 문자열 → UTC Date. 빈/잘못된 값 null. */
export function parseScheduledAtKst(value: string): Date | null {
  if (!value) return null;
  const hasSeconds = /T\d\d:\d\d:\d\d/.test(value);
  const normalized = (hasSeconds ? value : `${value}:00`) + "+09:00";
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
