/**
 * GAS `normalizeName_` 1:1 포팅 — 변경 시 `__tests__/fixtures/gas-cases.json`의
 * normalize 섹션과 동기 필요. 특수 매핑 dict + 한글 정규화.
 */

const SPECIAL_MAP: Record<string, string> = {
  미컴원: "서강대",
  성대외국인유: "성대",
  부산여자대학: "부산여대",
  건대대학원분교: "건국대",
  건대분교대학원: "건국대",
  단국대: "(학)단국대",
  융합산업대학원: "한양대",
  언론정보대학원: "한양대",
  공학대학원: "한양대",
  "대학원교학팀(대학원": "조선대",
  "보건대학원(특수대학": "조선대",
  이대: "이화여대",
  시립대: "서울시립대",
  숙대: "숙명여자",
  "한남.": "한남대",
  대구가톨릭재무: "대구가톨릭대",
  연대: "연세대",
  입학본부: "서울대",
  성대: "성균관대",
  계원예대: "계원예술대",
  두원공대: "두원공과대",
  숙명MBA: "숙명여자",
  충대: "충남대",
  청강대: "청강문화산업대",
  모의논술7: "한양대",
  춘천교대대학원: "춘천교육대",
  "한예종-기획처": "한국예술종합학교",
  서울과기대: "서울과학기술대학교",
  "입학전형팀(입학처)": "조선대",
  입학관리실: "동국대학교WISE캠퍼스",
  숙명국제학부: "숙명여자",
};

/** GAS와 동일한 dict 적용 + 한글 정규화 규칙 */
export function normalizeName(name: string): string {
  if (!name) return "";
  let n = String(name).replace(/\s+/g, "");

  // 특수 매핑 — 완전 일치 또는 prefix 매칭. GAS는 forEach (break 없음)이므로
  // 모든 key 적용. 결과적으로 "성대외국인유" → "성대" → "성균관대" 같은 chain 발생.
  // 후속 includes("성균관") 룰이 다시 "성대"로 변환하므로 최종 안정화.
  for (const key of Object.keys(SPECIAL_MAP)) {
    if (n === key || n.startsWith(key)) {
      n = SPECIAL_MAP[key];
    }
  }

  // 한글 정규화 (순서 중요 — 긴 패턴 먼저)
  n = n.replace(/여자대학교/g, "여대");
  n = n.replace(/여자대학/g, "여대");
  n = n.replace(/여자/g, "여");
  n = n.replace(/대학교/g, "대");
  n = n.replace(/대학/g, "대");
  if (n.includes("성균관")) n = "성대";

  return n;
}
