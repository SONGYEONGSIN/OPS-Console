import type { ViewProps } from "../types";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "in_progress" | "done" | "blocked";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const STATUS_LABEL: Record<Status, string> = {
  todo: "시작전",
  in_progress: "진행중",
  done: "완료",
  blocked: "보류",
};

export function ProjectView({ row }: ViewProps) {
  const progress = row.progress ?? 0;
  const total = row.totalTaskCount ?? 0;
  const done = row.doneTaskCount ?? 0;
  const status = (row.todoStatus ?? "todo") as Status;

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {row.priority ? (
            <span className="text-xs">
              <span className="text-muted">우선순위</span>{" "}
              <span className="text-ink">
                {PRIORITY_LABEL[row.priority as Priority]}
              </span>
            </span>
          ) : null}
          <span className="text-xs">
            <span className="text-muted">상태</span>{" "}
            <span className="text-ink">{STATUS_LABEL[status]}</span>
          </span>
          <span className="text-xs">
            <span className="text-muted">담당</span>{" "}
            <span className="text-ink">{row.owner || "-"}</span>
          </span>
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">기간</p>
        <p className="text-xs font-mono text-ink-soft">
          {row.startDateYmd ?? "—"} ~ {row.endDateYmd ?? "—"}
        </p>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">진행률</p>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 border border-line bg-cream">
            <div
              className="h-full bg-sage"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink">{progress}%</span>
        </div>
        <p className="text-2xs text-muted">
          sub-task {done} / {total} 완료
        </p>
      </section>

      {row.description ? (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">설명</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.description}
          </p>
        </section>
      ) : null}
    </div>
  );
}
