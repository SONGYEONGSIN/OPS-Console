export type CcRecipient = { email: string; name: string };

/**
 * 공통 CC에서 받는사람(To)과 중복되는 항목 제외 (대소문자 무시).
 * 동일인이 To이자 CC면 CC에서 빼서 중복 수신 방지.
 */
export function ccForRecipient(
  cc: CcRecipient[],
  recipientEmail: string,
): CcRecipient[] {
  const target = recipientEmail.trim().toLowerCase();
  return cc.filter((c) => c.email.trim().toLowerCase() !== target);
}
