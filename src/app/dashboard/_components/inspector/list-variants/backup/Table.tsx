"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/**
 * 백업 서비스 컬럼 표시 — backupServicesDetail의 첫 1~2개 service_name + 총 개수.
 * 빈 배열은 "—".
 */
function servicesPreview(row: ListRow): string {
  const details = row.backupServicesDetail ?? [];
  if (details.length === 0) return "—";
  const names = details.slice(0, 2).map((d) => d.service_name);
  const more = details.length - names.length;
  return more > 0 ? `${names.join(", ")} 외 ${more}건` : names.join(", ");
}

/**
 * 백업자 컬럼 표시 — 서비스별 모드일 때 모든 distinct substitute_name을 join.
 * 1명 일괄이면 한 명, 서비스별이면 N명. 비어있으면 parent substituteName 또는 "—".
 */
function substitutesPreview(row: ListRow): string {
  const details = row.backupServicesDetail ?? [];
  const names = new Set<string>();
  for (const d of details) {
    if (d.substitute_name) names.add(d.substitute_name);
  }
  if (names.size > 0) return Array.from(names).join(", ");
  return row.substituteName ?? "—";
}

/** 휴가기간 표시 — 둘 다 있으면 'start ~ end', 시작만/끝만, 둘 다 없으면 '—' */
function leaveRangeLabel(row: ListRow): string {
  const s = row.leaveStartDate;
  const e = row.leaveEndDate;
  if (s && e) return `${s} ~ ${e}`;
  if (s) return `${s} ~`;
  if (e) return `~ ${e}`;
  return "—";
}

/** ISO timestamp → KST 'yyyy-mm-dd HH:mm' (24h). 발송 시각 식별성 ↑ */
function formatYmdHmKst(iso: string): string {
  const d = new Date(iso);
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${ymd} ${hm}`;
}

export function BackupTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">요청자</th>
          <th className="px-3 py-2">백업자</th>
          <th className="px-3 py-2">휴가기간</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">백업 서비스</th>
          <th className="px-3 py-2">메일 발송일자</th>
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
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-washi-raised" : ""
              }`}
            >
              <td className="px-3 py-2 text-sm text-ink">{row.owner}</td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {substitutesPreview(row)}
              </td>
              <td className="px-3 py-2 text-xs text-ink-soft">
                {leaveRangeLabel(row)}
              </td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2 text-xs text-ink-soft">
                {servicesPreview(row)}
              </td>
              <td className="px-3 py-2 text-xs text-ink-soft">
                {row.mailSentAt ? formatYmdHmKst(row.mailSentAt) : "—"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
