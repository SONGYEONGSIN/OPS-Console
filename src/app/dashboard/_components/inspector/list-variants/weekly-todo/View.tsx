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

const KST_DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const KST_DATETIME_FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return KST_DATE_FMT.format(new Date(iso));
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  return KST_DATETIME_FMT.format(new Date(iso));
}

export function WeeklyTodoView({ row }: ViewProps) {
  const priority = row.priority as Priority | undefined;
  const status = (row.todoStatus ?? "todo") as Status;
  const progress = row.progress ?? 0;

  return (
    <div className="space-y-6">
      <Section title="할 일 기본">
        <DefList
          items={[
            { term: "제목", desc: row.name || "-" },
            {
              term: "카테고리",
              desc: row.category ? (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.category}
                </span>
              ) : (
                "-"
              ),
            },
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
            {
              term: "완료여부",
              desc: row.done ? (
                <span className="inline-block bg-sage px-2 py-0.5 text-xs text-cream">
                  완료됨
                </span>
              ) : (
                <span className="text-xs text-muted">진행 중</span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="일정">
        <DefList
          items={[
            {
              term: "마감일",
              desc: <span>{formatDate(row.dueAt)}</span>,
            },
            {
              term: "완료일",
              desc: <span>{formatDateTime(row.doneAt)}</span>,
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="진행률">
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 border border-line bg-cream">
            <div
              className="h-full bg-vermilion"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink">{progress}%</span>
        </div>
      </Section>

      {row.body ? (
        <>
          <Divider />
          <Section title="설명">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.body}
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
