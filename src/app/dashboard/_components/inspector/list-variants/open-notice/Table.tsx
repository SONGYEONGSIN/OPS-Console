"use client";

import { kstFormat } from "@/lib/kst-format";
import type { ListRow } from "../../../patterns/ListPattern";
import { BADGE_TONE } from "../badge-tone";

/** ISO → KST 'MM-DD'. 없으면 '—'. */
function formatMonthDay(iso?: string | null): string {
  if (!iso) return "—";
  const parts = kstFormat({ month: "2-digit", day: "2-digit" }).formatToParts(
    new Date(iso),
  );
  const mm = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return mm && dd ? `${mm}-${dd}` : "—";
}

/** ISO → KST 'MM-DD HH:mm'. 없으면 '—'. */
function formatSendDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const parts = kstFormat({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const [mm, dd, hh, mi] = [get("month"), get("day"), get("hour"), get("minute")];
  return mm && dd && hh && mi ? `${mm}-${dd} ${hh}:${mi}` : "—";
}

/**
 * 접수가 이미 시작됐으면 true — 그 행은 고를 수 없다.
 *
 * 목록이 아직 안 열린 건만 담아서 평소에는 한 행도 걸리지 않는다. 그래도 두는
 * 이유는 안전망이다 — 페이지를 열어둔 채 접수 시작 시각을 넘기는 경우, 그리고
 * 실데이터에 있는 날짜 이상 건.
 */
export function isWriteStartPast(
  iso: string | null | undefined,
  now: Date,
): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}

function StatusBadge({ status }: { status?: "scheduled" | "sent" | null }) {
  if (status === "scheduled")
    return (
      <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.idle}`}>
        예약완료
      </span>
    );
  if (status === "sent")
    return (
      <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.done}`}>
        발송완료
      </span>
    );
  return <span className="text-ink-soft">—</span>;
}

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function OpenNoticeTable({ rows, selectedId, onSelect }: Props) {
  const now = new Date();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">접수시작</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">발송일자</th>
          <th className="px-3 py-2">운영자</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
              오픈 예정인 서비스가 없습니다.
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const past = isWriteStartPast(row.writeStartAt, now);
            return (
              <tr
                key={row.id}
                onClick={past ? undefined : () => onSelect(row)}
                aria-disabled={past || undefined}
                className={
                  past
                    ? "border-b border-line-soft bg-search-field-bg opacity-60 cursor-not-allowed"
                    : `cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                        selectedId === row.id ? "bg-vermilion/10" : ""
                      }`
                }
              >
                <td className="px-3 py-2 font-medium text-ink">
                  {row.universityName ?? "—"}
                </td>
                <td className="px-3 py-2 text-ink">
                  {row.serviceName ?? row.name}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {formatMonthDay(row.writeStartAt)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.openNoticeStatus} />
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {formatSendDateTime(row.openNoticeLastSentAt)}
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {row.operatorName ?? "—"}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
