import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";
import { ASSIGNMENT_BADGE_TONE } from "./status";

type ServiceRec = NonNullable<ListRow["assignment"]>["byService"][string];
type Cell = NonNullable<ServiceRec["cells"]>[number];

/**
 * 하위유형으로 묶는다 — **라벨은 묶음마다 한 번**이다. 칸마다 적으면 운영·개발
 * 짝에서 같은 라벨이 두 줄로 겹쳐 보인다. 칸 순서는 매퍼가 이미 정렬했으므로
 * (`sortCells`) 들어온 순서를 그대로 쓴다.
 */
function groupBySubtype(cells: readonly Cell[]) {
  const out = new Map<string, Cell[]>();
  for (const c of cells) {
    out.set(c.subtype, [...(out.get(c.subtype) ?? []), c]);
  }
  return [...out];
}

/**
 * 원장 칸 목록. **접지 않는다** — 자연키 하나가 한 줄이다.
 *
 * `연결 안 됨` 은 **운영 칸에만** 붙는다. 개발 칸은 언제나 메일이 없어서
 * (`operators` 가 운영부 표다) 거기에 붙이면 늘 뜨는 경고가 되고, 늘 뜨는 경고는
 * 고칠 수 있는 운영 칸을 덮는다(#1195).
 */
function CellList({ cells }: { cells: readonly Cell[] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {groupBySubtype(cells).map(([subtype, group]) => (
        <li key={subtype} className="flex items-baseline gap-2">
          {subtype !== "" && (
            <span className="w-10 shrink-0 text-xs text-muted">{subtype}</span>
          )}
          <div className="flex flex-col gap-0.5">
            {group.map((c, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-7 shrink-0 text-xs text-muted">
                  {c.role}
                </span>
                <span className="text-ink">{c.name || "—"}</span>
                {c.role === "운영" &&
                  (c.email ? (
                    <span className="font-mono text-xs text-muted">
                      {c.email}
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 text-2xs ${ASSIGNMENT_BADGE_TONE["연결 안 됨"]}`}
                    >
                      연결 안 됨
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AssignmentsView({ row }: { row: ListRow }) {
  const bs = row.assignment?.byService ?? {};
  const cells = Object.values(bs).flatMap((r) => r.cells ?? []);
  const hasDeveloperCell = cells.some((c) => c.role === "개발");

  return (
    <div className="flex flex-col gap-5 p-5">
      <header>
        <h2 className="text-lg font-medium text-ink">{row.name}</h2>
        {row.assignment && (
          <p className="text-xs text-muted tabular-nums">
            {row.assignment.academicYear}학년도
          </p>
        )}
      </header>
      {SERVICE_KINDS.map((s) => {
        const rec = bs[s];
        if (!rec) return null;
        return (
          <section key={s} className="border-b border-line-soft pb-3">
            <h3 className="mb-1 text-sm font-medium text-vermilion">{s}</h3>
            {rec.cells && rec.cells.length > 0 ? (
              <CellList cells={rec.cells} />
            ) : (
              // 시트를 읽던 경로. `_row-mapper` 와 함께 A10 에서 사라진다(임시).
              <p className="text-sm text-ink">
                운영 {rec.operator || "—"}
                {rec.developer ? ` · 개발 ${rec.developer}` : ""}
              </p>
            )}
            {rec.detail.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                {rec.detail.map((d, i) => (
                  <div key={i} className="contents">
                    <dt>{d.label}</dt>
                    <dd className="text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
      {hasDeveloperCell && (
        <p className="text-xs text-muted">
          개발 칸은 이름만 둔다 — 개발자는 운영부 명부에 없어 메일이 붙지
          않는다.
        </p>
      )}
    </div>
  );
}
