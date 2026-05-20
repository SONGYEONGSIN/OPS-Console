import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

const LEVEL_COLOR: Record<Level, string> = {
  ERROR: "bg-vermilion text-cream",
  WARN: "bg-vermilion/20 text-vermilion-deep",
  INFO: "bg-line-soft text-ink",
  DEBUG: "bg-washi-raised text-muted",
};

function formatTs(iso?: string): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function WorklogView({ row }: ViewProps) {
  const level = (row.worklogLevel ?? "INFO") as Level;

  return (
    <div className="space-y-6">
      <Section title="활동">
        <DefList
          items={[
            {
              term: "레벨",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${LEVEL_COLOR[level]}`}
                >
                  {level}
                </span>
              ),
            },
            { term: "메시지", desc: row.name || "-" },
            { term: "사용자", desc: row.worklogUser || row.owner || "-" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="상세">
        <DefList
          items={[
            { term: "도메인", desc: row.worklogDomain ?? "-" },
            { term: "액션", desc: row.worklogAction ?? "-" },
            { term: "대상", desc: row.worklogTarget || "-" },
            { term: "시각", desc: <span>{formatTs(row.worklogTs)}</span> },
          ]}
        />
      </Section>
    </div>
  );
}
