"use client";

import { useRouter } from "next/navigation";
import type { ReportRow } from "@/features/reports/schemas";
import {
  REPORT_PERIOD_LABELS,
  type ReportPeriod,
} from "@/features/reports/schemas";
import { NewReportButton } from "./NewReportButton";

type Props = {
  reports: ReportRow[];
};

function formatYmd(s: string): string {
  return s.slice(0, 10);
}

/**
 * 저장된 리포트 목록 — services/계약 등 ListPattern 톤(thead + hover row)으로 통일.
 * 행 클릭 시 상세 페이지로 이동.
 */
export function ReportsList({ reports }: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-ink">저장된 리포트</h3>
        <NewReportButton />
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-2">제목</th>
            <th className="px-3 py-2">기간</th>
            <th className="px-3 py-2">기간 범위</th>
            <th className="px-3 py-2">생성일</th>
            <th className="px-3 py-2">상태</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-8 text-center text-sm text-muted"
              >
                저장된 리포트가 없습니다. ‘+ 새 리포트’로 첫 리포트를 생성해보세요.
              </td>
            </tr>
          ) : (
            reports.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/dashboard/reports/${r.id}`)}
                className="cursor-pointer border-b border-line-soft hover:bg-line-soft"
              >
                <td className="px-3 py-2 font-medium text-ink">
                  <span className="mr-1 text-muted">§</span>
                  {r.title}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {REPORT_PERIOD_LABELS[r.period as ReportPeriod] ?? r.period}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {r.periodStart} ~ {r.periodEnd}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {formatYmd(r.createdAt)}
                </td>
                <td className="px-3 py-2 text-sm">
                  {r.status === "completed" ? (
                    <span className="inline-block bg-vermilion/10 px-2 py-0.5 text-xs text-vermilion">
                      완료
                    </span>
                  ) : (
                    <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-muted">
                      드래프트
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
