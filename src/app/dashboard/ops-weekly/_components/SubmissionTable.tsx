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
  /** 관리자에게만 준다 — 빈 명단 안내에 설정 링크를 붙인다 */
  settingsHref?: string;
};

const TD = "px-3 py-2";

const STATUS_TONE = {
  submitted: "text-ink",
  returned: "text-vermilion",
  missing: "text-muted",
} as const;

function statusLabel(report: ReportRow | undefined): string {
  if (report?.status === "submitted") return "제출";
  if (report?.status === "returned") return "다시 작성 요청";
  return "미제출";
}

function toneOf(report: ReportRow | undefined): keyof typeof STATUS_TONE {
  if (report?.status === "submitted") return "submitted";
  if (report?.status === "returned") return "returned";
  return "missing";
}

/** 명단 순서대로 한 줄씩 — 보고서 행이 없으면 아직 안 만든 것이라 미제출이다. */
export function SubmissionTable(props: Props) {
  const { week, writers, reports, canReturn, onReturn } = props;
  const byEmail = new Map(reports.map((r) => [normEmail(r.operator_email), r]));
  if (writers.length === 0) {
    return (
      <div className="flex flex-col gap-1 border border-line-soft bg-situation-bg px-4 py-6 text-sm">
        <p className="text-ink">작성 대상 명단이 비어 있습니다</p>
        <p className="text-xs text-muted">
          관리자 설정에서 작성 제외·당번 순번을 확인하세요
        </p>
        {props.settingsHref ? (
          <Link href={props.settingsHref} className="text-xs underline">
            설정 열기
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    // 일회성: 6열이 좁은 화면에서 찌그러지지 않는 최소 폭
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
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
                <td className={`${TD} font-medium`}>{w.name}</td>
                <td className={TD}>{w.team}</td>
                <td className={`${TD} ${STATUS_TONE[toneOf(report)]}`}>
                  {statusLabel(report)}
                </td>
                <td className={`${TD} tabular-nums`}>
                  {report?.status === "submitted" && report.submitted_at
                    ? formatMdHm(report.submitted_at)
                    : "—"}
                </td>
                <td className={TD}>
                  <Link
                    href={opsWeeklyHref(
                      week.week_start,
                      "application",
                      w.email,
                    )}
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
    </div>
  );
}
