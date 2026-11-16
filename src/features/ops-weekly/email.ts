// 이메일 키 정규화 — 경계에서 한 번만 한다. operator_email 은 항상 이 값으로 저장하고 비교한다.
// 클라이언트에서도 쓰므로 server-only 를 import 하지 않는다.
export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}
