/**
 * GAS `normalizeName_` 포팅 — 변경 시 `__tests__/fixtures/gas-cases.json`의
 * normalize 섹션과 동기 필요. 특수 매핑 dict + 한글 정규화.
 *
 * SPECIAL_MAP = GAS 원본 + OPS-Console 운영 중 발견된 alias(예: 한양MBA) 누적.
 * 입금 거래내용 ↔ 미수 거래처 표기 차이로 자동매칭이 보류된 건은 여기에 추가한다.
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
  국제관광대학원: "한양대",
  한양인공지능융: "한양대",
  부동산융합대학: "한양대",
  "대학원교학팀(대학원": "조선대",
  "보건대학원(특수대학": "조선대",
  이대: "이화여대",
  이화경전원: "이화여대",
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
  한양MBA: "한양대",
  충대: "충남대",
  청강대: "청강문화산업대",
  모의논술7: "한양대",
  춘천교대대학원: "춘천교육대",
  "한예종-기획처": "한국예술종합학교",
  서울과기대: "서울과학기술대학교",
  "입학전형팀(입학처)": "조선대",
  입학관리실: "동국대학교WISE캠퍼스",
  숙명국제학부: "숙명여자",
  명지특수대학원: "명지대",
  // 입금 거래내용의 캠퍼스 줄임 표기 → 미수 거래처 정규화형. 캠퍼스 괄호가 달라
  // (성심 vs 성심교정) 강매칭이 보류되던 건. 캠퍼스를 보존해 다른 교정과 섞이지 않게 한다.
  "가톨릭대(성심)": "가톨릭대(성심교정)",
};

/**
 * GAS와 동일한 dict 적용 + 한글 정규화 규칙.
 *
 * `extraAliases`: admin이 불일치 승인 시 학습한 런타임 alias (DB). SPECIAL_MAP 위에
 * 병합되며 동일 규칙(완전일치/prefix)으로 적용. 미지정 시 기존 동작과 완전 동일.
 */
export function normalizeName(
  name: string,
  extraAliases: Record<string, string> = {},
): string {
  if (!name) return "";
  let n = String(name).replace(/\s+/g, "");

  // 특수 매핑 — 완전 일치 또는 prefix 매칭. GAS는 forEach (break 없음)이므로
  // 모든 key 적용. 결과적으로 "성대외국인유" → "성대" → "성균관대" 같은 chain 발생.
  // 후속 includes("성균관") 룰이 다시 "성대"로 변환하므로 최종 안정화.
  const map =
    Object.keys(extraAliases).length > 0
      ? { ...SPECIAL_MAP, ...extraAliases }
      : SPECIAL_MAP;
  for (const key of Object.keys(map)) {
    if (n === key || n.startsWith(key)) {
      n = map[key];
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

/**
 * 이름이 SPECIAL_MAP·학습 alias에 걸려 특정 대학으로 '해소'됐는지.
 *
 * 매칭 규칙은 `normalizeName`의 특수 매핑과 동일하다(완전일치 또는 prefix, 공백 제거).
 * 두 곳이 갈라지면 판정이 어긋나므로 함께 수정해야 한다.
 *
 * 용도: mismatch(금액 일치·이름 불일치) 확인 요청 제외. 별칭에 걸렸다는 것은 이 입금이
 * 어느 대학인지 이미 안다는 뜻이므로, 미수 거래처와 다르면 표기 변형 후보가 아니라
 * 그냥 다른 대학이다 (예: 한남대 ↔ 국제관광대학원(=한양대), 2026-08-04 오탐).
 */
export function resolvesViaAlias(
  name: string,
  extraAliases: Record<string, string> = {},
): boolean {
  if (!name) return false;
  const n = String(name).replace(/\s+/g, "");
  const map =
    Object.keys(extraAliases).length > 0
      ? { ...SPECIAL_MAP, ...extraAliases }
      : SPECIAL_MAP;
  return Object.keys(map).some((key) => n === key || n.startsWith(key));
}

/**
 * 캠퍼스 접미사 제거된 base 대학명 — `normalizeName` 결과 끝의 `(…)` 를 1개 제거.
 *
 * "을지대학교(성남)" → "을지대(성남)" → "을지대",
 * "을지대학교(의정부)" → "을지대(의정부)" → "을지대" (캠퍼스 무시 동일 키).
 *
 * 끝(`$`)의 괄호만 제거하므로 SPECIAL_MAP의 선두 괄호("(학)단국대")는 보존된다.
 * 한 대학이 캠퍼스별로 분리 기재됐으나 입금은 합산 1건으로 들어오는 경우의
 * 그룹핑 키로 사용한다.
 */
export function baseName(
  name: string,
  extraAliases: Record<string, string> = {},
): string {
  return normalizeName(name, extraAliases).replace(/\([^)]*\)$/, "");
}
