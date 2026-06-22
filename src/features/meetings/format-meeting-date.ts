const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * 회의록 일시(meeting_date, UTC ISO 등)를 한국 표준시(KST)로 표기한다.
 * 예: "2026-06-25T06:00:00+00:00" → "2026. 06. 25. 15:00".
 * 빈값은 "—", 파싱 불가 문자열은 원본 그대로 반환(자유 입력 호환).
 */
export function formatMeetingDateKst(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // ko-KR 2-digit 포맷의 "2026. 06. 25. 15:24" 형태 — 끝 공백 정리.
  return KST_FORMATTER.format(d).replace(/\s+$/, "");
}
