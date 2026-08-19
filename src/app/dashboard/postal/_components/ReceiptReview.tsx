"use client";

import { useState, useTransition } from "react";
import {
  confirmReceipt,
  requestExtraction,
  type ConfirmRow,
} from "@/features/postal/extract-actions";
import type { ExtractState } from "@/features/postal/queries";
import type { ReviewRow } from "@/features/postal/review-rows";

/**
 * 영수증 판독 결과 검토.
 *
 * 판독값을 바로 저장하지 않는다 — **사람이 본 것만** postal_items 로 간다.
 * 담당자가 유일하면 채워두고, 후보가 여럿이면 비워둔 채 고르게 한다.
 */
export function ReceiptReview({
  receiptId,
  state,
}: {
  receiptId: string;
  state: ExtractState;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>(state.rows);
  const [saved, setSaved] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "실패했습니다");
      else setSaved(true);
    });
  };

  const patch = (i: number, part: Partial<ReviewRow>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...part } : r)));

  // 업로드하면 판독이 자동으로 걸린다. 여기 버튼은 그게 실패했거나 큐가 밀렸을 때
  // 다시 거는 용도다 — 평소에는 누를 일이 없다.
  if (state.status === "none" || state.status === "failed") {
    return (
      <div className="space-y-1.5">
        {state.message && (
          <p className="text-2xs text-vermilion">{state.message}</p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => requestExtraction(receiptId))}
          className="cursor-pointer bg-ink px-2.5 py-1 text-xs text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다시 추출
        </button>
        {error && <p className="text-2xs text-vermilion">{error}</p>}
      </div>
    );
  }

  if (state.status === "pending" || state.status === "running") {
    return (
      <p className="text-2xs text-muted">
        영수증을 읽는 중… 30초쯤 걸립니다. 잠시 뒤 새로고침하세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {state.warnings.length > 0 && (
        // 개별 요금 합 != 총요금 같은 것. 사람이 표를 보기 전에 알린다.
        <ul className="space-y-0.5 border border-line-soft bg-situation-bg px-2.5 py-1.5">
          {state.warnings.map((w) => (
            <li key={w} className="text-2xs text-vermilion">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-2xs uppercase tracking-[0.06em] text-muted">
              <th className="px-1.5 py-1">순번</th>
              <th className="px-1.5 py-1">등기번호</th>
              <th className="px-1.5 py-1">요금</th>
              <th className="px-1.5 py-1">우편번호</th>
              <th className="px-1.5 py-1">수취인</th>
              <th className="px-1.5 py-1">담당자</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.trackingNo} className="border-b border-line-soft">
                <td className="px-1.5 py-1 font-mono text-muted">{r.daySeq}</td>
                <td className="px-1.5 py-1">
                  <Field
                    value={r.trackingNo}
                    onChange={(v) => patch(i, { trackingNo: v })}
                    width="w-36"
                  />
                </td>
                <td className="px-1.5 py-1">
                  <Field
                    value={r.fee?.toString() ?? ""}
                    onChange={(v) => patch(i, { fee: v ? Number(v) : null })}
                    width="w-16"
                  />
                </td>
                <td className="px-1.5 py-1">
                  <Field
                    value={r.postalCode ?? ""}
                    onChange={(v) => patch(i, { postalCode: v })}
                    width="w-16"
                  />
                </td>
                <td className="px-1.5 py-1">
                  <div className="flex gap-1">
                    <Field
                      value={r.recipientOrg ?? ""}
                      onChange={(v) => patch(i, { recipientOrg: v })}
                      width="w-24"
                    />
                    <Field
                      value={r.recipientName ?? ""}
                      onChange={(v) => patch(i, { recipientName: v })}
                      width="w-16"
                    />
                  </div>
                </td>
                <td className="px-1.5 py-1">
                  {/* 후보가 여럿이면 고르게 한다 — 자동으로 채우면 틀린 담당자가
                      조용히 들어가고 우편물이 엉뚱한 사람에게 간다. */}
                  {r.candidates.length > 1 ? (
                    <select
                      aria-label={`${r.trackingNo} 담당자`}
                      value={r.assignee ?? ""}
                      onChange={(e) => patch(i, { assignee: e.target.value || null })}
                      className="border border-line-soft bg-field-bg px-1 py-0.5 text-xs outline-none focus:border-ink"
                    >
                      <option value="">선택</option>
                      {r.candidates.map((c) => (
                        <option key={c.university} value={c.operator}>
                          {c.university} · {c.operator}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Field
                      value={r.assignee ?? ""}
                      onChange={(v) => patch(i, { assignee: v || null })}
                      width="w-20"
                    />
                  )}
                  {r.basis === "graduate" && (
                    <span className="ml-1 text-2xs text-muted">대학원</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              confirmReceipt(receiptId, rows.map(toConfirmRow), {
                // 접수일자가 전도금 장부에 적힐 날짜다.
                acceptedAt: state.acceptedAt,
              }),
            )
          }
          className="cursor-pointer bg-ink px-2.5 py-1 text-xs text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          확정
        </button>
        {saved && <span className="text-2xs text-muted">저장했습니다</span>}
        {error && <span className="text-2xs text-vermilion">{error}</span>}
      </div>
    </div>
  );
}

function toConfirmRow(r: ReviewRow): ConfirmRow {
  return {
    daySeq: r.daySeq,
    trackingNo: r.trackingNo,
    fee: r.fee,
    postalCode: r.postalCode,
    recipientOrg: r.recipientOrg,
    recipientName: r.recipientName,
    assignee: r.assignee,
  };
}

function Field({
  value,
  onChange,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  width: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${width} border border-line-soft bg-field-bg px-1 py-0.5 text-xs text-ink outline-none transition-colors focus:border-ink focus:bg-white`}
    />
  );
}
