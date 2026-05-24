import type { Step } from "@/features/performance/schemas";

type Props = {
  /** assignment row의 current_step 분포 */
  stepCounts: Record<Step, number>;
  total: number;
};

const STEP_LABEL: Record<Step, string> = {
  1: "목표설정",
  2: "실행계획",
  3: "계획검토",
  4: "중간점검",
  5: "점검검토",
  6: "자기평가",
  7: "종합평가",
  8: "완료",
};

/**
 * admin 권한 시 페이지 상단 핵심 카드 요약.
 * 8단계별 진행 중 assignment 수 + 완료 비율.
 */
export function AdminSummary({ stepCounts, total }: Props) {
  const completed = stepCounts[8] ?? 0;
  const completedPercent =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <section
      data-testid="performance-admin-summary"
      className="mb-6 border border-ink bg-cream p-4"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-ink-soft">관리자 요약</h3>
        <span className="text-xs text-ink-muted">
          전체 {total}건 · 완료 {completed}건 ({completedPercent}%)
        </span>
      </header>
      <div className="grid grid-cols-8 gap-2">
        {([1, 2, 3, 4, 5, 6, 7, 8] as Step[]).map((step) => {
          const count = stepCounts[step] ?? 0;
          const active = count > 0;
          return (
            <div
              key={step}
              className={`flex flex-col items-center gap-1 border px-2 py-2 text-center ${
                active
                  ? "border-ink bg-washi-raised"
                  : "border-line-soft bg-washi"
              }`}
            >
              <span className="text-[10px] text-ink-muted">
                {step}. {STEP_LABEL[step]}
              </span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
