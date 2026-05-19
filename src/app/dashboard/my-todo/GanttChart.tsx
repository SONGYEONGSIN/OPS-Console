"use client";

import { useMemo } from "react";
import {
  computeGanttRange,
  enumerateDays,
} from "./_helpers/gantt-layout";

type Priority = "low" | "medium" | "high";

type GanttItem = {
  id: string;
  name: string;
  startYmd: string | null;
  endYmd: string | null;
  priority: Priority;
  progress: number;
  isParent: boolean;
};

type Props = {
  items: GanttItem[];
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const FILL_PARENT = "bg-indigo";
const FILL_TASK = "bg-sage";

const NAME_COL_PX = 200;
const DAY_COL_MIN_PX = 28;

function weekdayLabel(ymd: string): { label: string; tone: string } {
  const d = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return {
    label: WEEKDAYS[d]!,
    tone:
      d === 0
        ? "text-vermilion"
        : d === 6
          ? "text-indigo"
          : "text-ink-soft",
  };
}

function groupDaysByMonth(days: string[]): { ym: string; span: number }[] {
  const groups: { ym: string; span: number }[] = [];
  for (const d of days) {
    const ym = d.slice(0, 7);
    const last = groups.at(-1);
    if (last && last.ym === ym) last.span += 1;
    else groups.push({ ym, span: 1 });
  }
  return groups;
}

function fillColor(isParent: boolean): string {
  return isParent ? FILL_PARENT : FILL_TASK;
}

export function GanttChart({ items }: Props) {
  const range = useMemo(() => computeGanttRange(items), [items]);
  const days = useMemo(
    () => (range ? enumerateDays(range.fromYmd, range.toYmd) : []),
    [range],
  );
  const monthGroups = useMemo(() => groupDaysByMonth(days), [days]);
  const monthGroupsWithCol = useMemo(() => {
    return monthGroups.reduce<{ ym: string; span: number; start: number }[]>(
      (acc, g) => {
        const start = acc.at(-1)
          ? acc.at(-1)!.start + acc.at(-1)!.span
          : 2;
        return [...acc, { ...g, start }];
      },
      [],
    );
  }, [monthGroups]);

  if (!range || days.length === 0) {
    return (
      <div className="border border-line-soft bg-cream p-6 text-center text-xs text-muted">
        프로젝트 또는 일정이 없습니다. 일정을 추가하면 Gantt 차트가 표시됩니다.
      </div>
    );
  }

  const gridCols = `${NAME_COL_PX}px repeat(${days.length}, minmax(${DAY_COL_MIN_PX}px, 1fr))`;

  return (
    <div className="space-y-2">
      <header className="flex items-center justify-between border-b-2 border-ink pb-2">
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">
          Gantt · 타임라인
        </h4>
        <span className="font-mono text-xs text-muted">
          {range.fromYmd} ~ {range.toYmd}
        </span>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* 헤더 — 단일 grid (라벨 cell rowspan 2 + 월/일자 헤더 explicit row+col 배치) */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: gridCols,
              gridTemplateRows: "auto auto",
            }}
          >
            <div
              style={{ gridRow: "1 / span 2", gridColumn: 1 }}
              className="border-t border-l border-r border-b border-line bg-washi-raised flex items-center justify-center text-xs font-bold text-ink"
            >
              프로젝트 / 업무
            </div>
            {monthGroupsWithCol.map((g) => (
              <div
                key={g.ym}
                style={{
                  gridRow: 1,
                  gridColumn: `${g.start} / span ${g.span}`,
                }}
                className="border-t border-r border-b border-line bg-washi-raised py-1 text-center text-2xs font-bold text-ink"
              >
                {g.ym}
              </div>
            ))}
            {days.map((d, i) => {
              const wd = weekdayLabel(d);
              const dayNum = Number(d.slice(8, 10));
              return (
                <div
                  key={d}
                  style={{ gridRow: 2, gridColumn: i + 2 }}
                  className="border-r border-b border-line bg-cream py-0.5 text-center text-2xs"
                >
                  <div className="text-ink">{dayNum}</div>
                  <div className={wd.tone}>{wd.label}</div>
                </div>
              );
            })}
          </div>

          {/* 아이템 row */}
          {items.map((item) => {
            const startIdx = item.startYmd ? days.indexOf(item.startYmd) : -1;
            const endIdx = item.endYmd ? days.indexOf(item.endYmd) : -1;
            const inRange = startIdx >= 0 && endIdx >= 0 && endIdx >= startIdx;

            return (
              <div
                key={item.id}
                className="grid"
                style={{ gridTemplateColumns: gridCols }}
              >
                <div
                  className={`border-l border-r border-b border-line bg-cream px-2 py-1 text-xs ${
                    item.isParent
                      ? "font-bold text-ink"
                      : "pl-4 text-ink-soft"
                  }`}
                  title={item.name}
                >
                  <span className="block truncate">{item.name}</span>
                </div>
                {days.map((d, i) => {
                  const isInRange = inRange && i >= startIdx && i <= endIdx;
                  return (
                    <div
                      key={d}
                      className="border-r border-b border-line bg-cream p-0.5 min-h-[28px]"
                    >
                      {isInRange ? (
                        <div
                          data-testid="gantt-bar"
                          className={`h-full w-full ${fillColor(item.isParent)}`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
