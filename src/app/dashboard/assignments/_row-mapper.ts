import type { ListRow } from "../_components/patterns/ListPattern";
import type { UnivAssignmentRow } from "@/features/assignments/schemas";

export function univRowToListRow(u: UnivAssignmentRow): ListRow {
  const byService: NonNullable<ListRow["assignment"]>["byService"] = {};
  for (const [svc, rec] of Object.entries(u.byService)) {
    if (!rec) continue;
    byService[svc] = {
      operator: rec.operator,
      developer: rec.developer,
      detail: rec.detail,
    };
  }
  return {
    id: u.university,
    name: u.university,
    status: "active",
    owner: "",
    assignment: { byService },
  };
}

/** 대학명 + 모든 서비스 운영/개발 이름 양방향 매칭 (빈 term → true) */
export function matchesAssignmentQuery(row: ListRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t === "") return true;
  if (row.name.toLowerCase().includes(t)) return true;
  const bs = row.assignment?.byService ?? {};
  for (const rec of Object.values(bs)) {
    if (
      rec.operator.toLowerCase().includes(t) ||
      rec.developer.toLowerCase().includes(t)
    ) {
      return true;
    }
  }
  return false;
}

/** '내 배정' 필터 — 어느 서비스든 운영/개발이 본인(myName 정확 일치)인 행 (빈 이름 → false) */
export function isMyAssignment(row: ListRow, myName: string): boolean {
  const n = myName.trim();
  if (n === "") return false;
  const bs = row.assignment?.byService ?? {};
  return Object.values(bs).some(
    (rec) => rec.operator === n || rec.developer === n,
  );
}
