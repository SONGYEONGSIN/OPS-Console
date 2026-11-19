"use client";

import Link from "next/link";
import {
  weekPhaseOf,
  type WeekOverviewRow,
} from "@/features/ops-weekly/overview";
import { canReopenWeek, type Actor } from "@/features/ops-weekly/permissions";
import { reopenWeek } from "@/features/ops-weekly/workflow-actions";
import { formatMdHm } from "../_format";
import { opsWeeklyHref } from "../_params";
import { BTN_CLASS, ERROR_CLASS } from "./styles";
import { useWorkflow } from "./use-workflow";

type Props = { rows: readonly WeekOverviewRow[]; actor: Actor };

const TD = "px-3 py-2";

function StatusCell({ row }: { row: WeekOverviewRow }) {
  const phase = weekPhaseOf(row.state);
  if (phase === "reported" && row.reportedAt !== null) {
    return (
      <span className="tabular-nums">{`보고 ${formatMdHm(row.reportedAt)}`}</span>
    );
  }
  if (phase === "reopened") {
    return <span className="text-vermilion">정정으로 열림</span>;
  }
  return <span>{phase === "reported" ? "보고" : "열림"}</span>;
}

function ActionCell(props: {
  row: WeekOverviewRow;
  actor: Actor;
  pending: boolean;
  onReopen: (weekId: string) => void;
}) {
  const { row, actor } = props;
  const phase = weekPhaseOf(row.state);
  const href = opsWeeklyHref(row.weekStart, "status", null);
  const linkText =
    phase === "reported"
      ? "보기"
      : phase === "reopened"
        ? "작성자별 보기·고치기"
        : "작성자별 보기";
  return (
    <span className="flex flex-wrap items-center gap-2">
      {phase === "reported" && canReopenWeek(actor, row.state) ? (
        <button
          type="button"
          className={BTN_CLASS}
          disabled={props.pending}
          onClick={() => {
            props.onReopen(row.weekId);
          }}
        >
          정정
        </button>
      ) : null}
      <Link href={href} className="text-xs underline">
        {linkText}
      </Link>
    </span>
  );
}

/** 최근 주별 제출·당번·상태 — 주 상태에 맞는 작업만 보인다. */
export function WeekOverviewTable({ rows, actor }: Props) {
  const wf = useWorkflow();
  if (rows.length === 0) {
    return (
      <div className="border border-line-soft bg-situation-bg px-4 py-6 text-sm text-muted">
        열린 주가 아직 없습니다
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {wf.message ? (
        <p role="alert" className={ERROR_CLASS}>
          {wf.message}
        </p>
      ) : null}
      {/* 일회성: 6열이 좁은 화면에서 찌그러지지 않는 최소 폭 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
              <th className="px-3 py-2">주차</th>
              <th className="px-3 py-2">기간</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">제출</th>
              <th className="px-3 py-2">당번</th>
              <th className="px-3 py-2">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.weekId}
                className="border-b border-line-soft text-ink hover:bg-line-soft"
              >
                <td className={`${TD} font-medium`}>{row.label}</td>
                <td className={TD}>{row.rangeLabel}</td>
                <td className={TD}>
                  <StatusCell row={row} />
                </td>
                <td className={TD}>
                  <span className="tabular-nums">{`${row.submitted}/${row.total}`}</span>
                </td>
                <td className={TD}>{row.dutyName ?? "미지정"}</td>
                <td className={TD}>
                  <ActionCell
                    row={row}
                    actor={actor}
                    pending={wf.pending}
                    onReopen={(weekId) => {
                      wf.run(() => reopenWeek({ weekId }));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
