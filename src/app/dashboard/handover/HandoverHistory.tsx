"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmHandoverProgress,
  cancelHandoverProgress,
} from "@/features/handover/progress-actions";
import type { ProgressListRow } from "@/features/handover/progress-queries";

type Props = {
  rows: ProgressListRow[];
  meEmail: string | null;
};

const STATUS_LABEL: Record<ProgressListRow["status"], string> = {
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "취소",
};
const STATUS_TONE: Record<ProgressListRow["status"], string> = {
  in_progress: "bg-vermilion/15 text-vermilion",
  completed: "bg-sage/15 text-sage",
  cancelled: "bg-washi-raised text-muted",
};

function formatTs(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function HandoverHistory({ rows, meEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConfirm(id: string) {
    if (!confirm("이 인계를 확인 완료 처리하시겠습니까?")) return;
    startTransition(async () => {
      const r = await confirmHandoverProgress(id);
      if (!r.ok) alert(`실패: ${r.error}`);
      else router.refresh();
    });
  }
  function handleCancel(id: string) {
    if (!confirm("이 인계를 취소하시겠습니까?")) return;
    startTransition(async () => {
      const r = await cancelHandoverProgress(id);
      if (!r.ok) alert(`실패: ${r.error}`);
      else router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-2">일시</th>
            <th className="px-3 py-2">대학명 · 서비스</th>
            <th className="px-3 py-2">인계자</th>
            <th className="px-3 py-2">인수자</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted">
                인계 이력 없음
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const canConfirm =
                r.to_email === meEmail && r.status === "in_progress";
              const canCancel =
                (r.from_email === meEmail || meEmail === null) &&
                r.status === "in_progress";
              return (
                <tr
                  key={r.id}
                  className="border-b border-line-soft hover:bg-line-soft"
                >
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {formatTs(r.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink">
                      {r.university_name}
                    </span>
                    <span className="ml-1 text-xs text-muted">
                      · {r.service_name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {r.from_name}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {r.to_name}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canConfirm && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleConfirm(r.id)}
                        className="cursor-pointer border border-ink bg-ink px-3 py-1 text-xs text-cream disabled:opacity-50"
                      >
                        확인
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleCancel(r.id)}
                        className="ml-1 cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:border-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
                      >
                        취소
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
