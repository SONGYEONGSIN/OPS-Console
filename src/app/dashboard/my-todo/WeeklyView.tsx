"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { TodoRow } from "@/features/todos/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import {
  getKstWeekDays,
  bucketTodosByDay,
  bucketServicesByDay,
} from "./_helpers/week-grid";
import { todoToListRow } from "./_row-mapper";

type PersistResult = { ok: boolean; error?: string };

const DRAG_MIME = "application/x-folio-service";

type DragPayload = {
  serviceName: string;
  ymd: string;
  kind: "start" | "end";
};

type Props = {
  todos: TodoRow[];
  /** 2주 grid 범위에 걸치는 services (write_start/end). 운영부 달력과 동일 패턴 */
  services: ServicesRow[];
  weekStartYmd: string;
  canWrite: boolean;
  /** KST 기준 오늘 YYYY-MM-DD — 해당 셀 시각 강조 (운영부 달력과 동일) */
  todayYmd: string;
  onPersist: (row: ListRow, isNew: boolean) => Promise<PersistResult>;
};

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 셀 1개당 기본 표시 최대 항목 수 (todos + services 합산). 운영부 달력과 동일 */
const MAX_VISIBLE_ITEMS = 4;

export function WeeklyView({
  todos,
  services,
  weekStartYmd,
  canWrite,
  todayYmd,
  onPersist,
}: Props) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const days = useMemo(() => getKstWeekDays(weekStartYmd), [weekStartYmd]);
  const buckets = useMemo(() => bucketTodosByDay(todos, days), [todos, days]);
  const svcBuckets = useMemo(
    () => bucketServicesByDay(services, days),
    [services, days],
  );
  const weekEndYmd = days[days.length - 1] ?? weekStartYmd;
  const [dragHover, setDragHover] = useState(false);
  /** 셀별 더보기 펼친 상태 — 한 번에 1셀만 expand (운영부 달력 동일) */
  const [expandedYmd, setExpandedYmd] = useState<string | null>(null);

  const handleDragStart =
    (payload: DragPayload) => (e: React.DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    };

  const handleDropZoneOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragHover(true);
  };
  const handleDropZoneLeave = () => setDragHover(false);
  const handleDropZoneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragHover(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      const due = new Date(`${payload.ymd}T00:00:00+09:00`).toISOString();
      const label = payload.kind === "start" ? "접수 시작" : "접수 종료";
      const newRow: ListRow = {
        id: "",
        name: `${payload.serviceName} · ${label}`,
        status: "active",
        owner: "",
        priority: "medium",
        done: false,
        dueAt: due,
        category: payload.serviceName,
        progress: 0,
        todoStatus: "todo",
      };
      await onPersist(newRow, true);
    } catch {
      // ignore malformed payload
    }
  };

  const handlePrev = () => {
    const d = new Date(`${weekStartYmd}T12:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() - 14);
    const next = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
    }).format(d);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("week", next);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const handleNext = () => {
    const d = new Date(`${weekStartYmd}T12:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + 14);
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
  const mineOn = searchParams.get("mine") === "true";
  const handleToggleMine = () => {
    const sp = new URLSearchParams(searchParams.toString());
    if (mineOn) sp.delete("mine");
    else sp.set("mine", "true");
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
          <button
            type="button"
            onClick={handleToggleMine}
            aria-pressed={mineOn}
            className={`cursor-pointer border px-3 py-1 text-xs ${
              mineOn
                ? "border-vermilion bg-vermilion text-cream"
                : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
            }`}
          >
            내 업무
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
            const svcs = svcBuckets[d] ?? [];
            const dayNum = Number(d.slice(8, 10));
            const isToday = d === todayYmd;
            const totalCount = items.length + svcs.length;
            const isExpanded = expandedYmd === d;
            // 통합 budget — todos 우선, 남는 자리만 svcs.
            const todoBudget = isExpanded
              ? items.length
              : Math.min(items.length, MAX_VISIBLE_ITEMS);
            const svcBudget = isExpanded
              ? svcs.length
              : Math.max(0, MAX_VISIBLE_ITEMS - todoBudget);
            const visibleItems = items.slice(0, todoBudget);
            const visibleSvcs = svcs.slice(0, svcBudget);
            const overflow =
              totalCount - (visibleItems.length + visibleSvcs.length);
            return (
              <div
                key={d}
                data-testid={`weekly-cell-${d}`}
                data-today={isToday ? "true" : "false"}
                className={`min-h-[120px] bg-cream p-1.5 text-2xs text-ink ${
                  isToday ? "ring-1 ring-inset ring-vermilion" : ""
                }`}
              >
                <div className="mb-1">
                  <span
                    className={`inline-block min-w-[1.25rem] px-1 text-xs font-medium ${
                      isToday ? "bg-vermilion text-cream" : ""
                    }`}
                  >
                    {dayNum}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {visibleItems.map((t) => (
                    <li
                      key={t.id}
                      data-testid={`weekly-todo-${t.id}`}
                      className={`flex items-center gap-1 truncate text-2xs ${
                        t.done ? "text-muted line-through" : "text-ink"
                      }`}
                      title={t.title}
                    >
                      <span
                        aria-hidden
                        data-testid="weekly-todo-star"
                        className="shrink-0 animate-star-twinkle text-vermilion"
                      >
                        ★
                      </span>
                      <span className="truncate">{t.title}</span>
                    </li>
                  ))}
                  {visibleSvcs.map((sb, idx) => (
                    <li
                      key={`${sb.service.id}-${sb.kind}-${idx}`}
                      draggable
                      onDragStart={handleDragStart({
                        serviceName: sb.service.service_name,
                        ymd: d,
                        kind: sb.kind,
                      })}
                      data-testid={`weekly-service-${sb.kind}-${sb.service.id}`}
                      className="flex cursor-grab items-center gap-1 truncate text-2xs text-ink-soft active:cursor-grabbing"
                      title={`${sb.service.university_name} — ${sb.service.service_name} · ${sb.kind === "start" ? "접수 시작" : "접수 종료"} (드래그하여 할 일에 담기)`}
                    >
                      <span
                        data-testid="weekly-service-dot"
                        data-kind={sb.kind}
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                          sb.kind === "start" ? "bg-sage" : "bg-indigo"
                        }`}
                        aria-hidden
                      />
                      <span className="truncate">
                        {sb.service.university_name} — {sb.service.service_name}
                      </span>
                    </li>
                  ))}
                  {overflow > 0 ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setExpandedYmd(d)}
                        className="cursor-pointer border-none bg-transparent p-0 text-2xs text-muted hover:text-vermilion"
                      >
                        +{overflow} 더보기
                      </button>
                    </li>
                  ) : null}
                  {isExpanded && totalCount > MAX_VISIBLE_ITEMS ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => setExpandedYmd(null)}
                        className="cursor-pointer border-none bg-transparent p-0 text-2xs text-muted hover:text-vermilion"
                      >
                        접기
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-bold text-ink">
          ※ 원서접수 목록을 드래그&드롭으로 새 할 일을 추가할 수 있습니다.
        </p>
      </div>

      <div
        data-testid="weekly-drop-zone"
        onDragOver={handleDropZoneOver}
        onDragLeave={handleDropZoneLeave}
        onDrop={handleDropZoneDrop}
        className={`transition-colors ${
          dragHover ? "bg-vermilion/10 ring-2 ring-inset ring-vermilion" : ""
        }`}
      >
        <ListPattern
          title="주요업무"
          data={{ rows }}
          variant="weekly-todo"
          canCreate={canWrite}
          onInspectorChange={setInspectorOpen}
          createLabel="+ 새 할 일"
          readOnly={!canWrite}
          onPersist={onPersist}
        />
      </div>
    </section>
  );
}
