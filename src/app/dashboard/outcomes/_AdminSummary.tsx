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
 * admin 요약 — 수평 진행 바 + 8 세그먼트 카운트 (Stepper 톤 일관).
 * - 가로 바: 단계×카운트로 채워진 비율 시각화 (완료 = ink, 진행 = vermilion, 빈 = washi)
 * - 하단 grid: 각 step 라벨 + 카운트
 */
export function AdminSummary({ stepCounts, total }: Props) {
  const completed = stepCounts[8] ?? 0;
  const completedPercent =
    total === 0 ? 0 : Math.round((completed / total) * 100);
  const steps: Step[] = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <section
      data-testid="performance-admin-summary"
      className="mb-6 border border-line bg-cream p-3"
    >
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted">
          관리자 요약
        </h3>
        <span className="text-xs text-ink-soft tabular-nums">
          전체 {total}건 · 완료 {completed}건 ({completedPercent}%)
        </span>
      </header>

      {/* 8 세그먼트 가로 바 — 카운트 0=빈, >0=채움(완료=ink, 그 외=vermilion) */}
      <div className="mb-2 flex h-1.5 gap-0.5">
        {steps.map((step) => {
          const count = stepCounts[step] ?? 0;
          const tone =
            count === 0
              ? "bg-washi-raised"
              : step === 8
                ? "bg-ink"
                : "bg-vermilion";
          return (
            <div
              key={step}
              className={`flex-1 ${tone}`}
              data-step={step}
              data-count={count}
            />
          );
        })}
      </div>

      {/* 8 세그먼트 라벨 + 카운트 */}
      <div className="grid grid-cols-8 gap-0.5 text-center">
        {steps.map((step) => {
          const count = stepCounts[step] ?? 0;
          return (
            <div key={step} className="flex flex-col leading-tight">
              <span className="text-[10px] text-ink-muted">
                {step}. {STEP_LABEL[step]}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  count > 0 ? "font-bold text-ink" : "text-muted"
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
