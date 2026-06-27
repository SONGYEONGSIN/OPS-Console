/** 이메일 검증/파싱 공용 유틸 — 외부 발송(견적서 등)에서 이름이 주소로 새는 것을 막는다. */

/** 단순·실용 이메일 검증 — 공백 없는 local@domain.tld 형태. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 자유 입력 텍스트(콤마/세미콜론/줄바꿈/공백 구분)를 유효 이메일(중복 제거,
 * 입력 순서 보존)과 무효 토큰으로 분리한다.
 */
export function parseEmailList(text: string): {
  emails: string[];
  invalid: string[];
} {
  const tokens = text
    .split(/[\s,;]+/)
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
