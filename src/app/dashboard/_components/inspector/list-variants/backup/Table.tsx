"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const MAIL_STATUS_LABEL = {
  pending: "대기",
  sent: "발송됨",
  mail_failed: "발송 실패",
  dry_run: "테스트",
} as const;

const MAIL_STATUS_TONE = {
  pending: "bg-washi-raised text-muted",
  sent: "bg-sage/15 text-sage",
  mail_failed: "bg-vermilion/15 text-vermilion",
  dry_run: "bg-washi-raised text-ink-soft",
} as const;

/**
 * PR-2: 담당 서비스 컬럼 표시 — backupServicesDetail의 첫 1~2개 service_name + 총 개수.
 * 빈 배열은 "—".
 */
function servicesPreview(row: ListRow): string {
  const details = row.backupServicesDetail ?? [];
  if (details.length === 0) return "—";
  const names = details.slice(0, 2).map((d) => d.service_name);
  const more = details.length - names.length;
  return more > 0 ? `${names.join(", ")} 외 ${more}건` : names.join(", ");
}

export function BackupTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">요청자</th>
          <th className="px-3 py-2">백업자</th>
          <th className="px-3 py-2">시작일</th>
          <th className="px-3 py-2">담당 서비스</th>
          <th className="px-3 py-2">메일 상태</th>
          <th className="px-3 py-2">제목</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const status = row.mailStatus ?? "pending";
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 text-sm text-ink">{row.owner}</td>
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.substituteName ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                  {row.leaveStartDate ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {servicesPreview(row)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${MAIL_STATUS_TONE[status]}`}
                  >
                    {MAIL_STATUS_LABEL[status]}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
