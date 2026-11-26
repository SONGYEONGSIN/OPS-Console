/**
 * 경위서 권한 판정 — 화면(편집 칸 잠금)과 server action 이 같은 함수를 쓴다.
 * DB 잠금(20261126_incident_reports_write_lock.sql)과 기준이 같아야 한다.
 */

type Actor = { email: string; permission: string | null };

/** 본문 편집 — 작성자 또는 admin. 승인자(팀장)는 고치지 않고 반려로 돌려보낸다. */
export function canEditReport(
  report: { author_email: string },
  me: Actor,
): boolean {
  return report.author_email === me.email || me.permission === "admin";
}

/**
 * 경위서 생성 — 사고 등록과 같은 기준(활성 운영자 + admin·member).
 * incidents insert 정책 `incidents_write_admin_member`(20260526b) 조건 그대로다.
 * getCurrentOperator 는 operators 행이 없는 계정에도 값을 주므로 operators 행으로 판정한다.
 */
export function canCreateReport(
  operator: { permission: string | null; status: string | null } | null,
): boolean {
  if (!operator || operator.status !== "active") return false;
  return operator.permission === "admin" || operator.permission === "member";
}
