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
 * 오픈 시각이 이미 지났으면 true — 그 행은 고를 수 없다.
 *
 * 목록에 접수 중인 건까지 담는 이유는 토글을 못 켠 채 오픈된 건이 사라지면
 * 담당자가 누락을 알아챌 길이 없어서다. 보이되 손댈 수는 없게 둔다.
 */
export function isWriteStartPast(
  iso: string | null | undefined,
  now: Date,
): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < now.getTime();
}

function StatusBadge({
  status,
  failedAt,
}: {
  status?: "scheduled" | "sent" | null;
  failedAt?: string | null;
}) {
  if (status === "scheduled")
    return (
      <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.idle}`}>
        자동 발송 켬
      </span>
    );
  if (status === "sent")
    return (
      <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.done}`}>
        발송완료
      </span>
    );
  // 자동 발송이라 실패를 아무도 안 보고 있다. 성공 이력이 없을 때만 드러낸다.
  if (failedAt)
    return (
      <span className={`inline-block px-2 py-0.5 text-2xs ${BADGE_TONE.attention}`}>
        발송실패
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
              대상 서비스가 없습니다.
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
                  <StatusBadge
                    status={row.openNoticeStatus}
                    failedAt={row.openNoticeLastFailedAt}
                  />
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
