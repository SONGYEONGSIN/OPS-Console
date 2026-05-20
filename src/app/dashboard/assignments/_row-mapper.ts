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
