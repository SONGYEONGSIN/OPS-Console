"use client";

import { kstFormat } from "@/lib/kst-format";
import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
  /** 경과일 계산 기준(테스트 주입용). 기본 현재 시각. */
  nowMs?: number;
};

function formatTime(iso?: string | null): string {
  if (!iso) return "-";
  return kstFormat({
    year: "2-digit",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** 수신 후 경과 일수(floor). 없음/미래면 0. */
function daysSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  const d = nowMs - new Date(iso).getTime();
  return d <= 0 ? 0 : Math.floor(d / 86_400_000);
}

export function MailboxTable({ rows, selectedId, onSelect, nowMs }: Props) {
  const now = nowMs ?? new Date().getTime();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">발신자</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">회신</th>
          <th className="px-3 py-2">수신</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              수신 메일 없음
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
              <td className="px-3 py-2 text-sm">
                <span
                  className={row.mailIsRead ? "text-muted" : "text-vermilion"}
                >
                  {row.mailIsRead ? "○" : "●"}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.mailFromName || row.mailFromEmail || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink">
                {row.mailSubject || "(제목 없음)"}
              </td>
              <td className="px-3 py-2">
                {(() => {
                  const replied =
                    row.mailDraftStatus === "sent" ||
                    row.mailDraftStatus === "dry_run";
                  if (replied) {
                    return <span className="text-xs text-muted">회신완료</span>;
                  }
                  const days = daysSince(row.mailReceivedAt, now);
                  return (
                    <span className="inline-flex items-center gap-1 text-xs">
                      {days >= 1 && (
                        <span
                          className={
                            days >= 3 ? "text-vermilion" : "text-muted"
                          }
                        >
                          {days}일 경과 ·
                        </span>
                      )}
                      <span className="font-medium text-ink">미회신</span>
                      {row.mailHasDraft && (
                        <span className="text-muted" title="AI 초안 대기">
                          ✦
                        </span>
                      )}
                    </span>
                  );
                })()}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatTime(row.mailReceivedAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
