import type { AssigneeRow } from "./assignee-match";

/**
 * 봉투에 적힌 줄임말을 정식 명칭으로 바꾼다 — `충청대` → `충청대학교`.
 *
 * **문자열 규칙으로 만들지 않는다.** `덕성여대` 에 `학교` 를 붙이면 `덕성여대학교` 가
 * 되는데 정답은 `덕성여자대학교` 다. 접미사 표를 따로 들면 총괄장과 갈라져, 어느 쪽이
 * 맞는지 알 수 없게 된다.
 *
 * 대신 **담당자 매칭이 이미 찾아낸 총괄장 행**을 쓴다. 그 시트가 정식 명칭의 출처다.
 * 후보가 하나로 좁혀졌다는 것은 어느 학교인지 확정됐다는 뜻이므로 그 이름을 그대로
 * 가져온다. 여럿이거나 없으면 **손대지 않는다** — 지어내면 우편물이 엉뚱한 이름으로
 * 대장에 남는다.
 */
export function officialOrgName(
  org: string | null,
  candidates: readonly AssigneeRow[],
): string | null {
  if (!org) return org;
  // 후보가 하나로 좁혀졌을 때만. 여럿이면 건국대(서울)인지 (글로컬)인지 모른다.
  if (candidates.length !== 1) return org;

  const official = candidates[0].university?.trim();
  if (!official) return org;

  // '대학원'은 시트를 고르는 표시라 총괄장 이름에는 대개 없다. 원문에 있었으면
  // 뒤에 남긴다 — 어느 시트를 봤는지가 사라지면 담당자 판단 근거도 사라진다.
  const hadGraduate = /대학원/.test(org);
  if (hadGraduate && !/대학원/.test(official)) return `${official} 대학원`;
  return official;
}
