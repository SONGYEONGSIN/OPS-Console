"use client";

import { MineScopeToggle } from "@/components/common/MineScopeToggle";

type Props = {
  year: number;
  /** 0-indexed month (0=1월) */
  month0: number;
  view: "calendar" | "list";
  canWrite: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (next: "calendar" | "list") => void;
  onNewEvent: () => void;
};

export function CalendarToolbar({
  year,
  month0,
  view,
  canWrite,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onNewEvent,
}: Props) {
  const monthLabel = `${year}.${String(month0 + 1).padStart(2, "0")}`;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="이전 달"
          className="cursor-pointer border border-line bg-transparent px-2 py-1 text-sm text-ink hover:border-vermilion hover:text-vermilion"
        >
          ‹
        </button>
        <span className="min-w-[5.5rem] text-center text-base font-bold tracking-[-0.02em] text-ink">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label="다음 달"
          className="cursor-pointer border border-line bg-transparent px-2 py-1 text-sm text-ink hover:border-vermilion hover:text-vermilion"
        >
          ›
        </button>
        <button
          type="button"
          onClick={onToday}
          className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:border-vermilion hover:text-vermilion"
        >
          오늘
        </button>
        <MineScopeToggle mineLabel="내 일정" allLabel="전체 일정" />
      </div>
      <div className="flex items-center gap-2">
        {canWrite ? (
          <button
            type="button"
            onClick={onNewEvent}
            className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep"
          >
            + 새 일정
          </button>
        ) : null}
        <div
          role="tablist"
          aria-label="view 토글"
          className="flex items-center border border-line"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "calendar"}
            onClick={() => onViewChange("calendar")}
            className={`cursor-pointer px-3 py-1 text-xs ${
              view === "calendar"
                ? "bg-ink text-cream"
                : "bg-transparent text-ink hover:text-vermilion"
            }`}
          >
            달력
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            onClick={() => onViewChange("list")}
            className={`cursor-pointer border-l border-line px-3 py-1 text-xs ${
              view === "list"
                ? "bg-ink text-cream"
                : "bg-transparent text-ink hover:text-vermilion"
            }`}
          >
            목록
          </button>
        </div>
      </div>
    </div>
  );
}
