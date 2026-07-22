import type { ChecklistRound, ChecklistItem } from "@/features/checklist/schemas";
import { DEPARTMENTS } from "@/features/checklist/schemas";
import { computeCompletion } from "@/features/checklist/completion";
import { STATUS_LABEL, STATUS_STYLE } from "./status-ui";

/** 임원 보고/공유 뷰 — report 토큰 링크(읽기 전용). 요약 KPI + 부서→분야→항목·상태·메모. */
export function ReportView({
  round,
  items,
}: {
  round: ChecklistRound;
  items: ChecklistItem[];
}) {
  const all = computeCompletion(items);
  const kpis: [string, number][] = [
    ["전체 항목", all.total],
    ["완료", all.done],
    ["진행중", all.inProgress],
    ["작업전", all.todo],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="border-b-2 border-vermilion pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          [운영부 상황실] · 원서접수 점검사항 체크리스트
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{round.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"}
        </p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(([label, n]) => (
          <div
            key={label}
            className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
          >
            <span className="text-xs font-medium text-muted">{label}</span>
            <span className="text-2xl font-bold text-ink">{n}</span>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>완료율 (해당없음 제외)</span>
          <span>{all.pct}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
          <span
            className="block h-full bg-sage"
            style={{ width: `${all.pct}%` }}
          />
        </div>
      </div>

      {all.total === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          아직 등록된 항목이 없습니다.
        </p>
      ) : null}

      {DEPARTMENTS.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        if (deptItems.length === 0) return null;
        const c = computeCompletion(deptItems);
        const cats = Array.from(new Set(deptItems.map((i) => i.category)));
        return (
          <section key={dept} className="mt-6">
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
              <h2 className="text-base font-bold text-ink">{dept}</h2>
              <span className="text-xs text-muted">
                {c.done}/{c.total} · {c.pct}%
              </span>
            </div>
            {cats.map((cat) => (
              <div key={cat} className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  {cat || "(분야 없음)"}
                </p>
                <div className="space-y-1">
                  {deptItems
                    .filter((i) => i.category === cat)
                    .map((i) => (
                      <div
                        key={i.id}
                        className="flex items-start justify-between gap-3 border border-line-soft bg-situation-bg p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-ink">{i.title}</div>
                          {i.note ? (
                            <div className="mt-0.5 text-xs text-muted">
                              {i.note}
                            </div>
                          ) : null}
                        </div>
                        {i.status ? (
                          <span
                            className={`flex-none border px-2 py-0.5 text-xs ${STATUS_STYLE[i.status]}`}
                          >
                            {STATUS_LABEL[i.status]}
                          </span>
                        ) : (
                          <span className="flex-none px-2 py-0.5 text-xs text-muted">
                            미지정
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
