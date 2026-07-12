"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Priority = NonNullable<ListRow["priority"]>;

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-vermilion text-cream",
  medium: "bg-line-soft text-ink",
  low: "bg-washi-raised text-muted",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function todayKstKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function fmtYmd(ymd?: string | null): string {
  if (!ymd) return "-";
  if (ymd === todayKstKey()) return "오늘";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${ymd}T00:00:00+09:00`));
}

export function ProjectTaskTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">우선순위</th>
          <th className="px-3 py-2">하위 업무</th>
          <th className="px-3 py-2">담당</th>
          <th className="px-3 py-2">시작</th>
          <th className="px-3 py-2">마감</th>
          <th className="px-3 py-2">진행률</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const progress = row.progress ?? 0;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2">
                  {row.priority && (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs ${PRIORITY_COLOR[row.priority]}`}
                    >
                      {PRIORITY_LABEL[row.priority]}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {fmtYmd(row.startDateYmd)}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {fmtYmd(row.endDateYmd)}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 border border-line bg-cream">
                      <div
                        className="h-full bg-indigo"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-ink-soft tabular-nums">{progress}%</span>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
