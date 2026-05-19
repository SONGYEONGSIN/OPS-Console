import type { ViewProps } from "../types";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "in_progress" | "done" | "blocked";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-vermilion text-cream",
  medium: "bg-line-soft text-ink",
  low: "bg-washi-raised text-muted",
};

const STATUS_LABEL: Record<Status, string> = {
  todo: "시작전",
  in_progress: "진행중",
  done: "완료",
  blocked: "보류",
};

const KST_DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDueAt(iso?: string | null): string {
  if (!iso) return "—";
  return KST_DATE_FMT.format(new Date(iso));
}

export function WeeklyTodoView({ row }: ViewProps) {
  const priority = row.priority as Priority | undefined;
  const status = (row.todoStatus ?? "todo") as Status;
  const progress = row.progress ?? 0;

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {priority ? (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${PRIORITY_COLOR[priority]}`}
            >
              {PRIORITY_LABEL[priority]}
            </span>
          ) : null}
          <span className="inline-block border border-line bg-transparent px-2 py-0.5 text-2xs text-ink">
            {STATUS_LABEL[status]}
          </span>
          {row.done ? (
            <span className="inline-block bg-sage px-2 py-0.5 text-2xs text-cream">
              완료됨
            </span>
          ) : null}
          <span className="text-xs">
            <span className="text-muted">카테고리</span>{" "}
            <span className="text-ink">{row.category || "-"}</span>
          </span>
          <span className="text-xs">
            <span className="text-muted">마감</span>{" "}
            <span className="font-mono text-ink">{formatDueAt(row.dueAt)}</span>
          </span>
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">진행률</p>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 border border-line bg-cream">
            <div
              className="h-full bg-vermilion"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink">{progress}%</span>
        </div>
      </section>

      {row.body ? (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">설명</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.body}
          </p>
        </section>
      ) : null}
    </div>
  );
}
