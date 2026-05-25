import Link from "next/link";
import type { ReportRow } from "@/features/reports/schemas";
import { NewReportButton } from "./NewReportButton";

type Props = {
  reports: ReportRow[];
};

function formatYmd(s: string): string {
  return s.slice(0, 10);
}

export function ReportsList({ reports }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-2">
        <h3 className="text-base font-semibold text-ink">저장된 리포트</h3>
        <NewReportButton />
      </header>

      {reports.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">
          저장된 리포트가 없습니다. ‘+ 새 리포트’로 첫 리포트를 생성해보세요.
        </p>
      ) : (
        <ul className="flex flex-col">
          {reports.map((r) => (
            <li
              key={r.id}
              className="border-b border-line-soft last:border-b-0"
            >
              <Link
                href={`/dashboard/reports/${r.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-3 py-2 text-sm hover:bg-washi-raised"
              >
                <span className="truncate font-medium text-ink">
                  § {r.title}
                </span>
                <span className="text-xs text-muted">
                  {r.periodStart} ~ {r.periodEnd}
                </span>
                <span className="text-xs text-muted">
                  {formatYmd(r.createdAt)}
                </span>
                <span
                  className={`text-xs ${
                    r.status === "completed" ? "text-vermilion" : "text-muted"
                  }`}
                >
                  {r.status === "completed" ? "✅ 완료" : "드래프트"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
