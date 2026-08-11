/**
 * 공동작업자 이메일 정규화 — 중복 제거 + 등록자 본인 제거. 선택한 순서는 유지한다.
 *
 * 폼에서도 중복·본인 선택을 막지만, server action은 폼을 거치지 않고 직접 호출될 수 있다.
 * 경계에서 한 번 더 적용해 저장 값이 항상 정규형이 되게 한다.
 */
export function normalizeCollaborators(
  emails: string[] | undefined,
  authorEmail: string,
): string[] {
  if (!emails) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    if (email === authorEmail) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
