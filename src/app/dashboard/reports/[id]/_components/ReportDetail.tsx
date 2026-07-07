import type { ReportRow } from "@/features/reports/schemas";
import { KpiGrid } from "../../_components/KpiGrid";
import { ShareControls } from "./ShareControls";
import { EditableTitle } from "./EditableTitle";

type Props = {
  report: ReportRow;
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

export function ReportDetail({ report }: Props) {
  return (
    <article className="flex flex-col gap-6">
      <header className="border-b border-line pb-4">
        <EditableTitle reportId={report.id} initialTitle={report.title} />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            {report.periodStart} ~ {report.periodEnd}
          </span>
          <span className="text-line">·</span>
          <span>생성 {formatDateTime(report.createdAt)}</span>
          <span className="text-line">·</span>
          <span>{report.createdBy}</span>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/reports/${report.id}/pdf`}
          className="border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream hover:opacity-90"
          target="_blank"
          rel="noopener noreferrer"
        >
          PDF 다운로드
        </a>
        <ShareControls reportId={report.id} initialToken={report.shareToken} />
      </div>

      <KpiGrid kpis={report.kpis} />
    </article>
  );
}
