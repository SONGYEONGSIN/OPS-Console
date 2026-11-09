const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `MANUAL_EDIT_ADMIN_EMAILS`(쉼표 구분) → 관리자 메일 목록. 메일 모양이 아닌 값은 버린다. */
export function parseAdminEmails(raw: string | undefined): string[] {
  const emails = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => EMAIL_SHAPE.test(s));
  return [...new Set(emails)];
}
