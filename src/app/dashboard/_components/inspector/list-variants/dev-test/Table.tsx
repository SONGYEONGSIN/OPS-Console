"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import type {
  EntertestRun,
  EntertestRunStatus,
} from "@/features/entertest/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const STATUS_LABEL: Record<EntertestRunStatus, string> = {
  pending: "대기",
  running: "실행 중",
  done: "완료",
  failed: "실패",
  error: "오류",
};

/** 가장 최근 실행(requested_at 최대) 1건. */
function latestRun(runs?: EntertestRun[]): EntertestRun | null {
  if (!runs || runs.length === 0) return null;
  return runs.reduce((a, b) => (a.requested_at >= b.requested_at ? a : b));
}

function statusTone(status: EntertestRunStatus): string {
  if (status === "done") return "bg-line-soft text-ink";
  if (status === "failed" || status === "error") return "bg-vermilion text-paper";
  return "bg-cream text-ink-soft";
}

export function DevTestTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">접수구분</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">최근 테스트</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const latest = latestRun(row.entertestRuns);
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.universityName ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {row.applicationType ? (
                    <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-muted">
                      {row.applicationType}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.serviceName ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {row.category ? (
                    <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                      {row.category}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.operatorName || "-"}
                </td>
                <td className="px-3 py-2">
                  {latest ? (
                    <span
                      className={`inline-block px-2 py-0.5 text-xs ${statusTone(latest.status)}`}
                    >
                      {STATUS_LABEL[latest.status]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">미실행</span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
