const AUTH_HINT = /인증\s*번호/;
const BRACKET_CODE = /\[([0-9]{4,8})\]/;

/**
 * 인증문자인가, 코드는 무엇인가 — 둘을 한 함수가 답한다. `null` 이면 인증문자가 아니다.
 *
 * 게이트 둘: 본문에 `인증번호` 가 **있고**, 그 **뒤에** 대괄호 4~8자리 숫자가 있어야 한다.
 * Moa 실문자는 `[Web발신][내부관리자] 본인확인 인증번호는 [130753] 입니다.` 다.
 *
 * 키워드 뒤에서 찾는 이유: 앞에 놓인 `[2026]` 같은 숫자 대괄호를 코드로 오인하면
 * 틀린 코드를 제출하고, 그 끝은 캡차 잠금이다(리뷰에서 잡음, 2026-09-11).
 *
 * 대괄호 없는 느슨한 규칙은 두지 않는다 — 전화번호·금액을 코드로 저장한다. 포맷이
 * 바뀌면 우편함이 비어 **시끄럽게** 실패하는 편이 낫다.
 */
export function extractSmsCode(body: string): string | null {
  const hint = AUTH_HINT.exec(body);
  if (!hint) return null;
  return BRACKET_CODE.exec(body.slice(hint.index))?.[1] ?? null;
}
