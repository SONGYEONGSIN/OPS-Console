/**
 * 배정 후보 — **`status='active'` 뿐**이다.
 *
 * 세 질문이 서로 다르다: 누구를 **새로 배정**할 수 있나(정책), 이 이메일이
 * **누구인가**(사실 — 이력의 이름 풀이), 이 주소로 **되돌릴 수 있나**(FK 제약 —
 * `operators` 에 있는가). 뒤의 둘은 명부 전원이고 좁히는 것은 첫 번째뿐이다.
 * 한 목록으로 뭉치면 삭제된 사람이 후보에 뜨거나, 화면 판정이 서버와 갈린다.
 *
 * **`assignable` 로 좁히지 않는다.** 그 칸은 자동 배정의 대상 여부이고(설계 §3.4 —
 * 팀장·부장·이사·기획팀·테스트 계정이 false), 수동 편집기는 자동이 못 다루는 예외를
 * 처리하는 자리다. 거기에 자동의 제외 규칙을 걸면 정당한 예외 배정을 막는다.
 *
 * 순서는 조회가 준 그대로 둔다(팀·입사일). 가나다순으로 다시 세우면 같은 팀이
 * 흩어져 드롭다운에서 찾기 어려워진다.
 */
export function assignmentCandidates(
  operators: readonly { email: string; name: string; status: string }[],
): { email: string; name: string }[] {
  return operators
    .filter((o) => o.status === "active")
    .map((o) => ({ email: o.email, name: o.name }));
}
