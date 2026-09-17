import type { ListRow } from "../_components/patterns/ListPattern";
import type { LedgerRow } from "@/features/assignments/import";
import { badgesOf } from "@/features/assignments/badges";
import { ASSIGNMENT_SUBTYPE_ORDER } from "@/features/assignments/ledger-schemas";

/**
 * 배정 원장 행 → 목록 행. **시트 타입(`AssignmentRecord`)을 거치지 않는다**(PR4).
 *
 * 거쳐 가면 파서의 대표값 규칙을 화면 쪽에서 되만들어야 하고, 그게 두 번째 진실
 * 공급원이다 — PIMS 접힘(#1193)이 그 실수였다. 그래서 `cells` 를 자연키 단위로
 * 그대로 들고, 표시용 대표값·하위유형은 거기서 파생시킨다.
 */

type ServiceRec = NonNullable<ListRow["assignment"]>["byService"][string];
type Cell = NonNullable<ServiceRec["cells"]>[number];

const orderOf = (subtype: string) => {
  const i = ASSIGNMENT_SUBTYPE_ORDER.indexOf(
    subtype as (typeof ASSIGNMENT_SUBTYPE_ORDER)[number],
  );
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

/** 시트 순서 → 모르는 것은 뒤에 가나다순. 같은 하위유형이면 운영이 먼저다. */
function sortCells(cells: Cell[]): Cell[] {
  return [...cells].sort((a, b) => {
    const oa = orderOf(a.subtype);
    const ob = orderOf(b.subtype);
    if (oa !== ob) return oa - ob;
    if (a.subtype !== b.subtype)
      return a.subtype.localeCompare(b.subtype, "ko");
    if (a.role !== b.role) return a.role === "운영" ? -1 : 1;
    return 0;
  });
}

/**
 * 하위유형 항목은 **빈 subtype 을 뺀 칸들**에서 만든다. 빈 subtype 은 하위유형이
 * 없는 업무(대학원·성적산출·상담앱)라 항목이 될 것이 없다.
 */
function subtypesOf(cells: Cell[]) {
  const byLabel = new Map<string, { operator: string; developer: string }>();
  for (const c of cells) {
    if (c.subtype === "") continue;
    const cur = byLabel.get(c.subtype) ?? { operator: "", developer: "" };
    if (c.role === "운영") cur.operator = c.name;
    else cur.developer = c.name;
    byLabel.set(c.subtype, cur);
  }
  return [...byLabel].map(([label, v]) => ({ label, ...v }));
}

/**
 * 표시용 대표값은 **빈 subtype 칸에서만** 온다.
 *
 * 하위유형이 있는 업무에서 하나를 골라 대표로 삼지 않는다 — 그게 접힘이다.
 * 하위유형이 있는 칸은 `Table` 이 줄로 그리므로 대표값이 필요 없고, 검색은
 * `matchesAssignmentQuery` 가 하위유형까지 훑는다.
 */
function plainOf(cells: Cell[]) {
  const pick = (role: Cell["role"]) =>
    cells.find((c) => c.subtype === "" && c.role === role)?.name ?? "";
  return { operator: pick("운영"), developer: pick("개발") };
}

const cellsOf = (row: ListRow): Cell[] =>
  Object.values(row.assignment?.byService ?? {}).flatMap((r) => r.cells ?? []);

/**
 * `내 배정` 필터. **단위는 이메일이다.**
 *
 * PR3 까지는 `me.displayName` 과 시트 이름을 문자열 비교했다. 오늘 실측으로는 새지
 * 않지만(활성 운영자 중 겹치는 이름 0), 원장에 이미 이메일이 있는데 덜 정확한 키를
 * 쓸 이유가 없다 — 같은 이름이 하나 생기는 날 조용히 남의 배정이 뜬다.
 *
 * 이메일이 없는 칸은 **누구의 것도 아니다.** null 을 빈 문자열로 접어 비교하면
 * 미매칭 890칸이 통째로 한 사람 것이 된다.
 */
export function isMyLedgerAssignment(row: ListRow, myEmail: string): boolean {
  const me = myEmail.trim().toLowerCase();
  if (me === "") return false;
  return cellsOf(row).some((c) => (c.email ?? "").toLowerCase() === me);
}

/**
 * 대학명 + 담당자 이름 양방향 검색. 빈 검색어는 모두 통과다.
 *
 * 이름으로 찾는 것은 그대로 둔다 — 사람은 이메일을 외워서 검색하지 않고, 이메일을
 * 못 맞춘 칸도 이름은 남아 있어 그 이름으로 찾혀야 한다(설계 F2).
 */
export function matchesLedgerQuery(row: ListRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t === "") return true;
  if (row.name.toLowerCase().includes(t)) return true;
  return cellsOf(row).some((c) => c.name.toLowerCase().includes(t));
}

export function ledgerRowsToListRows(rows: readonly LedgerRow[]): ListRow[] {
  const byUniv = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const list = byUniv.get(r.university_name) ?? [];
    list.push(r);
    byUniv.set(r.university_name, list);
  }

  const out: ListRow[] = [];
  for (const [university, univRows] of byUniv) {
    const byService: NonNullable<ListRow["assignment"]>["byService"] = {};
    const byKind = new Map<string, Cell[]>();
    for (const r of univRows) {
      const list = byKind.get(r.work_kind) ?? [];
      list.push({
        subtype: r.subtype,
        role: r.role,
        name: r.assignee_name,
        email: r.assignee_email,
      });
      byKind.set(r.work_kind, list);
    }

    for (const [kind, cells] of byKind) {
      const sorted = sortCells(cells);
      byService[kind] = {
        ...plainOf(sorted),
        detail: [],
        subtypes: subtypesOf(sorted),
        cells: sorted,
      };
    }

    out.push({
      id: university,
      name: university,
      status: "active",
      owner: "",
      universityType: univRows.find((r) => r.university_type)?.university_type,
      assignment: {
        academicYear: univRows[0].academic_year,
        byService,
        // 대학 단위 판정 — 설계 §3.1 의 '여러 운영자로 갈린 대학 44곳'이 그 단위이고
        // PR6 게이트 G4 도 대학 단위로 분할을 뺀다.
        badges: badgesOf(
          univRows.map((r) => ({
            role: r.role,
            assignee_email: r.assignee_email,
            assignee_name: r.assignee_name,
          })),
        ),
      },
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
