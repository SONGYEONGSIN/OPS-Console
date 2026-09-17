import type { AssignmentRole } from "./ledger-schemas";

/**
 * 원장 한 칸 묶음(대학 하나 × 업무종류 하나)에 붙는 배지. 설계 §9.2.
 *
 * **화면에 인라인으로 쓰지 않는다.** PR6 의 게이트(G4 — 분할 44곳을 자동 이동에서
 * 뺀다)가 같은 판정을 써야 한다. 두 벌로 두면 화면이 '분할' 이라 표시한 대학을
 * 게이트는 아니라고 보는 일이 생긴다. 그래서 순수 함수이고 Tailwind 클래스를
 * 모른다 — 색은 `list-variants/assignments/status.ts` 가 붙인다.
 */
export const ASSIGNMENT_BADGES = ["미배정", "연결 안 됨", "분할"] as const;
export type AssignmentBadge = (typeof ASSIGNMENT_BADGES)[number];

/** 판정에 필요한 것만. 원장 행(`LedgerRow`)이 구조적으로 그대로 들어맞는다. */
export type BadgeCell = {
  role: AssignmentRole;
  assignee_email: string | null;
  assignee_name: string;
};

/**
 * **`연결 안 됨` 은 운영 칸에만 붙인다.** 라이브 실측(2026-09-15)에서 개발 칸
 * 890개의 이메일 매칭이 전부 0 이었다 — `operators` 가 운영부 명단이고 `team`
 * check 가 `운영1팀·운영2팀` 이라 개발부가 들어갈 자리가 없다. 정상인 상태에
 * 배지를 붙이면 890칸이 빨개지고, 그 소음이 진짜 미매칭 하나를 가린다.
 *
 * **`분할` 은 역할 안에서만 센다.** 운영 한 명 + 개발 한 명은 갈린 게 아니라
 * 정상이다. 세는 단위는 이메일이 아니라 **이름**이다 — 이메일로 세면 미매칭
 * 두 칸이 같은 사람이어도 둘로 보인다.
 *
 * 빈 이름은 배정이 아니라서 아예 세지 않는다(설계 F2 — 미배정은 정상 상태다).
 */
export function badgesOf(cells: readonly BadgeCell[]): AssignmentBadge[] {
  const named = cells.filter((c) => c.assignee_name.trim() !== "");
  if (named.length === 0) return ["미배정"];

  const out: AssignmentBadge[] = [];

  if (named.some((c) => c.role === "운영" && !c.assignee_email)) {
    out.push("연결 안 됨");
  }

  const namesByRole = new Map<AssignmentRole, Set<string>>();
  for (const c of named) {
    const seen = namesByRole.get(c.role) ?? new Set<string>();
    seen.add(c.assignee_name.trim());
    namesByRole.set(c.role, seen);
  }
  if ([...namesByRole.values()].some((s) => s.size > 1)) out.push("분할");

  return out;
}
