import type { CurrentOperator } from "@/features/auth/queries";

/**
 * 현황 최신화 버튼을 누를 수 있는가 — admin 또는 SMS 발신번호 등록 담당자.
 *
 * 담당자는 신청 알림을 받는 매니저와 같은 사람(env `SMS_SENDER_REQUEST_MANAGER_EMAIL`).
 * 빈 값끼리는 같다고 보지 않는다 — env 가 비고 메일이 빈 운영자가 통과하면 안 된다.
 * 누를 때마다 Moa 로그인 인증 문자가 1통 가므로 메뉴 권한보다 좁다.
 */
export function canRequestStatusRefresh(
  me: Pick<CurrentOperator, "email" | "permission">,
  managerEmail: string | undefined,
): boolean {
  if (me.permission === "admin") return true;
  const manager = (managerEmail ?? "").trim().toLowerCase();
  if (!manager) return false;
  return me.email.trim().toLowerCase() === manager;
}
