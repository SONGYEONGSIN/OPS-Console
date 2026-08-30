/**
 * 합격자발표 서비스 → 총괄장 운영자.
 *
 * `announcement_services` 에는 운영자 컬럼이 없다(스크랩이 아니라 붙여넣기로
 * 들어온 표라서). 성과를 개인에 귀속하려면 총괄장(대학×서비스 배정)에서 가져와야 한다.
 *
 * **조용히 틀리면 남의 성과가 된다.** 그래서 규칙을 순수 함수로 못박고, 못 맞춘 건
 * 반드시 목록으로 돌려준다 — 0으로 삼키지 않는다.
 *
 * 실측(2026-08-30): 발표 서비스 87개 대학 중 전 시트를 합쳐 58개가 맞았다.
 * 남은 29개는 초중고·영재학교 16(총괄장은 대학 배정표라 아예 없다), 캠퍼스·전형
 * 접미사 8, 총괄장에 없는 대학 4다.
 */

export type AssignRow = { university: string; operator: string };

/**
 * 표기 차이만 지운다.
 *
 * 공백과 `국립/사립` 접두는 같은 학교의 다른 표기다(총괄장 `국립창원대학교` ↔
 * 발표 `창원대학교`). **접미사는 떼지 않는다** — `건국대학교 글로컬`을 본교로
 * 맞추면 글로컬 캠퍼스 실적이 본교 담당자 성과가 된다. 다른 사람의 일이다.
 */
export function normalizeUniv(name: string): string {
  return name.replace(/\s+/g, "").replace(/^(국립|사립)/, "");
}

export function matchOperators(
  universities: readonly string[],
  assignments: readonly AssignRow[],
): { matched: { university: string; operator: string }[]; unmatched: string[] } {
  const byName = new Map<string, string>();
  for (const a of assignments) {
    const key = normalizeUniv(a.university);
    const op = a.operator.trim();
    // 운영자 칸이 빈 행이 있다. 빈 이름을 붙이면 '배정됨'으로 보이는데
    // 실제로는 담당자가 없다.
    if (!op) continue;
    // 같은 학교가 여러 시트에 있으면 먼저 온 것을 쓴다(시트 우선순위는 호출부가 정한다).
    if (!byName.has(key)) byName.set(key, op);
  }

  const matched: { university: string; operator: string }[] = [];
  const unmatched: string[] = [];
  for (const u of universities) {
    const op = byName.get(normalizeUniv(u));
    if (op) matched.push({ university: u, operator: op });
    else unmatched.push(u);
  }
  return { matched, unmatched };
}
