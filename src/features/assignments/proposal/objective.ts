import type { WorkloadCell, WorkloadGroup } from "../workload";

/**
 * §6.1 의 목표 함수 — **판정하지 않고 채점한다**(rev 2).
 *
 * rev 1 은 여기에 탐욕적 이동 **생성기**를 뒀다. rev 2 에서 생성은 에이전트가 하고
 * (§6.3) 이 모듈은 에이전트가 지켜야 할 **제약과 그 채점**만 갖는다. 같은 산식이
 * 세 곳에 쓰인다 — 에이전트에게 주는 근거(§6.3), 게이트 G6 의 기준, 배분현황 표(§9.4).
 */

/**
 * 이동 한 줄. **단위는 (대학 × 업무종류)다.**
 *
 * §6.3 의 응답 형식은 하위유형·역할도 적었지만 이동의 단위로 두지 않는다.
 * - **하위유형**: 원장은 하위유형마다 한 줄이라 한 줄만 옮기면 수시는 김, 정시는
 *   이가 되는데 **그게 바로 C4 가 막으려던 분할**이다. C6 이 "대학은 통째로
 *   옮긴다"고 한 것과도 어긋난다.
 * - **역할**: 개발 칸은 `operators` 밖이라(PR4b) `assignable` 판정 자체가 불가능해
 *   배정 대상이 될 수 없다. 이동은 언제나 운영 칸이다.
 */
export type ProposedMove = {
  university_name: string;
  work_kind: string;
  /** 지금 담당자. 원장 값과 다르면 경합이다(G2). */
  prev_assignee: string | null;
  next_assignee: string;
  /** 근거 문장. 비어 있으면 G7 이 거부한다 — 사람이 승인할 수 없다. */
  reason: string;
};

/**
 * 상한. **프롬프트와 게이트가 이 하나를 본다** — 두 벌이 되면 모델에게는 3곳이라
 * 말하고 5곳을 받아 주게 된다(§6.1 끝).
 *
 * `perOperator` 는 **관여 횟수**다(주는 쪽이든 받는 쪽이든). 연속성을 지키려는
 * 상한인데, 사람의 담당 목록은 받을 때만큼 뺏길 때도 흔들린다.
 */
export const ASSIGNMENT_LIMITS = { perOperator: 3, perBatch: 15 } as const;

/**
 * §6.1 의 `dev(op)` — 두 축의 상대 편차 합.
 *
 * **`workload.ts` 가 이 함수를 쓴다.** 산식이 두 벌이 되면 배분현황 표와 게이트가
 * 다른 점수를 매기고, 화면에서 통과로 보이는 배치가 서버에서 탈락한다.
 */
export function deviation(
  row: { universities: number; density: number },
  target: { universities: number; density: number },
): number {
  // 목표가 0 인 축은 0 이다 — 전원이 0곳이면 견줄 것이 없다.
  const rel = (v: number, t: number) => (t === 0 ? 0 : Math.abs(v - t) / t);
  return (
    rel(row.universities, target.universities) +
    rel(row.density, target.density)
  );
}

/**
 * 이동을 원장 칸에 얹는다(불변). 그 **대학·업무종류의 칸을 통째로** 옮긴다 —
 * 하위유형을 가려 옮기는 순간 분할이 된다.
 *
 * 후보에 없는 대학은 칸을 만들지 않는다. 모르는 대학은 제약 위반이 아니라
 * **환각**이고, `parse-response` 가 먼저 떨군다(§6.1).
 */
export function applyMoves(
  cells: readonly WorkloadCell[],
  moves: readonly ProposedMove[],
): WorkloadCell[] {
  const next = new Map(
    moves.map((m) => [`${m.university_name}|${m.work_kind}`, m.next_assignee]),
  );
  return cells.map((c) => {
    const to = next.get(`${c.university_name}|${c.work_kind}`);
    return to === undefined ? c : { ...c, assignee_email: to };
  });
}

/**
 * Σdev — **G6 이 보는 값**이다. 이것이 없으면 모델이 44곳을 흩어 놓거나 한 사람에게
 * 30곳을 몰아주는 배치가 관리자 화면까지 올라온다.
 *
 * 목표가 없는 묶음(그룹 미설정)은 더하지 않는다 — 견줄 기준이 없는데 0 으로 세면
 * 그 사람이 완벽하게 균형 잡힌 것처럼 합에 기여한다.
 */
export function sumDeviation(groups: readonly WorkloadGroup[]): number {
  let total = 0;
  for (const g of groups) {
    if (!g.target) continue;
    for (const r of g.rows) total += deviation(r, g.target);
  }
  return total;
}
