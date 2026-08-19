/**
 * 영수증 수취인 → 총괄장 담당자.
 *
 * 순수 함수만 둔다(시트 조회는 queries). 규칙이 미묘해서 실제 데이터로 재보고 정했다:
 *
 * - 수취인은 `우석대 강정화`처럼 **소속 + 이름**이 붙어 있다. 마지막 낱말이 이름.
 * - `창원대`는 국립창원대·창원문성대·한국폴리텍Ⅶ대학(창원…) 셋에 걸린다.
 *   **그 낱말이 바로 `대학교`로 이어지는 곳만** 고른다 — 창원'문성'대는 사이에 낱말이
 *   끼고, 폴리텍은 괄호 안이라 제외된다.
 * - **`대학원` 표기가 있을 때만 대학원 시트**를 본다. 없으면 학부(수시 기준).
 *   두 시트에 다 있는 49곳 중 **40곳(82%)이 담당자가 다르다** — 임의로 고르면 안 된다.
 * - 후보가 둘 이상이면(건국대(서울)/(글로컬) 등) **자동으로 채우지 않는다.**
 *   틀린 담당자가 조용히 들어가면 우편물이 엉뚱한 사람에게 간다.
 */

export type AssigneeRow = {
  university: string;
  /** 학부는 수시 열, 대학원은 운영자 열 */
  operator: string;
};

export type AssigneeMatch = {
  /** 어느 시트를 봤나 */
  basis: "undergraduate" | "graduate";
  /** 이름이 걸린 총괄장 행들. 둘 이상이면 사람이 고른다. */
  candidates: AssigneeRow[];
  /** 유일하고 담당자가 적혀 있을 때만 채운다. 아니면 null. */
  assignee: string | null;
};

/** 수취인 문자열을 소속과 이름으로 가른다. 마지막 낱말이 이름이다. */
export function splitRecipient(raw: string): { org: string; name: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { org: "", name: "" };
  const name = parts[parts.length - 1];
  return { org: parts.slice(0, -1).join(" "), name };
}

/** 소속에 '대학원'이 적혀 있는가. 안 적혀 있으면 학부다. */
export function isGraduate(org: string): boolean {
  return /대학원/.test(org);
}

/**
 * 소속명으로 총괄장 행을 찾는다.
 *
 * `창원대` → `창원` + `대학교`로 이어지는 것만. 앞에 `국립`류 접두, 뒤에 캠퍼스
 * 괄호는 허용한다(`국립창원대학교`, `건국대학교(서울)`).
 */
function findRows(org: string, rows: AssigneeRow[]): AssigneeRow[] {
  // '대학원'은 시트를 고르는 표시일 뿐 대학명이 아니다 — 떼고 찾는다.
  const bare = org.replace(/\s*대학원\s*/g, " ").trim();
  if (!bare) return [];
  const stem = bare.replace(/(대학교|대)$/, "");
  if (!stem) return [];
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(국립|공립|사립)?${escaped}대학교(\\(.*\\))?$`);
  return rows.filter((r) => re.test(r.university));
}

export function matchAssignee(
  org: string,
  undergraduate: AssigneeRow[],
  graduate: AssigneeRow[],
): AssigneeMatch {
  const grad = isGraduate(org);
  const basis = grad ? ("graduate" as const) : ("undergraduate" as const);
  // 대학원 표기가 있으면 대학원 시트만 본다. 없다고 학부로 넘어가면
  // 임의 선택이 되고, 그게 82% 확률로 틀린다.
  const candidates = findRows(org, grad ? graduate : undergraduate);
  const assignee =
    candidates.length === 1 && candidates[0].operator
      ? candidates[0].operator
      : null;
  return { basis, candidates, assignee };
}
