"use client";

import { useMemo } from "react";
import {
  computeGanttRange,
  computeBarPosition,
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

const PRIORITY_BAR: Record<Priority, string> = {
  high: "bg-vermilion",
  medium: "bg-line-soft",
  low: "bg-sage",
};

const PARENT_BAR = "bg-indigo";

export function GanttChart({ items }: Props) {
  const range = useMemo(() => computeGanttRange(items), [items]);

  if (!range || items.length === 0) {
    return (
      <div className="border border-line-soft bg-cream p-6 text-center text-xs text-muted">
        프로젝트 또는 일정이 없습니다. 일정을 추가하면 Gantt 차트가 표시됩니다.
      </div>
    );
  }

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
      <ul className="space-y-1">
        {items.map((item) => {
          const pos = computeBarPosition({
            startYmd: item.startYmd,
            endYmd: item.endYmd,
            fromYmd: range.fromYmd,
            toYmd: range.toYmd,
          });
          const color = item.isParent ? PARENT_BAR : PRIORITY_BAR[item.priority];
          return (
            <li
              key={item.id}
              className="grid grid-cols-[200px_1fr] items-center gap-3"
            >
              <span
                className={`truncate text-xs ${
                  item.isParent ? "font-bold text-ink" : "pl-3 text-ink-soft"
                }`}
                title={item.name}
              >
                {item.name}
              </span>
              <div className="relative h-5 border border-line bg-cream">
                <div
                  data-testid="gantt-bar"
                  className={`absolute top-0 bottom-0 ${color}`}
                  style={{
                    left: `${pos.leftPct}%`,
                    width: `${pos.widthPct}%`,
                  }}
                >
                  <div
                    className="h-full bg-ink/20"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
