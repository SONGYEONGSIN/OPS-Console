"use client";

import Link from "next/link";
import { normEmail } from "@/features/ops-weekly/email";
import type { ReportRow, WeekRow } from "@/features/ops-weekly/schemas";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import { formatMdHm } from "../_format";
import { opsWeeklyHref } from "../_params";
import { BTN_CLASS } from "./styles";

type Props = {
  week: WeekRow;
  writers: readonly WriterCandidate[];
  reports: readonly ReportRow[];
  /** 다시 작성을 요청할 수 있는 보고서인지 — 권한·주 상태·제출 여부 */
  canReturn: (report: ReportRow) => boolean;
  onReturn: (report: ReportRow, name: string) => void;
};

const TD = "px-3 py-2";

function statusLabel(report: ReportRow | undefined): string {
  if (report?.status === "submitted") return "제출";
  if (report?.status === "returned") return "다시 작성 요청";
  return "미제출";
}

/** 명단 순서대로 한 줄씩 — 보고서 행이 없으면 아직 안 만든 것이라 미제출이다. */
export function SubmissionTable(props: Props) {
  const { week, writers, reports, canReturn, onReturn } = props;
  const byEmail = new Map(reports.map((r) => [normEmail(r.operator_email), r]));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">팀</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">제출 시각</th>
          <th className="px-3 py-2">보기</th>
          <th className="px-3 py-2">작업</th>
        </tr>
      </thead>
      <tbody>
        {writers.map((w) => {
          const report = byEmail.get(normEmail(w.email));
          return (
            <tr
              key={w.email}
              className="border-b border-line-soft text-ink hover:bg-line-soft"
            >
              <td className={TD}>{w.name}</td>
              <td className={TD}>{w.team}</td>
              <td className={TD}>{statusLabel(report)}</td>
              <td className={`${TD} tabular-nums`}>
                {report?.status === "submitted" && report.submitted_at
                  ? formatMdHm(report.submitted_at)
                  : "—"}
              </td>
              <td className={TD}>
                <Link
                  href={opsWeeklyHref(week.week_start, "application", w.email)}
                  className="underline"
                >
                  보기
                </Link>
              </td>
              <td className={TD}>
                {report !== undefined && canReturn(report) ? (
                  <button
                    type="button"
                    className={BTN_CLASS}
                    onClick={() => {
                      onReturn(report, w.name);
                    }}
                  >
                    다시 작성
                  </button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
