import type {
  ChecklistRound,
  ChecklistItem,
  ShareToken,
} from "@/features/checklist/schemas";
import { computeCompletion } from "@/features/checklist/completion";
import { DEPARTMENTS } from "@/features/checklist/schemas";
import { ShareLinks } from "./ShareLinks";
import { ItemManager } from "./ItemManager";

type Props = {
  round: ChecklistRound;
  items: ChecklistItem[];
  tokens: ShareToken[];
};

/**
 * 회차 상세 (관리) — 헤더 + 공유 링크 + 요약 KPI + 부서별 항목 편집.
 * ReportDetail 골격을 체크리스트 도메인으로 이식.
 */
export function RoundDetail({ round, items, tokens }: Props) {
  const all = computeCompletion(items);
  return (
    <article className="flex flex-col gap-6">
      <header className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          [운영부 상황실] · 원서접수 점검사항 체크리스트
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">
          {round.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"} ·{" "}
          {round.createdBy ?? ""}
        </p>
      </header>

      <ShareLinks roundId={round.id} tokens={tokens} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["전체 항목", all.total],
            ["완료", all.done],
            ["진행중", all.inProgress],
            ["작업전", all.todo],
          ] as const
        ).map(([label, n]) => (
          <div
            key={label}
            className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
          >
            <span className="text-xs font-medium text-muted">{label}</span>
            <span className="text-2xl font-bold text-ink">{n}</span>
          </div>
        ))}
      </div>

      {DEPARTMENTS.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        if (deptItems.length === 0) return null;
        return (
          <ItemManager
            key={dept}
            roundId={round.id}
            department={dept}
            items={deptItems}
          />
        );
      })}
    </article>
  );
}
