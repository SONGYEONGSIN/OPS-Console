import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

export function AssignmentsView({ row }: { row: ListRow }) {
  const bs = row.assignment?.byService ?? {};
  return (
    <div className="flex flex-col gap-5 p-5">
      <h2 className="text-lg font-medium text-ink">{row.name}</h2>
      {SERVICE_KINDS.map((s) => {
        const rec = bs[s];
        if (!rec) return null;
        return (
          <section key={s} className="border-b border-line-soft pb-3">
            <h3 className="mb-1 text-sm font-medium text-vermilion">{s}</h3>
            <p className="text-sm text-ink">
              운영 {rec.operator || "—"}
              {rec.developer ? ` · 개발 ${rec.developer}` : ""}
            </p>
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
    </div>
  );
}
