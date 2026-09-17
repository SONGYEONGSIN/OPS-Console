import type { AssignmentChange } from "./ledger-schemas";

/**
 * 되돌리기를 **누를 수 있는지**의 판정. 순수 함수라 화면과 테스트가 같은 것을 본다.
 *
 * 서버(`revertChange`)도 같은 두 조건을 다시 본다 — 여기서 막는 것은 친절이고,
 * 거기서 막는 것이 안전장치다. 눌러 보고 나서야 "안 된다" 를 듣는 버튼은 고장으로
 * 보이지만, 화면 판정만 믿으면 낡은 화면이 남의 변경을 덮는다.
 */

/** 한 대학 안에서 칸을 가르는 키 — 자연키에서 학년도·대학명을 뺀 나머지. */
const cellKey = (c: AssignmentChange) =>
  [c.academic_year, c.university_name, c.work_kind, c.subtype, c.role].join(
    "|",
  );

/**
 * 칸마다 **가장 최근** 이력 줄의 id.
 *
 * 들어온 순서를 믿지 않는다. 조회가 최신순으로 주지만(`listAssignmentChanges`),
 * 그 정렬에 판정을 얹으면 조회 한 줄이 바뀔 때 되돌리기 버튼이 엉뚱한 줄에 붙는다.
 */
export function latestPerCell(
  changes: readonly AssignmentChange[],
): Set<string> {
  const latest = new Map<string, AssignmentChange>();
  for (const c of changes) {
    const key = cellKey(c);
    const seen = latest.get(key);
    if (!seen || c.changed_at > seen.changed_at) latest.set(key, c);
  }
  return new Set([...latest.values()].map((c) => c.id));
}

/**
 * 막을 이유. 없으면 `null` 이다.
 *
 * **'또 바뀌었다' 를 먼저 말한다** — 그건 사람이 손 쓸 수 있다(최신부터 차례로
 * 되돌린다). 주소가 사라진 것은 그 자리에서 할 수 있는 일이 없다.
 */
export function revertBlockedReason(
  change: AssignmentChange,
  opts: { latestIds: ReadonlySet<string>; knownEmails: ReadonlySet<string> },
): string | null {
  if (!opts.latestIds.has(change.id)) {
    return "그 뒤에 이 칸이 또 바뀌었습니다 — 최신 변경부터 차례로 되돌려야 합니다";
  }
  if (
    change.prev_assignee !== null &&
    !opts.knownEmails.has(change.prev_assignee)
  ) {
    return "되돌릴 주소가 운영자 명부에 없습니다";
  }
  return null;
}
