"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { TodoRow } from "@/features/todos/schemas";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import {
  getKstWeekDays,
  bucketTodosByDay,
} from "./_helpers/week-grid";

type PersistResult = { ok: boolean; error?: string };

type Props = {
  todos: TodoRow[];
  weekStartYmd: string;
  canWrite: boolean;
  onPersist: (row: ListRow, isNew: boolean) => Promise<PersistResult>;
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

function todoToListRow(t: TodoRow): ListRow {
  return {
    id: t.id,
    name: t.title,
    body: t.body ?? undefined,
    status: "active",
    owner: "",
    priority: t.priority,
    done: t.done,
    doneAt: t.done_at ?? null,
    dueAt: t.due_at ?? null,
    category: t.category ?? undefined,
    progress: t.progress ?? 0,
    todoStatus: t.status ?? "todo",
  };
}

export function WeeklyView({
  todos,
  weekStartYmd,
  canWrite,
  onPersist,
}: Props) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const days = useMemo(() => getKstWeekDays(weekStartYmd), [weekStartYmd]);
  const buckets = useMemo(() => bucketTodosByDay(todos, days), [todos, days]);
  const weekEndYmd = days[6] ?? weekStartYmd;

  const handlePrev = () => {
    const d = new Date(`${weekStartYmd}T12:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() - 7);
    const next = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(d);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("week", next);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const handleNext = () => {
    const d = new Date(`${weekStartYmd}T12:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + 7);
    const next = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(d);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("week", next);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const handleToday = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("week");
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const rows: ListRow[] = todos.map(todoToListRow);

  return (
    <section className="space-y-5 p-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="이전 주"
            className="cursor-pointer border border-line bg-transparent px-2 py-1 text-sm text-ink hover:border-vermilion hover:text-vermilion"
          >
            ‹
          </button>
          <span className="text-base font-bold tracking-[-0.02em] text-ink">
            {weekStartYmd} ~ {weekEndYmd}
          </span>
          <button
            type="button"
            onClick={handleNext}
            aria-label="다음 주"
            className="cursor-pointer border border-line bg-transparent px-2 py-1 text-sm text-ink hover:border-vermilion hover:text-vermilion"
          >
            ›
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:border-vermilion hover:text-vermilion"
          >
            오늘 주
          </button>
        </div>
      </header>

      <div
        className={
          "transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] " +
          (inspectorOpen ? "md:pr-[340px]" : "")
        }
      >
        <div className="grid grid-cols-7 gap-px border border-line bg-line-soft">
        {WEEKDAY_LABELS.map((wd) => (
          <div
            key={wd}
            className="bg-cream py-2 text-center text-xs font-bold text-ink"
          >
            {wd}
          </div>
        ))}
        {days.map((d) => {
          const items = buckets[d] ?? [];
          const dayNum = Number(d.slice(8, 10));
          return (
            <div
              key={d}
              data-testid={`weekly-cell-${d}`}
              className="min-h-[120px] bg-cream p-1.5 text-2xs text-ink"
            >
              <div className="mb-1 text-xs font-medium">{dayNum}</div>
              <ul className="space-y-0.5">
                {items.map((t) => (
                  <li
                    key={t.id}
                    className={`truncate text-2xs ${
                      t.done ? "text-muted line-through" : "text-ink"
                    }`}
                    title={t.title}
                  >
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      </div>

      <ListPattern
        title="원서접수"
        data={{ rows }}
        variant="weekly-todo"
        canCreate={canWrite}
        onInspectorChange={setInspectorOpen}
        createLabel="+ 새 할 일"
        readOnly={!canWrite}
        onPersist={onPersist}
      />
    </section>
  );
}
