const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `MANUAL_EDIT_ADMIN_EMAILS`(쉼표 구분) → 관리자 메일 목록. 빈 칸은 무시한다.
 * 메일 모양이 아닌 값이 하나라도 있으면 **null(설정 오류)** — 조용히 빼면 관리자 한 명이
 * 요약을 못 받는데 실행은 성공으로 남는다.
 */
export function parseAdminEmails(raw: string | undefined): string[] | null {
  const entries = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (entries.some((s) => !EMAIL_SHAPE.test(s))) return null;
  return [...new Set(entries)];
}
