import Link from "next/link";
import type { ChecklistRound } from "@/features/checklist/schemas";
import type { Completion } from "@/features/checklist/completion";

type Props = {
  rounds: (ChecklistRound & { completion: Completion })[];
};

/**
 * 회차 카드 목록 — ReportsList 톤(bg-situation-bg 카드)을 플랫 그리드로 변형.
 * 카드 클릭 시 회차 상세 페이지로 이동.
 */
export function RoundsList({ rounds }: Props) {
  if (rounds.length === 0)
    return (
      <div className="border border-line-soft bg-situation-bg p-8 text-center text-sm text-muted">
        회차가 없습니다. 우측 상단에서 새 회차를 만드세요.
      </div>
    );

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rounds.map((r) => (
        <li key={r.id}>
          <Link
            href={`/dashboard/checklist/${r.id}`}
            className="block border border-line-soft bg-situation-bg p-4 hover:border-vermilion"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">{r.title}</span>
              <span className="text-xs text-muted">
                {r.completion.done}/{r.completion.total} · {r.completion.pct}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft">
              {/* 일회성: 완료율 진행바 폭은 런타임 계산값 — 색은 토큰 클래스(bg-vermilion) 사용 */}
              <span
                className="block h-full bg-vermilion"
                style={{ width: `${r.completion.pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-muted">
              {r.periodStart ?? "-"} ~ {r.periodEnd ?? "-"}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
