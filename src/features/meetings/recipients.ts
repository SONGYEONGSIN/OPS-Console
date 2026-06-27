/**
 * 회의록 메일 수신자 처리 — 운영자 선택 + 자유 입력을 합쳐 이메일만 검증/정제한다.
 * 참석자 "이름"을 그대로 수신 주소로 쓰던 버그(Graph ErrorInvalidRecipients)를 막는 단일 경로.
 */

/** 단순·실용 이메일 검증 — 공백 없는 local@domain.tld 형태. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 운영자 선택 이메일 + 자유입력 텍스트(콤마/세미콜론/줄바꿈/공백 구분)를 합쳐
 * 유효 이메일(중복 제거, 입력 순서 보존)과 무효 토큰을 분리한다.
 */
export function collectRecipients(
  operatorEmails: string[],
  freeText: string,
): { emails: string[]; invalid: string[] } {
  const tokens = [
    ...operatorEmails,
    ...freeText.split(/[\s,;]+/),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (!isValidEmail(token)) {
      if (!invalid.includes(token)) invalid.push(token);
      continue;
    }
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(token);
  }
  return { emails, invalid };
}
