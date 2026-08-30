/**
 * 조직 목표의 실적은 **소속원의 실적을 합산**해서 낸다. 누구를 합산하느냐를
 * 정하는 자리 — 틀리면 달성률이 조용히 틀리고 아무도 눈치채지 못한다.
 *
 * 순수 함수로 둔 이유: 팀·부서 경계가 사람 이름표가 아니라 조직도라서,
 * 화면에서 눈으로 검산할 수 없다.
 */
export type OrgGoalScope = "division" | "team";

export function orgGoalMembers(
  scope: OrgGoalScope,
  ownerName: string,
  operators: readonly {
    name: string;
    email: string;
    team: string;
    department: string;
  }[],
): string[] {
  return operators
    .filter((o) => {
      // 테스트 계정의 실적이 팀 성과에 들어가면 목표가 저절로 채워진다.
      if (o.name.startsWith("테스트")) return false;
      return scope === "team"
        ? o.team === ownerName
        : o.department === ownerName;
    })
    .map((o) => o.email);
}
