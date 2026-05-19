import { Section, DefList, Divider } from "../shared";
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

function fmtYmd(ymd?: string | null): string {
  if (!ymd) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${ymd}T00:00:00+09:00`));
}

export function ProjectView({ row }: ViewProps) {
  const priority = row.priority as Priority | undefined;
  const status = (row.todoStatus ?? "todo") as Status;
  const progress = row.progress ?? 0;
  const total = row.totalTaskCount ?? 0;
  const done = row.doneTaskCount ?? 0;

  return (
    <div className="space-y-6">
      <Section title="프로젝트">
        <DefList
          items={[
            { term: "제목", desc: row.name || "-" },
            {
              term: "우선순위",
              desc: priority ? (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${PRIORITY_COLOR[priority]}`}
                >
                  {PRIORITY_LABEL[priority]}
                </span>
              ) : (
                "-"
              ),
            },
            {
              term: "상태",
              desc: (
                <span className="inline-block border border-line bg-transparent px-2 py-0.5 text-xs text-ink">
                  {STATUS_LABEL[status]}
                </span>
              ),
            },
            { term: "담당", desc: row.owner || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="일정">
        <DefList
          items={[
            { term: "시작", desc: <span>{fmtYmd(row.startDateYmd)}</span> },
            { term: "마감", desc: <span>{fmtYmd(row.endDateYmd)}</span> },
          ]}
        />
      </Section>

      <Divider />

      <Section title="진행률">
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 border border-line bg-cream">
            <div
              className="h-full bg-sage"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink">{progress}%</span>
        </div>
        <p className="mt-1.5 text-2xs text-muted">
          sub-task {done} / {total} 완료
        </p>
      </Section>

      {row.description ? (
        <>
          <Divider />
          <Section title="설명">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.description}
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
