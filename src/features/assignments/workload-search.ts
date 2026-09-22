import type { WorkloadGroup, WorkloadRow } from "./workload";

/**
 * 배정현황 검색 — **표시만 걸러낸다.**
 *
 * 그룹 목표는 그룹 안 평균이다. 검색으로 남은 줄만 다시 평균 내면 한 사람을 찾을 때
 * **그 사람 자신이 목표**가 되어 편차가 늘 0% 로 나온다. 검색할 때마다 숫자가
 * 달라지는 표는 근거가 못 되므로, 목표와 편차는 `buildWorkload` 가 전원으로 낸
 * 값을 그대로 옮긴다.
 *
 * 찾는 축이 둘이다 — **담당자 이름**과 **담당 대학 이름**. 배정현황의 줄은 사람인데
 * '이 대학 누가 맡았나' 는 같은 표에 물을 질문이라, 둘 다 없으면 사람은 총괄장으로
 * 갔다가 다시 돌아온다.
 */

/** 비교용 정규화. 엑셀에서 온 이름에 앞뒤 공백이 섞여 있다. */
const norm = (s: string) => s.trim().toLowerCase();

/**
 * 그 줄이 검색어에 맞는가. 빈 검색어는 **모두 맞는다** — 필터가 아니다.
 */
export function matchesWorkloadQuery(row: WorkloadRow, term: string): boolean {
  const q = norm(term);
  if (q === "") return true;
  if (norm(row.name).includes(q)) return true;
  return row.universityNames.some((u) => norm(u).includes(q));
}

/**
 * 맞는 줄만 남긴 그룹 목록. **`target` 과 각 줄의 `deviation` 은 손대지 않는다.**
 *
 * 줄이 하나도 안 남은 그룹은 빼낸다 — 머리행만 남으면 '이 그룹엔 아무도 없다' 로
 * 읽히는데 실제로는 검색에 안 걸린 것이다.
 */
export function filterWorkload(
  groups: readonly WorkloadGroup[],
  term: string,
): WorkloadGroup[] {
  if (norm(term) === "") return [...groups];
  return groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) => matchesWorkloadQuery(r, term)),
    }))
    .filter((g) => g.rows.length > 0);
}
