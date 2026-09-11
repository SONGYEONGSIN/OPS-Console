import { smsCodeSchema } from "./schemas";

const AUTH_HINT = /인증\s*번호/;
const BRACKET_DIGITS = /\[([0-9]+)\]/;

/**
 * 인증문자인가, 코드는 무엇인가 — 둘을 한 함수가 답한다. `null` 이면 인증문자가 아니다.
 *
 * 게이트 둘: 본문에 `인증번호` 가 **있고**, 대괄호 안 숫자가 코드 모양이어야 한다.
 * Moa 실문자는 `[Web발신][내부관리자] 본인확인 인증번호는 [130753] 입니다.` 이고
 * 앞의 대괄호 둘은 숫자가 아니라 걸리지 않는다.
 *
 * 대괄호 없는 느슨한 규칙은 두지 않는다 — 전화번호·금액을 코드로 저장한다. 포맷이
 * 바뀌면 우편함이 비어 **시끄럽게** 실패하는 편이 낫다.
 */
export function extractSmsCode(body: string): string | null {
  if (!AUTH_HINT.test(body)) return null;
  const digits = BRACKET_DIGITS.exec(body)?.[1];
  const code = smsCodeSchema.safeParse(digits);
  return code.success ? code.data : null;
}
