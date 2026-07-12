"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import type { CohortStatus } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const COHORT_STATUS_LABEL: Record<CohortStatus, string> = {
  planned: "계획",
  in_progress: "진행중",
  completed: "완료",
};

const COHORT_STATUS_COLOR: Record<CohortStatus, string> = {
  planned: "bg-line-soft text-muted",
  in_progress: "bg-vermilion text-cream",
  completed: "bg-washi-raised text-ink",
};

function inviteBadgeLabel(
  invitedAt?: string | null,
  acceptedAt?: string | null,
): string {
  if (acceptedAt) return "수락됨";
  if (invitedAt) return "수락 대기";
  return "미초대";
}

function inviteBadgeClass(
  invitedAt?: string | null,
  acceptedAt?: string | null,
): string {
  if (acceptedAt) return "bg-washi-raised text-ink-soft";
  if (invitedAt) return "bg-vermilion/20 text-vermilion-deep";
  return "bg-line-soft text-muted";
}

/**
 * cohort 시작/종료일을 'M/D ~ M/D' 또는 'M/D ~' 로 포맷 (date-only).
 */
function formatCohortRange(start?: string, end?: string | null): string {
  if (!start) return "-";
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const startStr = fmt.format(new Date(start));
  if (!end) return `${startStr} ~`;
  return `${startStr} ~ ${fmt.format(new Date(end))}`;
}

export function CohortTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">신입 / 교육</th>
          <th className="px-3 py-2">기간</th>
          <th className="px-3 py-2">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                selectedId === row.id ? "bg-vermilion/10" : ""
              }`}
            >
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.author || row.traineeEmail || "-"}
                {row.owner && <> · 교육 {row.owner}</>}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatCohortRange(row.startDate, row.endDate)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col items-start gap-1">
                  {row.cohortStatus && (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs ${COHORT_STATUS_COLOR[row.cohortStatus]}`}
                    >
                      {COHORT_STATUS_LABEL[row.cohortStatus]}
                    </span>
                  )}
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${inviteBadgeClass(
                      row.invitedAt,
                      row.acceptedAt,
                    )}`}
                  >
                    {inviteBadgeLabel(row.invitedAt, row.acceptedAt)}
                  </span>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
