"use client";
import { useState } from "react";
import type {
  ChecklistRound,
  ChecklistItem,
  ItemStatus,
} from "@/features/checklist/schemas";
import {
  DEPARTMENTS,
  deptLabel,
  type Department,
} from "@/features/checklist/schemas";
import { computeCompletion } from "@/features/checklist/completion";
import { STATUS_LABEL } from "./status-ui";

const BADGE_BASE = "border px-2 py-1 text-xs transition-colors";
const BADGE_ON = "border-vermilion bg-vermilion text-cream";
const BADGE_OFF =
  "border-line bg-paper text-ink hover:border-vermilion hover:bg-vermilion hover:text-cream";

// 확인 뷰 상태 뱃지: 완료=검정, 나머지=빨강.
function statusBadge(status: ItemStatus): string {
  return status === "done"
    ? "border-ink bg-ink text-cream"
    : "border-vermilion bg-vermilion text-cream";
}

/** 임원 보고/공유 뷰 — report 토큰 링크(읽기 전용). 부서 필터 + 요약 KPI + 부서→분야→항목·상태·메모. */
export function ReportView({
  round,
  items,
}: {
  round: ChecklistRound;
  items: ChecklistItem[];
}) {
  const [activeDept, setActiveDept] = useState<Department | null>(null);
  const depts = DEPARTMENTS.filter((d) =>
    items.some((i) => i.department === d),
  );
  const shownItems = activeDept
    ? items.filter((i) => i.department === activeDept)
    : items;
  const all = computeCompletion(shownItems);
  const kpis: [string, number][] = [
    ["전체 항목", all.total],
    ["완료", all.done],
    ["진행중", all.inProgress],
    ["작업전", all.todo],
  ];
  const shownDepts = depts.filter(
    (d) => activeDept === null || d === activeDept,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="border-b-2 border-vermilion pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          어플라이본부 원서접수 점검 진행 상황
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{round.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"}
        </p>
      </header>

      {depts.length > 1 ? (
        <div className="mt-3 flex flex-wrap justify-end gap-1">
          <button
            type="button"
            onClick={() => setActiveDept(null)}
            className={`${BADGE_BASE} ${activeDept === null ? BADGE_ON : BADGE_OFF}`}
          >
            전체
          </button>
          {depts.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDept(d)}
              className={`${BADGE_BASE} ${activeDept === d ? BADGE_ON : BADGE_OFF}`}
            >
              {deptLabel(d)}
            </button>
          ))}
        </div>
      ) : null}

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

      {shownDepts.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        if (deptItems.length === 0) return null;
        const c = computeCompletion(deptItems);
        const cats = Array.from(new Set(deptItems.map((i) => i.category)));
        return (
          <section key={dept} className="mt-6">
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
              <h2 className="text-base font-bold text-ink">
                {deptLabel(dept)}
              </h2>
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
                            <div
                              className="mt-0.5 whitespace-pre-wrap text-xs text-muted [&_img]:my-1 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-line-soft"
                              dangerouslySetInnerHTML={{ __html: i.note }}
                            />
                          ) : null}
                          {i.attachments.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {i.attachments.map((url) => (
                                <a
                                  key={url}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={url}
                                    alt="첨부 이미지"
                                    className="h-16 w-16 rounded border border-line-soft object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {i.status ? (
                          <span
                            className={`flex-none border px-2 py-0.5 text-xs ${statusBadge(i.status)}`}
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
