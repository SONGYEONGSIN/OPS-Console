"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kstFormat } from "@/lib/kst-format";
import {
  setSettlementCompleted,
  setSettlementDeadline,
} from "@/features/settlement/actions";
import { DEADLINE_DAYS } from "@/features/settlement/deadline";
import type { BillingState } from "@/features/settlement/completion";
import type { SettlementRow } from "@/features/settlement/rows";

/** 정산·발행 상태가 붙은 정산 행. */
export type SettlementTableRow = SettlementRow & BillingState;

/**
 * 전형료 정산 목록.
 *
 * 서비스마감과 다른 점은 **정산 마감일과 남은 날**이다. `listClosing` 이 이미
 * `pay_end_at` 으로 거르므로, 이 두 칸이 없으면 서비스마감과 같은 목록이 된다.
 *
 * 정산기한은 **대학 단위**라 한 줄에서 고치면 같은 대학의 다른 줄도 함께 바뀐다.
 * 별도 관리 화면을 두지 않은 이유다 — 기한이 빠진 자리가 곧 눈에 띄는 곳이고,
 * 거기서 정하는 게 자연스럽다.
 */
const fmtDate = (iso: string) =>
  kstFormat({ month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function SettlementTable({ rows }: { rows: SettlementTableRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        정산할 건이 없습니다.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-2">완료</th>
            <th className="px-3 py-2">대학명</th>
            <th className="px-3 py-2">서비스명</th>
            <th className="px-3 py-2">결제마감</th>
            <th className="px-3 py-2">정산기한</th>
            <th className="px-3 py-2">정산 마감일</th>
            <th className="px-3 py-2">남은 날</th>
            <th className="px-3 py-2">운영자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: SettlementTableRow }) {
  const [pending, startTransition] = useTransition();
  // 오류는 난 자리에 띄운다 — 체크박스 오류가 정산기한 칸 밑에 뜨면 무엇이
  // 잘못됐는지 읽히지 않는다.
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);
  const router = useRouter();
  const settled = Boolean(row.settledAt);

  return (
    <tr className="border-b border-line-soft hover:bg-line-soft">
      <td className="px-3 py-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            aria-label={`${row.university_name} ${row.service_name} 정산완료`}
            checked={settled}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setSettleError(null);
              startTransition(async () => {
                const r = await setSettlementCompleted(row.service_id, next);
                if (r.ok) router.refresh();
                else setSettleError(r.error);
              });
            }}
            className="accent-vermilion"
          />
          {settled && row.settledAt && (
            <span className="text-2xs tabular-nums text-muted">
              {fmtDate(row.settledAt)}
            </span>
          )}
        </label>
        {settleError && (
          <p className="mt-0.5 text-2xs text-vermilion">{settleError}</p>
        )}
      </td>
      {/* 완료된 줄은 톤을 낮춘다. 숨기거나 취소선을 긋지 않는다 — 발행이 아직 남았다. */}
      <td className={`px-3 py-2 text-sm ${settled ? "text-muted" : "text-ink"}`}>
        {row.university_name}
      </td>
      <td className={`px-3 py-2 text-sm ${settled ? "text-muted" : "text-ink-soft"}`}>
        {row.service_name}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums text-ink-soft">
        {row.pay_end_at ? fmtDate(row.pay_end_at) : "—"}
      </td>
      <td className="px-3 py-2 text-sm">
        <select
          aria-label={`${row.university_name} 정산기한`}
          disabled={pending}
          value={row.deadlineDays ?? ""}
          onChange={(e) => {
            const days = Number(e.target.value);
            setDeadlineError(null);
            startTransition(async () => {
              const r = await setSettlementDeadline(row.university_name, days);
              if (r.ok) router.refresh();
              else setDeadlineError(r.error);
            });
          }}
          className="border border-line-soft bg-field-bg px-1.5 py-0.5 text-xs text-ink outline-none transition-colors focus:border-ink focus:bg-white"
        >
          {/* 안 정해진 것을 '미설정'으로 드러낸다 — 기본값을 넣으면 정해진 척이 된다. */}
          <option value="">미설정</option>
          {DEADLINE_DAYS.map((d) => (
            <option key={d} value={d}>
              {d}일 이내
            </option>
          ))}
        </select>
        {deadlineError && (
          <p className="mt-0.5 text-2xs text-vermilion">{deadlineError}</p>
        )}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums text-ink">
        {row.dueAt ? fmtDate(row.dueAt) : "—"}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums">
        <DaysLeft days={row.daysLeft} />
      </td>
      <td className="px-3 py-2 text-sm text-ink-soft">
        {row.operator_name ?? "—"}
      </td>
    </tr>
  );
}

/** 지난 건은 눈에 띄어야 한다 — 정산은 늦으면 그 자체가 사고다. */
function DaysLeft({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted">—</span>;
  if (days < 0) {
    return (
      <span className="font-medium text-vermilion">{-days}일 지남</span>
    );
  }
  return <span className="text-ink-soft">D-{days}</span>;
}
