"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type TodoPriority = NonNullable<ListRow["priority"]>;

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
  onToggleDone: (row: ListRow, nextDone: boolean) => Promise<void>;
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "bg-vermilion text-cream",
  medium: "bg-line-soft text-ink",
  low: "bg-washi-raised text-muted",
};

function todayKstKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function kstDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

function formatDueAt(iso?: string | null): string {
  if (!iso) return "-";
  const today = todayKstKey();
  const target = kstDateKey(iso);
  if (target === today) return "오늘";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

export function WeeklyTodoTable({
  rows,
  selectedId,
  onSelect,
  onToggleDone,
}: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">우선순위</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">마감</th>
          <th className="px-3 py-2">진행률</th>
          <th className="px-3 py-2">완료</th>
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
                  selectedId === row.id ? "bg-washi-raised" : ""
                } ${row.done ? "opacity-60 [&_td]:line-through" : ""} ${
                  row.autoDismissed ? "opacity-60" : ""
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
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.category ?? "-"}
                </td>
                <td className="px-3 py-2 font-medium text-ink">
                  <span className={row.autoDismissed ? "line-through" : ""}>
                    {row.name}
                  </span>
                  {row.autoDismissed && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 align-middle text-[10px] no-underline bg-washi-raised text-muted">
                      삭제됨
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatDueAt(row.dueAt)}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 border border-line bg-cream">
                      <div
                        className="h-full bg-vermilion"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-ink-soft tabular-nums">
                      {progress}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`${row.name} 완료 토글`}
                    checked={row.done ?? false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleDone(row, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-vermilion"
                  />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
