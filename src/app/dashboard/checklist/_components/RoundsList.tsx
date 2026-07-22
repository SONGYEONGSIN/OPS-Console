"use client";

import { useRouter } from "next/navigation";
import type { ChecklistRound } from "@/features/checklist/schemas";
import type { Completion } from "@/features/checklist/completion";

type Props = {
  rounds: (ChecklistRound & { completion: Completion })[];
};

const STATUS_LABEL: Record<ChecklistRound["status"], string> = {
  draft: "초안",
  active: "진행중",
  closed: "종료",
};

/**
 * 회차 목록 — services/reports 등과 동일한 표준 테이블(thead + hover row).
 * 행 클릭 시 회차 상세 페이지로 이동.
 */
export function RoundsList({ rounds }: Props) {
  const router = useRouter();

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">모집시기</th>
          <th className="px-3 py-2">점검 기간</th>
          <th className="px-3 py-2">진행</th>
          <th className="px-3 py-2">완료율</th>
          <th className="px-3 py-2">상태</th>
        </tr>
      </thead>
      <tbody>
        {rounds.length === 0 ? (
          <tr>
            <td
              colSpan={5}
              className="px-3 py-8 text-center text-sm text-muted"
            >
              모집시기가 없습니다. 우측 상단 ‘+ 새 모집시기’로 첫 모집시기를
              만드세요.
            </td>
          </tr>
        ) : (
          rounds.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/dashboard/checklist/${r.id}`)}
              className="cursor-pointer border-b border-line-soft hover:bg-line-soft"
            >
              <td className="px-3 py-2 font-medium text-ink">{r.title}</td>
              <td className="px-3 py-2 text-muted">
                {r.periodStart ?? "-"} ~ {r.periodEnd ?? "-"}
              </td>
              <td className="px-3 py-2 text-muted">
                {r.completion.done}/{r.completion.total}
              </td>
              <td className="px-3 py-2 text-muted">{r.completion.pct}%</td>
              <td className="px-3 py-2 text-muted">{STATUS_LABEL[r.status]}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
