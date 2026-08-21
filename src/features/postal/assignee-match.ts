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
/**
 * 줄기 뒤에 이어붙일 꼬리.
 *
 * **사람이 봉투에 쓰는 이름은 정식 명칭이 아니다.** `덕성여대`는 `덕성여자대학교`,
 * `인천예술고`는 `인천예술고등학교`다(2026-08-21 실측).
 *
 * 줄기 자체는 그대로 둔다 — 부분 일치로 넓히면 `충남대`가 `충남도립대학교`까지
 * 걸려 엉뚱한 사람이 담당자로 들어간다.
 */
const NAME_TAILS = [
  "대학교",
  // 줄임말: 덕성여대 → 덕성여자대학교, 서울여대 → 서울여자대학교
  "자대학교",
  // 대학교로 안 끝나는 곳 — 고등학교도 우편 대상이다.
  // `인천예술고` 는 `고` 를 떼 `인천예술` 이 되므로 `고등학교` 가 필요하고,
  // `인천예술고등학교` 로 오면 `고등학교` 를 떼 같은 줄기가 되므로 `학교` 도 둔다.
  "고등학교",
  "등학교",
  "학교",
];

function findRows(org: string, rows: AssigneeRow[]): AssigneeRow[] {
  // '대학원'은 시트를 고르는 표시일 뿐 대학명이 아니다 — 떼고 찾는다.
  const bare = org.replace(/\s*대학원\s*/g, " ").trim();
  if (!bare) return [];
  // 꼬리를 떼어 줄기를 얻는다. `덕성여대` → `덕성여`, `인천예술고` → `인천예술`.
  const stem = bare.replace(/(대학교|대|고등학교|고|학교)$/, "");
  if (!stem) return [];
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `^(국립|공립|사립)?${escaped}(${NAME_TAILS.join("|")})(\\(.*\\))?$`,
  );
  return rows.filter((r) => re.test(r.university));
}

/**
 * 학교를 특정하지 않은 대학원의 담당자.
 *
 * `교육대학원` 처럼 학교명 없이 오는 경우가 있다. 시트에서 찾을 길이 없지만 실제로는
 * 담당자가 정해져 있다(2026-08-21 지정). 학교명이 붙어 있으면 그 학교를 따르므로
 * 이 값이 가리는 일은 없다.
 */
const UNNAMED_GRADUATE_ASSIGNEE = "김지나";

/**
 * 학교를 특정할 수 없는 대학원인가.
 *
 * `교육대학원`·`대학원` 처럼 **학교 이름이 아예 없는** 경우다. 판단 기준은
 * "`대`나 `대학교` 로 끝나는 낱말이 있는가" — `인천대 대학원` 은 `인천대` 가 있어
 * 여기 안 걸리고, `교육대학원` 은 `대학원` 을 떼면 `교육` 만 남아 학교가 아니다.
 */
function isUnnamedGraduate(org: string): boolean {
  const bare = org.replace(/\s*대학원\s*/g, " ").trim();
  if (!bare) return true;
  // 남은 낱말 중 학교 이름꼴이 하나도 없으면 특정 불가.
  return !bare.split(/\s+/).some((w) => /(대|대학교|고|학교)$/.test(w));
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
  if (candidates.length === 1 && candidates[0].operator) {
    return { basis, candidates, assignee: candidates[0].operator };
  }
  // 학교를 특정하지 않은 대학원 — `교육대학원`·`대학원` 처럼 앞에 학교명이 없다.
  //
  // `인천대 대학원` 은 `인천대` 가 남아 여기 안 걸린다. 학교명이 있는데 시트에서
  // 못 찾은 것과도 다르다: 그때는 비워야 사람이 알아채고 채운다.
  if (grad && isUnnamedGraduate(org)) {
    return { basis, candidates, assignee: UNNAMED_GRADUATE_ASSIGNEE };
  }
  return { basis, candidates, assignee: null };
}
