"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kstFormat } from "@/lib/kst-format";
import { setInvoiceIssued } from "@/features/invoice/actions";
import {
  formatBilledAmount,
  ISSUE_TYPES,
  type InvoiceRow,
} from "@/features/invoice/rows";

/**
 * 계산서발행 목록.
 *
 * 여기 뜨는 건 **정산이 끝난 것만**이다. 정산 전 건이 섞이면 아직 청구하면 안 되는
 * 대학에 계산서가 나간다.
 *
 * 발행은 체크박스가 아니라 **발행유형 셀렉트 하나**로 한다 — 유형을 고르는 것이
 * 곧 발행이고, '미발행'으로 되돌리면 기록이 지워진다. 체크와 유형을 따로 두면
 * 유형 없이 발행된 행이 생긴다.
 */
const fmtDate = (iso: string) =>
  kstFormat({ month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function InvoiceTable({ rows }: { rows: InvoiceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border border-line-soft bg-situation-bg px-6 py-10 text-sm text-muted">
        정산이 끝난 건이 없습니다. 전형료 정산에서 완료 표시를 하면 여기 나옵니다.
      </p>
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-2">대학명</th>
            <th className="px-3 py-2">서비스명</th>
            <th className="px-3 py-2">정산완료</th>
            <th className="px-3 py-2">발행유형</th>
            <th className="px-3 py-2">발행일</th>
            <th className="px-3 py-2">청구금액</th>
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

function Row({ row }: { row: InvoiceRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const issued = Boolean(row.issuedAt);

  return (
    <tr className="border-b border-line-soft hover:bg-line-soft">
      {/* 발행까지 끝난 줄은 톤을 낮춘다 — 남은 일은 아직 발행 안 한 줄이다. */}
      <td className={`px-3 py-2 text-sm ${issued ? "text-muted" : "text-ink"}`}>
        {row.university_name}
      </td>
      <td className="px-3 py-2 text-sm text-ink-soft">{row.service_name}</td>
      <td className="px-3 py-2 text-sm tabular-nums text-ink-soft">
        {row.settledAt ? fmtDate(row.settledAt) : "—"}
      </td>
      <td className="px-3 py-2 text-sm">
        <select
          aria-label={`${row.university_name} ${row.service_name} 발행유형`}
          disabled={pending}
          value={row.issueType ?? ""}
          onChange={(e) => {
            const next = e.target.value === "" ? null : e.target.value;
            setError(null);
            startTransition(async () => {
              const r = await setInvoiceIssued(row.service_id, next);
              if (r.ok) router.refresh();
              else setError(r.error);
            });
          }}
          className="border border-line-soft bg-field-bg px-1.5 py-0.5 text-xs text-ink outline-none transition-colors focus:border-ink focus:bg-white"
        >
          {/* 안 한 것을 '미발행'으로 드러낸다 — 기본값을 넣으면 발행한 척이 된다. */}
          <option value="">미발행</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {error && <p className="mt-0.5 text-2xs text-vermilion">{error}</p>}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums text-ink">
        {row.issuedAt ? fmtDate(row.issuedAt) : "—"}
      </td>
      {/* Moa 연동 전까지 비어 있다. 0 으로 보이면 청구할 게 없다고 읽힌다. */}
      <td className="px-3 py-2 text-sm tabular-nums text-ink-soft">
        {formatBilledAmount(row.billedAmount)}
      </td>
      <td className="px-3 py-2 text-sm text-ink-soft">
        {row.operator_name ?? "—"}
      </td>
    </tr>
  );
}
